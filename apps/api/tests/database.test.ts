import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { migrate } from '../src/db/migrate.ts';
import { seed } from '../src/db/seed.ts';
import { createApp } from '../src/app.ts';
import { tokenHash } from '../src/security.ts';
import { grantRuntimeRole } from '../src/db/runtimeRole.ts';

test('PostgreSQL real: persistência, concorrência, autorização, cancelamento e privacidade', async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(
    connectionString,
    'Configure TEST_DATABASE_URL apontando para um banco exclusivo de testes.',
  );
  assert.match(new URL(connectionString).pathname, /test/i, 'O nome do banco deve conter test.');
  const schema = `vitalis_test_${randomUUID().replaceAll('-', '')}`;
  const owner = new Pool({ connectionString });
  await owner.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}`, max: 8 });
  let apiPool: Pool | undefined;
  const donorPassword = 'teste-doador-muito-seguro';
  const adminPassword = 'teste-admin-muito-seguro';
  let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
  try {
    await migrate(pool);
    await migrate(pool);
    await seed(pool, donorPassword, adminPassword);
    await seed(pool, donorPassword, adminPassword);
    await grantRuntimeRole(pool);
    const runtimeUrl = new URL(process.env.DATABASE_URL!);
    assert.equal(runtimeUrl.username, 'vitalis_app');
    runtimeUrl.pathname = new URL(connectionString).pathname;
    apiPool = new Pool({
      connectionString: runtimeUrl.toString(),
      options: `-c search_path=${schema}`,
      max: 8,
    });
    const permissions = (
      await apiPool.query(
        `SELECT has_schema_privilege(current_schema(),'CREATE') AS create_schema,has_table_privilege('accounts','UPDATE') AS update_all,has_column_privilege('accounts','name','UPDATE') AS update_name`,
      )
    ).rows[0];
    assert.deepEqual(permissions, { create_schema: false, update_all: false, update_name: true });
    assert.equal((await pool.query('SELECT count(*)::int n FROM accounts')).rows[0].n, 5);
    assert.equal((await pool.query('SELECT count(*)::int n FROM slots')).rows[0].n, 42);
    await pool.query(
      `INSERT INTO accounts(id,email,name,password_hash,role) SELECT $1,'terceiro@exemplo.com','Terceiro Doador',password_hash,'donor' FROM accounts WHERE email='ana@exemplo.com'`,
      [randomUUID()],
    );
    server = createApp(apiPool).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const request = (path: string, token?: string, method = 'GET', body?: unknown) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const login = async (email: string, password: string) => {
      const r = await request('/v1/auth/login', undefined, 'POST', { email, password });
      assert.equal(r.status, 200);
      return (await r.json()).token as string;
    };
    assert.equal(
      (
        await request('/v1/auth/login', undefined, 'POST', {
          email: 'ana@exemplo.com',
          password: 'errada',
        })
      ).status,
      401,
    );
    const ana = await login('ana@exemplo.com', donorPassword),
      lucas = await login('lucas@exemplo.com', donorPassword),
      third = await login('terceiro@exemplo.com', donorPassword);
    const admin = await login('renata@unidade.exemplo', adminPassword),
      jardim = await login('equipe.jardim@unidade.exemplo', adminPassword);
    for (const invalid of [
      { name: 'Nome', email: 'email-inválido', password: 'CadastroTeste2026!' },
      { name: 'Nome', email: 'valido@exemplo.com', password: 'curta' },
      {
        name: 'Nome',
        email: 'valido@exemplo.com',
        password: 'CadastroTeste2026!',
        unitId: 'centro',
      },
    ]) {
      assert.equal((await request('/v1/auth/register', undefined, 'POST', invalid)).status, 400);
    }
    assert.equal(
      (
        await request('/v1/auth/register', undefined, 'POST', {
          name: 'Novo Doador',
          email: 'novo@exemplo.com',
          password: 'CadastroTeste2026!',
          role: 'admin',
        })
      ).status,
      400,
    );
    const registration = await request('/v1/auth/register', undefined, 'POST', {
      name: 'Novo Doador',
      email: 'novo@exemplo.com',
      password: 'CadastroTeste2026!',
    });
    assert.equal(registration.status, 201);
    const newAccount = await registration.json();
    assert.equal(newAccount.user.role, 'donor');
    assert.equal(newAccount.user.unitId, null);
    assert.equal(newAccount.user.password_hash, undefined);
    assert.equal((await request('/v1/me', newAccount.token)).status, 200);
    assert.equal(
      (
        await request('/v1/auth/register', undefined, 'POST', {
          name: 'Novo Doador',
          email: 'novo@exemplo.com',
          password: 'CadastroTeste2026!',
        })
      ).status,
      409,
    );
    assert.equal(
      (await apiPool.query("SELECT has_column_privilege('accounts','role','INSERT') AS allowed"))
        .rows[0].allowed,
      false,
    );
    assert.equal((await request('/v1/appointments/events', ana)).status, 403);
    const streamAbort = new AbortController();
    const stream = await fetch(`${base}/v1/appointments/events`, {
      headers: { Authorization: `Bearer ${admin}` },
      signal: streamAbort.signal,
    });
    assert.equal(stream.status, 200);
    const reader = stream.body!.getReader();
    const ready = await reader.read();
    assert.ok(new TextDecoder().decode(ready.value).includes('event: ready'));
    assert.equal(
      (await pool.query('SELECT count(*)::int n FROM sessions WHERE token_hash=$1', [ana])).rows[0]
        .n,
      0,
    );
    assert.equal(
      (
        await pool.query('SELECT count(*)::int n FROM sessions WHERE token_hash=$1', [
          tokenHash(ana),
        ])
      ).rows[0].n,
      1,
    );
    const slots = (await (await request('/v1/slots?unitId=centro', ana)).json()).slots;
    const slot = slots[0];
    assert.equal(slot.available, 2);
    const create = (token: string, slotId = slot.id, id = randomUUID()) =>
      request('/v1/appointments', token, 'POST', { slotId, requestId: id });
    assert.equal((await create(admin)).status, 403);
    assert.equal(
      (
        await request('/v1/appointments', ana, 'POST', {
          slotId: slot.id,
          requestId: randomUUID(),
          donorId: 'outra-pessoa',
          bloodType: 'O+',
        })
      ).status,
      400,
    );
    const idempotency = randomUUID();
    const first = await create(ana, slot.id, idempotency);
    assert.equal(first.status, 201);
    const firstId = (await first.json()).id;
    const event = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Atualização automática não recebida.')), 2000),
      ),
    ]);
    assert.ok(new TextDecoder().decode(event.value).includes('appointments-changed'));
    await reader.cancel();
    streamAbort.abort();
    const repeated = await create(ana, slot.id, idempotency);
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).id, firstId);
    const contention = await Promise.all([create(lucas), create(third)]);
    assert.deepEqual(contention.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      (
        await pool.query(
          `SELECT count(*)::int n FROM appointments WHERE slot_id=$1 AND status='booked'`,
          [slot.id],
        )
      ).rows[0].n,
      2,
    );
    assert.equal((await create(ana, slots[1].id)).status, 409);
    const mine = (await (await request('/v1/appointments', ana)).json()).appointments;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].donorName, undefined);
    assert.equal((await request(`/v1/appointments/${firstId}/cancel`, lucas, 'POST')).status, 404);
    assert.equal((await request(`/v1/appointments/${firstId}/cancel`, jardim, 'POST')).status, 404);
    assert.equal((await (await request('/v1/appointments', jardim)).json()).appointments.length, 0);
    const team = (await (await request('/v1/appointments', admin)).json()).appointments;
    assert.equal(team.length, 2);
    assert.ok(team.some((a: { donorName: string }) => a.donorName === 'Ana Oliveira'));
    assert.equal(team[0].email, undefined);
    assert.equal(team[0].password_hash, undefined);
    const exportData = await (await request('/v1/me/export', ana)).json();
    assert.equal(exportData.user.email, 'ana@exemplo.com');
    assert.equal(exportData.appointments.length, 1);
    assert.equal(JSON.stringify(exportData).includes('password_hash'), false);
    assert.equal((await request('/v1/me', ana, 'PATCH', { name: 'Ana Atualizada' })).status, 200);
    assert.equal(
      (await request('/v1/me', ana, 'PATCH', { name: 'Ana', role: 'admin' })).status,
      400,
    );
    assert.equal((await request(`/v1/appointments/${firstId}/cancel`, ana, 'POST')).status, 204);
    assert.equal((await create(ana, slot.id, idempotency)).status, 409);
    const newBooking = await create(ana);
    assert.equal(newBooking.status, 201);
    const publish = {
      id: randomUUID(),
      title: 'Alerta de teste',
      message: 'Mobilização fictícia',
      bloodType: 'O-',
      region: 'Ourinhos, SP',
      cpf: 'NÃO ARMAZENAR',
      recipientIds: ['NÃO ARMAZENAR'],
    };
    assert.equal((await request('/demo/alerts', ana, 'POST', publish)).status, 403);
    assert.equal((await request('/demo/alerts', admin, 'POST', publish)).status, 410);
    assert.equal((await request('/demo/alerts', jardim, 'POST', publish)).status, 410);
    const alerts = (await (await request('/demo/alerts')).json()).alerts;
    assert.equal(alerts.length, 0);
    assert.equal(JSON.stringify(alerts).includes('NÃO ARMAZENAR'), false);
    // Uma nova instância de aplicação encontra o mesmo estado no PostgreSQL.
    await new Promise<void>((resolve, reject) => server!.close((e) => (e ? reject(e) : resolve())));
    server = createApp(apiPool).listen(0, '127.0.0.1');
    await once(server, 'listening');
    assert.equal((await pool.query('SELECT count(*)::int n FROM appointments')).rows[0].n, 3);
    // O cliente antigo é encerrado: validação da sessão/revogação com outra instância HTTP.
    const nextAddress = server.address();
    assert.ok(nextAddress && typeof nextAddress === 'object');
    const nextBase = `http://127.0.0.1:${nextAddress.port}`;
    const again = await fetch(`${nextBase}/v1/appointments`, {
      headers: { Authorization: `Bearer ${ana}` },
    });
    assert.equal((await again.json()).appointments.length, 2);
    const deleteResponse = await fetch(`${nextBase}/v1/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ana}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'EXCLUIR' }),
    });
    assert.equal(deleteResponse.status, 204);
    assert.equal(
      (await fetch(`${nextBase}/v1/appointments`, { headers: { Authorization: `Bearer ${ana}` } }))
        .status,
      401,
    );
    assert.equal(
      (await pool.query(`SELECT count(*)::int n FROM accounts WHERE email='ana@exemplo.com'`))
        .rows[0].n,
      0,
    );
    assert.equal(
      (
        await pool.query(
          `SELECT count(*)::int n FROM appointments a JOIN accounts u ON u.id=a.donor_id WHERE u.email='ana@exemplo.com'`,
        )
      ).rows[0].n,
      0,
    );
    await fetch(`${nextBase}/v1/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin}` },
    });
    assert.equal(
      (
        await fetch(`${nextBase}/v1/appointments`, {
          headers: { Authorization: `Bearer ${admin}` },
        })
      ).status,
      401,
    );
    assert.ok((await pool.query('SELECT count(*)::int n FROM audit_events')).rows[0].n > 0);
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    if (apiPool) await apiPool.end();
    await pool.end();
    await owner.query(`DROP SCHEMA ${schema} CASCADE`);
    await owner.end();
  }
});
