import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMovement, createDemo, getStock, getWeekActivity, restoreDemo } from '../src/renderer/src/prototype/model.ts';
import type { Movement } from '../src/renderer/src/prototype/model.ts';

const now = new Date('2026-10-21T15:00:00-03:00');
const demo = () => createDemo(now);
const movement = (overrides: Partial<Movement> = {}): Movement => ({
  id: 'test-movement', bloodType: 'O+', kind: 'entrada', quantity: 5,
  reason: 'Coleta simulada', note: 'Teste de movimentação',
  createdAt: now.toISOString(), responsible: 'Marina Costa', ...overrides,
});
const amount = (data: ReturnType<typeof demo>, type = 'O+') => getStock(data).find((item) => item.bloodType === type)!.quantity;

test('a demonstração mantém oito tipos, saldos consistentes e referências ilustrativas', () => {
  const stock = getStock(demo());
  assert.equal(stock.length, 8);
  assert.equal(stock.reduce((sum, item) => sum + item.quantity, 0), 221);
  assert.equal(stock.filter((item) => item.status === 'critico').length, 3);
  assert.equal(stock.find((item) => item.bloodType === 'A-')!.status, 'baixo');
  assert.ok(demo().movements.every((item) => Date.parse(item.createdAt) <= now.getTime()));
});

test('entrada e saída atualizam o saldo e preservam o histórico anterior', () => {
  const original = demo();
  const entered = addMovement(original, movement());
  const exited = addMovement(entered, movement({ id: 'exit', kind: 'saida', reason: 'Uso simulado', quantity: 3 }));
  assert.equal(amount(original), 84);
  assert.equal(amount(entered), 89);
  assert.equal(amount(exited), 86);
  assert.equal(original.movements.length, 8);
  assert.equal(exited.movements.length, 10);
});

test('saída pode zerar um tipo mas não pode tornar o estoque negativo', () => {
  assert.throws(() => addMovement(demo(), movement({ kind: 'saida', reason: 'Uso simulado', quantity: 85 })), /apenas 84/);
  const empty = addMovement(demo(), movement({ kind: 'saida', reason: 'Uso simulado', quantity: 84 }));
  assert.equal(amount(empty), 0);
  assert.throws(() => addMovement(empty, movement({ id: 'again', kind: 'saida', reason: 'Uso simulado', quantity: 1 })), /apenas 0/);
});

test('rejeita quantidades inválidas, motivos incompatíveis e registros duplicados', () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity, 10001]) {
    assert.throws(() => addMovement(demo(), movement({ quantity })), /quantidade inteira/);
  }
  assert.throws(() => addMovement(demo(), movement({ reason: 'Uso simulado' })), /motivo válido/);
  assert.throws(() => addMovement(addMovement(demo(), movement()), movement()), /já foi registrada/);
});

test('restaura os dados salvos com o mesmo estoque e rejeita dados corrompidos', () => {
  const saved = addMovement(demo(), movement());
  assert.deepEqual(restoreDemo(JSON.stringify(saved)), saved);
  assert.throws(() => restoreDemo('{'));
  assert.throws(() => restoreDemo('{"version":2,"movements":[]}'));
  assert.throws(() => restoreDemo('{"version":1,"movements":[{}]}'));
  assert.throws(() => restoreDemo(JSON.stringify({ version: 1, movements: [movement({ kind: 'saida', reason: 'Uso simulado', quantity: 999 })] })), /apenas 70/);
});

test('o gráfico soma apenas os registros dos sete dias do período', () => {
  const data = addMovement(demo(), movement({ id: 'old', quantity: 100, createdAt: '2026-09-01T12:00:00-03:00' }));
  const week = getWeekActivity(data, now);
  assert.equal(week.length, 7);
  assert.equal(week.reduce((sum, day) => sum + day.incoming, 0), 37);
  assert.equal(week.reduce((sum, day) => sum + day.outgoing, 0), 18);
});
