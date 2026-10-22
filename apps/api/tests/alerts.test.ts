import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../src/app.ts';

test('recusa publicação anônima, restringe origem e não expõe dados ou erros internos', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${base}/demo/health`)).status, 200);
    assert.equal(
      (
        await fetch(`${base}/demo/alerts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      401,
    );
    assert.equal(
      (await fetch(`${base}/demo/alerts`, { headers: { Origin: 'https://outro.exemplo' } })).status,
      403,
    );
    const options = await fetch(`${base}/v1/appointments`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8081' },
    });
    assert.equal(options.status, 204);
    assert.ok(options.headers.get('Access-Control-Allow-Headers')?.includes('Authorization'));
    assert.equal((await fetch(`${base}/v1/appointments`)).status, 401);
    const broken = await fetch(`${base}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    assert.equal(broken.status, 400);
    assert.deepEqual(await broken.json(), { error: 'JSON inválido.' });
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 503);
    assert.equal(health.headers.get('Cache-Control'), 'no-store');
    const privacy = await (await fetch(`${base}/privacy`)).json();
    assert.ok(privacy.notCollected.includes('CPF'));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
