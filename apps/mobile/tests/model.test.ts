import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bookVisit,
  createMobileDemo,
  exampleAlerts,
  isDate,
  nextDates,
  parseAlerts,
  restoreMobile,
  validateApiUrl,
  validateProfile,
  visibleAlerts,
} from '../src/data/model.ts';

test('restaura perfil, preferências e avisos; recusa dados corrompidos', () => {
  const data = createMobileDemo();
  assert.deepEqual(restoreMobile(JSON.stringify(data)), data);
  assert.throws(() => restoreMobile('{}'));
  assert.throws(() => restoreMobile(JSON.stringify({ ...data, preferences: { ownType: 'sim' } })));
  assert.throws(() => parseAlerts([{ ...exampleAlerts[0], bloodType: 'X+' }]));
  assert.throws(() => parseAlerts([exampleAlerts[0], exampleAlerts[0]]));
  assert.throws(() => parseAlerts([{ ...exampleAlerts[0], message: null }]));
  assert.equal(isDate('2026-02-30'), false);
  assert.equal(isDate('2026-99-99'), false);
});
test('filtra tipo exato, cidade e preferências sem sugerir compatibilidade clínica', () => {
  const { profile } = createMobileDemo();
  assert.equal(
    visibleAlerts(exampleAlerts, profile, { ownType: true, otherTypes: true }).length,
    2,
  );
  assert.deepEqual(
    visibleAlerts(
      exampleAlerts,
      { ...profile, city: 'ourinhos / sp' },
      { ownType: true, otherTypes: false },
    ).map((a) => a.bloodType),
    ['O+'],
  );
  assert.equal(
    visibleAlerts(
      exampleAlerts,
      { ...profile, city: 'Chavantes, SP' },
      { ownType: true, otherTypes: true },
    ).length,
    0,
  );
  assert.equal(
    visibleAlerts(exampleAlerts, profile, { ownType: false, otherTypes: false }).length,
    0,
  );
  assert.equal(
    visibleAlerts(exampleAlerts, profile, { ownType: false, otherTypes: true })[0]?.bloodType,
    'O-',
  );
});
test('reserva exige pré-triagem, data atual, horário e evita duas visitas no mesmo dia', () => {
  const demo = createMobileDemo();
  const visit = { id: 'exemplo', unitId: 'centro', date: nextDates()[0]!, time: '09:00' };
  assert.throws(() => bookVisit(demo, visit), /pré-triagem/);
  const ready = { ...demo, screeningDone: true };
  const result = bookVisit(ready, visit);
  assert.equal(result.visits.length, 1);
  assert.equal(ready.visits.length, 0);
  assert.throws(() => bookVisit(result, { ...visit, id: 'outro' }), /nesse dia/);
  assert.throws(() => bookVisit(ready, { ...visit, date: '2020-01-01' }));
  assert.throws(() => bookVisit(ready, { ...visit, time: '23:00' }));
  assert.deepEqual(nextDates(new Date(2026, 11, 30, 12)).slice(0, 2), ['2026-12-31', '2027-01-01']);
});
test('valida perfil e endereço; não aceita senha ou caminho na URL', () => {
  const { profile } = createMobileDemo();
  assert.throws(() => validateProfile({ ...profile, email: 'invalido' }));
  assert.equal(validateApiUrl(' http://192.168.1.10:3000/ '), 'http://192.168.1.10:3000');
  for (const address of [
    'file:///etc/passwd',
    'http://user:pass@localhost:3000',
    'http://localhost:3000/demo',
    'localhost:3000',
    'http://localhost:3000?x=1',
  ])
    assert.throws(() => validateApiUrl(address));
});
