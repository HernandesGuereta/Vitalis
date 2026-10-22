import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  campaignRecipients,
  createOfficeDemo,
  registerDonation,
  restoreOffice,
  saveCampaign,
  saveDonor,
} from '../src/renderer/src/prototype/office.ts';

const demo = () => createOfficeDemo(new Date('2026-10-22T15:00:00-03:00'));

test('restaura a demonstração administrativa sem perder os vínculos', () => {
  const data = demo();
  assert.deepEqual(restoreOffice(JSON.stringify(data)), data);
  assert.throws(() => restoreOffice('{}'));
  assert.throws(() =>
    restoreOffice(
      JSON.stringify({ ...data, donations: [{ ...data.donations[0], donorId: 'inexistente' }] }),
    ),
  );
  assert.throws(() =>
    restoreOffice(JSON.stringify({ ...data, donors: [data.donors[0], data.donors[0]] })),
  );
});

test('salva e edita um doador preservando os registros anteriores', () => {
  const original = demo();
  const person = { ...original.donors[0]!, id: 'new', name: 'Doador fictício', cpf: 'DEMO-011' };
  const added = saveDonor(original, person);
  assert.equal(added.donors.length, 11);
  assert.equal(original.donors.length, 10);
  const edited = saveDonor(added, { ...person, name: 'Nome atualizado' });
  assert.equal(edited.donors.length, 11);
  assert.equal(edited.donors.find((d) => d.id === 'new')!.name, 'Nome atualizado');
  assert.throws(() => saveDonor(added, { ...person, id: 'duplicate' }), /identificação/);
});

test('doação exige doador cadastrado e conclui o atendimento correspondente', () => {
  const data = demo();
  const record = {
    id: 'new',
    donorId: 'DOA-001',
    date: '2026-10-22',
    type: 'Sangue total',
    note: 'Exemplo',
  };
  assert.throws(
    () => registerDonation(data, { ...record, donorId: 'inexistente' }),
    /doador cadastrado/,
  );
  const next = registerDonation(data, record);
  assert.equal(next.donations.length, data.donations.length + 1);
  assert.equal(next.appointments.find((a) => a.donorId === 'DOA-001')!.status, 'Concluído');
  assert.throws(() => registerDonation(next, record), /já foi registrada/);
});

test('público de campanha respeita tipo sanguíneo, cidade e canais autorizados', () => {
  const data = demo();
  const campaign = data.campaigns[0]!;
  assert.deepEqual(campaignRecipients(data, campaign), ['DOA-003']);
  assert.deepEqual(campaignRecipients(data, { ...campaign, region: 'Outra cidade' }), []);
  assert.deepEqual(campaignRecipients(data, { ...campaign, channels: [] }), []);
  const noConsent = { ...data, donors: data.donors.map((d) => ({ ...d, channels: [] })) };
  assert.deepEqual(campaignRecipients(noConsent, campaign), []);
});

test('simulação de envio mantém uma única campanha e guarda o público selecionado', () => {
  const data = demo();
  const draft = { ...data.campaigns[0]!, id: 'new' };
  const saved = saveCampaign(data, draft);
  const sent = saveCampaign(saved, { ...draft, status: 'sent' });
  assert.equal(sent.campaigns.length, data.campaigns.length + 1);
  assert.equal(sent.campaigns[0]!.status, 'sent');
  assert.deepEqual(sent.campaigns[0]!.recipientIds, ['DOA-003']);
  assert.throws(
    () => saveCampaign(data, { ...draft, status: 'sent', region: 'Outra cidade' }),
    /Nenhum doador/,
  );
});
