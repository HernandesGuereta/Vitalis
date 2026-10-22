import { bloodTypes, donors as previousDonors } from './model.ts';
import type { BloodType } from './model.ts';

export const administrator = 'Renata Costa';
export const channels = ['E-mail', 'WhatsApp'] as const;
export type Channel = (typeof channels)[number];
export interface Donor {
  id: string;
  name: string;
  bloodType: BloodType;
  cpf: string;
  birthDate: string;
  email: string;
  phone: string;
  city: string;
  channels: Channel[];
  screening: boolean;
}
export interface Donation {
  id: string;
  donorId: string;
  date: string;
  type: string;
  note: string;
}
export interface Appointment {
  id: string;
  donorId: string;
  date: string;
  time: string;
  status: 'Agendado' | 'Concluído';
}
export interface Campaign {
  id: string;
  title: string;
  bloodType: BloodType;
  region: string;
  channels: Channel[];
  message: string;
  status: 'draft' | 'sent';
  createdAt: string;
  recipientIds: string[];
}
export interface UnitSettings {
  name: string;
  city: string;
  phone: string;
  email: string;
  region: string;
}
export interface OfficeData {
  version: 1;
  donors: Donor[];
  donations: Donation[];
  appointments: Appointment[];
  campaigns: Campaign[];
  settings: UnitSettings;
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function formatDate(value: string) {
  return new Date(`${value}T12:00:00`)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .replaceAll('.', '');
}

export function createOfficeDemo(now = new Date()): OfficeData {
  const names = [
    'Ana Oliveira',
    'Beatriz Almeida',
    'Lucas Santos',
    'Pedro Ferreira',
    'Mariana Costa',
  ];
  const people = previousDonors.map((person, index): Donor => ({
    id: person.id,
    name: names[index] ?? person.name,
    bloodType: person.bloodType,
    cpf: `•••.•••.•••-${['42', '70', '18', '15', '29', '31', '52', '68', '83', '94'][index]}`,
    birthDate: '1996-05-12',
    email: `doador${index + 1}@exemplo.com`,
    phone: '(00) 00000-0000',
    city: index < 5 ? 'Ourinhos, SP' : person.city,
    channels: index % 2 === 0 ? ['E-mail', 'WhatsApp'] : ['E-mail'],
    screening: index < 3,
  }));
  return {
    version: 1,
    donors: people,
    donations: [
      {
        id: 'DOA-0142',
        donorId: 'DOA-003',
        date: localDate(now),
        type: 'Sangue total',
        note: 'Atendimento fictício.',
      },
      {
        id: 'DOA-0141',
        donorId: 'DOA-002',
        date: localDate(now),
        type: 'Sangue total',
        note: 'Atendimento fictício.',
      },
      {
        id: 'DOA-0140',
        donorId: 'DOA-004',
        date: localDate(now),
        type: 'Sangue total',
        note: 'Atendimento fictício.',
      },
      {
        id: 'DOA-0139',
        donorId: 'DOA-001',
        date: '2026-07-12',
        type: 'Sangue total',
        note: 'Histórico ilustrativo.',
      },
      {
        id: 'DOA-0138',
        donorId: 'DOA-001',
        date: '2026-03-09',
        type: 'Sangue total',
        note: 'Histórico ilustrativo.',
      },
    ],
    appointments: [
      { id: 'AG-001', donorId: 'DOA-003', date: localDate(now), time: '09:30', status: 'Agendado' },
      { id: 'AG-002', donorId: 'DOA-001', date: localDate(now), time: '10:00', status: 'Agendado' },
      { id: 'AG-003', donorId: 'DOA-004', date: localDate(now), time: '10:30', status: 'Agendado' },
    ],
    campaigns: [
      {
        id: 'ALT-001',
        title: 'Mobilização de doadores O−',
        bloodType: 'O-',
        region: 'Ourinhos, SP',
        channels: ['E-mail', 'WhatsApp'],
        message:
          'Olá! A Unidade Vitalis Centro precisa de doadores O−. Confira os horários disponíveis e prepare sua visita pelo Vitalis.',
        status: 'draft',
        createdAt: now.toISOString(),
        recipientIds: [],
      },
      {
        id: 'ALT-002',
        title: 'Reposição de estoque A−',
        bloodType: 'A-',
        region: 'Ourinhos, SP',
        channels: ['E-mail'],
        message: 'Seu gesto faz a diferença. Confira os horários da Unidade Centro.',
        status: 'sent',
        createdAt: now.toISOString(),
        recipientIds: ['DOA-006'],
      },
      {
        id: 'ALT-003',
        title: 'Acompanhamento de AB−',
        bloodType: 'AB-',
        region: 'Ourinhos, SP',
        channels: ['WhatsApp'],
        message: 'Acompanhe as necessidades da sua região.',
        status: 'sent',
        createdAt: now.toISOString(),
        recipientIds: [],
      },
    ],
    settings: {
      name: 'Vitalis Centro',
      city: 'Ourinhos, SP',
      phone: '(00) 0000-0000',
      email: 'contato@unidade.exemplo',
      region: 'Ourinhos, SP · até 30 km',
    },
  };
}

export function saveDonor(data: OfficeData, donor: Donor): OfficeData {
  if (
    !donor.name.trim() ||
    !donor.city.trim() ||
    !donor.cpf.trim() ||
    !donor.email.includes('@') ||
    !bloodTypes.includes(donor.bloodType)
  ) {
    throw new Error('Confira nome, identificação, e-mail, cidade e tipo sanguíneo.');
  }
  if (
    data.donors.some((item) => item.id !== donor.id && normalize(item.cpf) === normalize(donor.cpf))
  ) {
    throw new Error('Já existe um doador com essa identificação na demonstração.');
  }
  const clean = { ...donor, name: donor.name.trim(), city: donor.city.trim() };
  return {
    ...data,
    donors: data.donors.some((item) => item.id === donor.id)
      ? data.donors.map((item) => (item.id === donor.id ? clean : item))
      : [...data.donors, clean],
  };
}

export function registerDonation(data: OfficeData, donation: Donation): OfficeData {
  if (!data.donors.some((item) => item.id === donation.donorId))
    throw new Error('Selecione um doador cadastrado.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(donation.date) || !Number.isFinite(Date.parse(donation.date)))
    throw new Error('Informe uma data válida.');
  if (data.donations.some((item) => item.id === donation.id))
    throw new Error('Esta doação já foi registrada.');
  return {
    ...data,
    donations: [donation, ...data.donations],
    appointments: data.appointments.map((item) =>
      item.donorId === donation.donorId && item.date === donation.date
        ? { ...item, status: 'Concluído' }
        : item,
    ),
  };
}

export function campaignRecipients(
  data: OfficeData,
  campaign: Pick<Campaign, 'bloodType' | 'channels' | 'region'>,
) {
  const city = normalize(campaign.region.split('·')[0]!.trim());
  return data.donors
    .filter(
      (donor) =>
        donor.bloodType === campaign.bloodType &&
        normalize(donor.city) === city &&
        donor.channels.some((channel) => campaign.channels.includes(channel)),
    )
    .map((donor) => donor.id);
}

export function saveCampaign(data: OfficeData, campaign: Campaign): OfficeData {
  if (
    !campaign.title.trim() ||
    !campaign.message.trim() ||
    !campaign.region.trim() ||
    !campaign.channels.length
  ) {
    throw new Error('Informe título, região, mensagem e pelo menos um canal.');
  }
  const next = { ...campaign, recipientIds: campaignRecipients(data, campaign) };
  if (next.status === 'sent' && !next.recipientIds.length)
    throw new Error('Nenhum doador corresponde ao tipo, cidade e canais selecionados.');
  return {
    ...data,
    campaigns: data.campaigns.some((item) => item.id === next.id)
      ? data.campaigns.map((item) => (item.id === next.id ? next : item))
      : [next, ...data.campaigns],
  };
}

// Os dados locais também são conferidos antes de serem usados pela interface.
export function restoreOffice(raw: string): OfficeData {
  const value: unknown = JSON.parse(raw);
  const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
  const strings = (v: Record<string, unknown>, keys: string[]) =>
    keys.every((key) => typeof v[key] === 'string');
  const validChannels = (v: unknown) => Array.isArray(v) && v.every((c) => channels.includes(c));
  if (
    !object(value) ||
    value.version !== 1 ||
    !Array.isArray(value.donors) ||
    !Array.isArray(value.donations) ||
    !Array.isArray(value.appointments) ||
    !Array.isArray(value.campaigns) ||
    !object(value.settings) ||
    !strings(value.settings, ['name', 'city', 'phone', 'email', 'region'])
  )
    throw new Error('Dados administrativos inválidos.');
  if (
    !value.donors.every(
      (v) =>
        object(v) &&
        strings(v, ['id', 'name', 'cpf', 'email', 'phone', 'city', 'birthDate']) &&
        bloodTypes.includes(v.bloodType as BloodType) &&
        validChannels(v.channels) &&
        typeof v.screening === 'boolean',
    )
  )
    throw new Error('Doadores inválidos.');
  const ids = value.donors.map((d) => d.id as string);
  if (new Set(ids).size !== ids.length) throw new Error('Doadores duplicados.');
  if (
    !value.donations.every(
      (v) =>
        object(v) &&
        strings(v, ['id', 'donorId', 'date', 'type', 'note']) &&
        ids.includes(v.donorId as string),
    )
  )
    throw new Error('Doações inválidas.');
  if (
    !value.appointments.every(
      (v) =>
        object(v) &&
        strings(v, ['id', 'donorId', 'date', 'time']) &&
        ids.includes(v.donorId as string) &&
        ['Agendado', 'Concluído'].includes(v.status as string),
    )
  )
    throw new Error('Agendamentos inválidos.');
  if (
    !value.campaigns.every(
      (v) =>
        object(v) &&
        strings(v, ['id', 'title', 'region', 'message', 'createdAt']) &&
        bloodTypes.includes(v.bloodType as BloodType) &&
        validChannels(v.channels) &&
        ['draft', 'sent'].includes(v.status as string) &&
        Array.isArray(v.recipientIds) &&
        v.recipientIds.every((id) => ids.includes(id)),
    )
  )
    throw new Error('Alertas inválidos.');
  return value as unknown as OfficeData;
}
