import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, newToken, tokenHash, verifyPassword } from '../src/security.ts';
test('senhas têm salt independente e não podem ser verificadas com senha diferente', async () => {
  const password = 'senha-ficticia-para-teste';
  const a = await hashPassword(password);
  const b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.equal(a.includes(password), false);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword('outra-senha', a), false);
  assert.equal(await verifyPassword(password, 'scrypt:corrompido'), false);
  await assert.rejects(hashPassword('curta'));
});
test('tokens de sessão são aleatórios e persistidos somente como resumo', () => {
  const a = newToken();
  const b = newToken();
  assert.notEqual(a, b);
  assert.match(a, /^[\w-]{43}$/);
  assert.equal(tokenHash(a).length, 64);
  assert.notEqual(a, tokenHash(a));
});
