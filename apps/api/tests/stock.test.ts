import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { Pool } from 'pg';
import { migrate } from '../src/db/migrate.ts';
import { grantRuntimeRole } from '../src/db/runtimeRole.ts';
import { seed } from '../src/db/seed.ts';
import { createApp } from '../src/app.ts';
import { targets, stockLevel } from '../src/stock.ts';
import { deliverPush } from '../src/push.ts';

test('escassez automática: PostgreSQL, idempotência, limiares, reposição e fila push', async () => {
  const connectionString = process.env.TEST_DATABASE_URL!;
  assert.ok(connectionString);
  assert.match(new URL(connectionString).pathname, /test/i);
  const schema = `vitalis_stock_${randomUUID().replaceAll('-', '')}`;
  const owner = new Pool({ connectionString });
  await owner.query(`CREATE SCHEMA ${schema}`);
  const db = new Pool({
    connectionString,
    options: `-c search_path=${schema}`,
  });
  let runtime: Pool | undefined,
    server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
  try {
    await migrate(db);
    await migrate(db);
    await seed(db, 'fixture-donor-stock-password', 'fixture-admin-stock-password');
    await grantRuntimeRole(db);
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = new URL(connectionString).pathname;
    runtime = new Pool({
      connectionString: url.toString(),
      options: `-c search_path=${schema}`,
    });
    const listen = async () => {
      server = createApp(runtime).listen(0, '127.0.0.1');
      await once(server, 'listening');
      return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    };
    let base = await listen();
    const request = (path: string, token?: string, method = 'GET', body?: unknown) =>
      fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const login = async (email: string, password: string) =>
      (
        await (
          await request('/v1/auth/login', undefined, 'POST', {
            email,
            password,
          })
        ).json()
      ).token;
    const admin = await login('renata@unidade.exemplo', 'fixture-admin-stock-password');
    const jardim = await login('equipe.jardim@unidade.exemplo', 'fixture-admin-stock-password');
    const donor = await login('ana@exemplo.com', 'fixture-donor-stock-password');
    for (const target of Object.values(targets)) {
      assert.equal(stockLevel(target * 0.25, target), 'critico');
      assert.equal(stockLevel(target * 0.5, target), 'baixo');
      assert.equal(stockLevel(target * 0.5 + 1, target), 'adequado');
    }
    const subscription = {
      token: 'ExpoPushToken[fixture-device-12345]',
      city: 'Ourinhos, SP',
      bloodType: 'O+',
      ownType: true,
      otherTypes: false,
      consent: true,
    };
    assert.equal(
      (
        await request('/v1/push/subscriptions', donor, 'POST', {
          ...subscription,
          consent: false,
        })
      ).status,
      400,
    );
    assert.equal(
      (await request('/v1/push/subscriptions', admin, 'POST', subscription)).status,
      403,
    );
    assert.equal(
      (await request('/v1/push/subscriptions', donor, 'POST', subscription)).status,
      201,
    );
    let revision = 0;
    let quantities = { ...targets } as Record<string, number>;
    const sync = async (q = quantities) => {
      const response = await request('/v1/stock/sync', admin, 'POST', {
        requestId: randomUUID(),
        revision,
        quantities: q,
      });
      assert.equal(response.status, 200, await response.clone().text());
      revision = (await response.json()).revision;
    };
    const alerts = async () => (await (await request('/demo/alerts')).json()).alerts;
    await sync();
    assert.equal((await alerts()).length, 0);
    assert.equal((await request('/v1/stock/sync', donor, 'POST', {})).status, 403);
    assert.equal(
      (
        await request('/v1/stock/sync', admin, 'POST', {
          requestId: randomUUID(),
          revision,
          quantities: { ...quantities, 'O+': -1 },
        })
      ).status,
      400,
    );
    quantities = { ...quantities, 'O+': 50 };
    const body = { requestId: randomUUID(), revision, quantities };
    const concurrent = await Promise.all([
      request('/v1/stock/sync', admin, 'POST', body),
      request('/v1/stock/sync', admin, 'POST', body),
    ]);
    assert.deepEqual(
      concurrent.map((r) => r.status),
      [200, 200],
    );
    revision = (await concurrent[0].json()).revision;
    const low = (await alerts())[0];
    assert.equal(low.level, 'baixo');
    assert.match(low.title, /O\+/);
    assert.equal((await db.query('SELECT count(*)::int n FROM push_deliveries')).rows[0].n, 1);
    await sync();
    assert.equal((await alerts())[0].id, low.id);
    assert.equal(
      (
        await request('/v1/stock/sync', admin, 'POST', {
          ...body,
          requestId: randomUUID(),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request('/v1/stock/sync', admin, 'POST', {
          ...body,
          quantities: { ...quantities, 'O+': 40 },
        })
      ).status,
      409,
    );
    const other = (await (await request('/v1/stock/alerts', jardim)).json()).alerts;
    assert.equal(other.length, 0);
    assert.equal((await request('/demo/alerts', admin, 'POST', {})).status, 410);
    quantities = { ...quantities, 'O+': 25 };
    await sync();
    assert.equal((await alerts())[0].level, 'critico');
    assert.equal((await db.query('SELECT count(*)::int n FROM push_deliveries')).rows[0].n, 2);
    quantities = { ...quantities, 'O+': 40 };
    await sync();
    quantities = { ...quantities, 'O+': 20 };
    await sync();
    assert.equal(
      (await db.query('SELECT count(*)::int n FROM push_deliveries')).rows[0].n,
      2,
      'oscilar no mesmo episódio não repete a mensagem',
    );
    let sends = 0,
      fail = true;
    const transport = {
      send: async () => {
        sends++;
        if (fail) throw new Error('rede de teste');
        return { status: 'ok' as const, id: randomUUID() };
      },
      receipt: async () => ({ status: 'ok' as const }),
    };
    await deliverPush(runtime, transport);
    assert.equal(sends, 1);
    await db.query('UPDATE push_deliveries SET next_attempt_at=now()');
    fail = false;
    await Promise.all([deliverPush(runtime, transport), deliverPush(runtime, transport)]);
    assert.equal(sends, 2, 'dois workers não enviam simultaneamente a mesma entrega');
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM push_deliveries WHERE status='submitted'"))
        .rows[0].n,
      1,
    );
    await db.query('UPDATE push_deliveries SET next_attempt_at=now()');
    await deliverPush(runtime, transport);
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM push_deliveries WHERE status='receipt_ok'"))
        .rows[0].n,
      1,
    );
    quantities = { ...quantities, 'O+': 51 };
    await sync();
    assert.equal((await alerts()).length, 0);
    quantities = { ...quantities, 'O+': 50 };
    await sync();
    assert.notEqual((await alerts())[0].id, low.id);
    // Preferências alteradas/revogadas são conferidas antes de enviar uma fila pendente.
    assert.equal(
      (
        await request('/v1/push/preferences', donor, 'PATCH', {
          city: 'Ourinhos, SP',
          bloodType: 'O+',
          ownType: false,
          otherTypes: false,
        })
      ).status,
      204,
    );
    await deliverPush(runtime, transport);
    assert.equal(sends, 2);
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM push_deliveries WHERE status='cancelled'"))
        .rows[0].n,
      2,
    );
    await request('/v1/push/subscriptions', donor, 'DELETE');
    assert.equal((await db.query('SELECT count(*)::int n FROM push_subscriptions')).rows[0].n, 0);
    const exported = await (await request('/v1/me/export', donor)).text();
    assert.ok(!exported.includes(subscription.token));
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    base = await listen();
    assert.equal((await alerts()).length, 1, 'avisos sobrevivem ao reinício');
    quantities = { ...quantities, 'O+': 100 };
    await sync();
    assert.equal((await alerts()).length, 0);
    await request('/v1/push/subscriptions', donor, 'POST', subscription);
    quantities = { ...quantities, 'O+': 0 };
    await sync();
    await deliverPush(runtime, {
      send: async () => ({ status: 'error', details: { error: 'DeviceNotRegistered' } }),
      receipt: async () => undefined,
    });
    assert.equal(
      (await db.query('SELECT count(*)::int n FROM push_subscriptions')).rows[0].n,
      0,
      'token inválido é removido',
    );
    await request('/v1/push/subscriptions', donor, 'POST', subscription);
    await request('/v1/auth/logout', donor, 'POST');
    assert.equal(
      (await db.query('SELECT count(*)::int n FROM push_subscriptions')).rows[0].n,
      0,
      'sair revoga aparelhos',
    );
    const returned = await login('ana@exemplo.com', 'fixture-donor-stock-password');
    await request('/v1/push/subscriptions', returned, 'POST', subscription);
    await request('/v1/me', returned, 'DELETE', { confirmation: 'EXCLUIR' });
    assert.equal(
      (await db.query('SELECT count(*)::int n FROM push_subscriptions')).rows[0].n,
      0,
      'excluir conta remove aparelhos',
    );
  } finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    await runtime?.end();
    await db.end();
    await owner.query(`DROP SCHEMA ${schema} CASCADE`);
    await owner.end();
  }
});
