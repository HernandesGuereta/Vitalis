import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateScreening, screeningQuestions } from '../src/data/screening.ts';
import type { ScreeningAnswers } from '../src/data/screening.ts';

const baseline: ScreeningAnswers = {
  age: 'adult',
  weight: 'yes',
  well: 'yes',
  prepared: 'yes',
  alcohol: 'no',
  care: 'no',
  pregnancy: 'not_applicable',
  lastDonation: 'never',
};
test('respostas incompletas ou inválidas nunca produzem uma orientação favorável', () => {
  assert.equal(evaluateScreening({}).status, 'incomplete');
  for (const question of screeningQuestions(baseline)) {
    assert.equal(evaluateScreening({ ...baseline, [question.id]: undefined }).status, 'incomplete');
    assert.equal(
      evaluateScreening({ ...baseline, [question.id]: 'valor inválido' }).status,
      'incomplete',
    );
    assert.equal(evaluateScreening({ ...baseline, [question.id]: 'unknown' }).status, 'guidance');
  }
});
test('orientação sem alertas é limitada às perguntas e não libera a doação', () => {
  const result = evaluateScreening(baseline);
  assert.equal(result.status, 'no_flags');
  assert.match(result.description, /não confirma/);
  assert.equal(evaluateScreening({ ...baseline, lastDonation: 'over90' }).status, 'no_flags');
});
test('cuidados para adiar têm prioridade e incluem todos os motivos', () => {
  for (const [key, value] of [
    ['age', 'under16'],
    ['weight', 'no'],
    ['well', 'no'],
    ['prepared', 'no'],
    ['alcohol', 'yes'],
  ])
    assert.equal(evaluateScreening({ ...baseline, [key!]: value }).status, 'not_now');
  const result = evaluateScreening({ ...baseline, weight: 'no', well: 'no', care: 'yes' });
  assert.equal(result.status, 'not_now');
  assert.equal(result.reasons.length, 3);
});
test('medicação, gestação, intervalo e dúvidas pedem orientação individual sem declarar inaptidão', () => {
  for (const [key, value] of [
    ['care', 'yes'],
    ['pregnancy', 'yes'],
    ['lastDonation', 'recent'],
  ])
    assert.equal(evaluateScreening({ ...baseline, [key!]: value }).status, 'guidance');
  assert.match(evaluateScreening({ ...baseline, care: 'yes' }).reasons.join(' '), /Não suspenda/);
});
test('idades condicionais e exceção de doadores regulares a partir dos 70 anos', () => {
  const teen = { ...baseline, age: 'teen' };
  assert.equal(screeningQuestions(teen).length, 9);
  assert.equal(screeningQuestions(teen)[1]!.id, 'guardian');
  assert.equal(evaluateScreening(teen).status, 'incomplete');
  for (const guardian of ['yes', 'no', 'unknown'])
    assert.equal(evaluateScreening({ ...teen, guardian }).status, 'guidance');
  const senior = { ...baseline, age: 'senior' };
  assert.equal(evaluateScreening(senior).status, 'incomplete');
  assert.equal(evaluateScreening({ ...senior, previousBefore60: 'yes' }).status, 'no_flags');
  assert.equal(evaluateScreening({ ...senior, previousBefore60: 'no' }).status, 'guidance');
  assert.equal(evaluateScreening({ ...baseline, age: 'older' }).status, 'guidance');
  assert.equal(screeningQuestions(baseline).length, 8);
  assert.equal(
    evaluateScreening({ ...baseline, guardian: 'no', previousBefore60: 'no' }).status,
    'no_flags',
  );
});
