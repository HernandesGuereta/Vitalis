import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createApp } from '../src/app.ts';
import { migrate } from '../src/db/migrate.ts';
import { seed } from '../src/db/seed.ts';
import { grantRuntimeRole } from '../src/db/runtimeRole.ts';
import { tokenHash } from '../src/security.ts';

test('Agendamento: última vaga, repetição, expiração e reinício com PostgreSQL real', async (t) => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, 'Configure TEST_DATABASE_URL para um banco separado de testes.');
  assert.match(new URL(connectionString).pathname, /test/i);
  const schema = `vitalis_booking_${randomUUID().replaceAll('-', '')}`;
  const owner = new Pool({ connectionString });
  await owner.query(`CREATE SCHEMA ${schema}`);
  const db = new Pool({ connectionString, options: `-c search_path=${schema}` });
  let api: Pool | undefined;
  let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
  let base = '';
  async function start() {
    server = createApp(api).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    base = `http://127.0.0.1:${address.port}`;
  }
  async function stop() {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  const request = (path: string, token?: string, method = 'GET', body?: unknown) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    await migrate(db);
    await seed(db, 'fixture-donor-password', 'fixture-admin-password');
    await grantRuntimeRole(db);
    const runtimeUrl = new URL(process.env.DATABASE_URL!);
    assert.equal(runtimeUrl.username, 'vitalis_app');
    runtimeUrl.pathname = new URL(connectionString).pathname;
    api = new Pool({
      connectionString: runtimeUrl.toString(),
      options: `-c search_path=${schema}`,
    });
    await db.query(
      `INSERT INTO accounts(id,name,email,password_hash,role) SELECT $1,'Terceiro Teste','terceiro@exemplo.com',password_hash,'donor' FROM accounts WHERE email='ana@exemplo.com'`,
      [randomUUID()],
    );
    await start();
    const login = async (email: string, password = 'fixture-donor-password') => {
      const response = await request('/v1/auth/login', undefined, 'POST', { email, password });
      assert.equal(response.status, 200);
      return (await response.json()).token as string;
    };
    const ana = await login('ana@exemplo.com');
    const lucas = await login('lucas@exemplo.com');
    const third = await login('terceiro@exemplo.com');
    const admin = await login('renata@unidade.exemplo', 'fixture-admin-password');
    const slots = (await (await request('/v1/slots?unitId=centro', ana)).json()).slots;
    const first = slots[0],
      other = slots[1];
    const create = (token = ana, slotId = first.id, requestId = randomUUID()) =>
      request('/v1/appointments', token, 'POST', { slotId, requestId });
    const cancel = (id: string, token = ana) =>
      request(`/v1/appointments/${id}/cancel`, token, 'POST');
    const count = async (table: 'appointments' | 'audit_events') =>
      (await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n;
    const scenario = async (name: string, work: () => Promise<void>) => {
      await t.test(name, async () => {
        await db.query('TRUNCATE appointments,audit_events RESTART IDENTITY');
        await db.query('UPDATE slots SET capacity=2');
        await work();
      });
    };
    await scenario(
      'requisições simultâneas com a mesma tentativa criam somente uma reserva',
      async () => {
        const key = randomUUID();
        const responses = await Promise.all(
          Array.from({ length: 5 }, () => create(ana, first.id, key)),
        );
        assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 200, 200, 201]);
        const ids = await Promise.all(responses.map(async (r) => (await r.json()).id));
        assert.equal(new Set(ids).size, 1);
        assert.equal(await count('appointments'), 1);
        assert.equal(await count('audit_events'), 1);
        assert.equal((await create(ana, other.id, key)).status, 409);
      },
    );
    await scenario('três doadores disputam a última vaga sem exceder capacidade', async () => {
      await db.query('UPDATE slots SET capacity=1 WHERE id=$1', [first.id]);
      const responses = await Promise.all([create(ana), create(lucas), create(third)]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409, 409]);
      const available = (await (await request('/v1/slots?unitId=centro', ana)).json()).slots.find(
        (s: { id: string }) => s.id === first.id,
      );
      assert.equal(available.available, 0);
      assert.equal(await count('appointments'), 1);
    });
    await scenario('mesmo doador não consegue reservar duas unidades no mesmo dia', async () => {
      const jardim = (await (await request('/v1/slots?unitId=jardim', ana)).json()).slots.find(
        (s: { date: string }) => s.date === first.date,
      );
      const responses = await Promise.all([create(ana), create(ana, jardim.id)]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      assert.equal(await count('appointments'), 1);
    });
    await scenario(
      'cancelamento repetido por doador e unidade libera uma vaga e audita uma vez',
      async () => {
        const response = await create();
        assert.equal(response.status, 201);
        const id = (await response.json()).id;
        const responses = await Promise.all([cancel(id), cancel(id, admin), cancel(id)]);
        assert.deepEqual(
          responses.map((r) => r.status),
          [204, 204, 204],
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM audit_events WHERE action='appointment_cancelled'",
            )
          ).rows[0].n,
          1,
        );
        const available = (await (await request('/v1/slots?unitId=centro', ana)).json()).slots.find(
          (s: { id: string }) => s.id === first.id,
        );
        assert.equal(available.available, 2);
        assert.equal((await create()).status, 201);
      },
    );
    await scenario(
      'datas passadas e fora da janela são recusadas; histórico não oferece cancelamento',
      async () => {
        const past = randomUUID(),
          distant = randomUUID();
        await db.query(
          "INSERT INTO slots(id,unit_id,starts_at,capacity) VALUES($1,'centro',now()-interval '1 day',2),($2,'centro',now()+interval '20 days',2)",
          [past, distant],
        );
        assert.equal((await create(ana, past)).status, 409);
        assert.equal((await create(ana, distant)).status, 409);
        const id = randomUUID();
        await db.query(
          `INSERT INTO appointments(id,donor_id,slot_id,service_date,request_id) SELECT $1,a.id,s.id,(s.starts_at AT TIME ZONE 'America/Sao_Paulo')::date,$3 FROM accounts a CROSS JOIN slots s WHERE a.email='ana@exemplo.com' AND s.id=$2`,
          [id, past, randomUUID()],
        );
        const list = (await (await request('/v1/appointments', ana)).json()).appointments;
        assert.equal(list[0].slotId, past);
        assert.equal(list[0].canCancel, false);
        assert.equal((await cancel(id)).status, 409);
      },
    );
    await scenario('reiniciar a API preserva reserva, sessão e chave de repetição', async () => {
      const key = randomUUID();
      const response = await create(ana, first.id, key);
      const id = (await response.json()).id;
      await stop();
      await start();
      const repeated = await create(ana, first.id, key);
      assert.equal(repeated.status, 200);
      assert.equal((await repeated.json()).id, id);
      const list = (await (await request('/v1/appointments', ana)).json()).appointments;
      assert.equal(list[0].id, id);
      assert.equal(list[0].canCancel, true);
      assert.equal(await count('appointments'), 1);
    });
    await scenario('sessão expirada não cria reserva e novo login restaura o acesso', async () => {
      await db.query(
        "UPDATE sessions SET expires_at=now()-interval '1 minute' WHERE token_hash=$1",
        [tokenHash(ana)],
      );
      assert.equal((await create()).status, 401);
      assert.equal((await request('/v1/appointments', ana)).status, 401);
      assert.equal(await count('appointments'), 0);
      const next = await login('ana@exemplo.com');
      assert.equal((await create(next)).status, 201);
    });
  } finally {
    await stop();
    if (api) await api.end();
    await db.end();
    await owner.query(`DROP SCHEMA ${schema} CASCADE`);
    await owner.end();
  }
});
