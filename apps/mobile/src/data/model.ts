export const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Não sei'] as const;
export type BloodType = (typeof bloodTypes)[number];
export type Profile = { name: string; email: string; city: string; bloodType: BloodType };
export type Preferences = { ownType: boolean; otherTypes: boolean };
export type MobileAlert = {
  id: string;
  title: string;
  message: string;
  bloodType: string;
  region: string;
  unitName: string;
  level: 'critico' | 'baixo' | 'mobilizacao';
  publishedAt: string;
};
export type Visit = { id: string; unitId: string; date: string; time: string };
export type MobileData = {
  version: 1;
  profile: Profile;
  preferences: Preferences;
  screeningDone: boolean;
  visits: Visit[];
  readAlertIds: string[];
  remoteAlerts: MobileAlert[];
  apiUrl: string;
};
export const units = [
  {
    id: 'centro',
    name: 'Unidade Vitalis Centro',
    area: 'Centro · Ourinhos, SP',
    distance: '2,4 km',
    city: 'Ourinhos, SP',
  },
  {
    id: 'jardim',
    name: 'Unidade Jardim Paulista',
    area: 'Jardim Paulista · Ourinhos, SP',
    distance: '5,1 km',
    city: 'Ourinhos, SP',
  },
];
export const exampleAlerts: MobileAlert[] = [
  {
    id: 'exemplo-o-negativo',
    title: 'Doadores O−, a região precisa de vocês.',
    message: 'Um chamado da Unidade Vitalis Centro. Confira onde doar e prepare sua visita.',
    bloodType: 'O-',
    region: 'Ourinhos, SP',
    unitName: 'Unidade Vitalis Centro',
    level: 'critico',
    publishedAt: '2026-10-22T12:00:00.000Z',
  },
  {
    id: 'exemplo-o-positivo',
    title: 'Seu tipo pode fazer a diferença.',
    message: 'Há horários demonstrativos disponíveis na Unidade Centro.',
    bloodType: 'O+',
    region: 'Ourinhos, SP',
    unitName: 'Unidade Vitalis Centro',
    level: 'baixo',
    publishedAt: '2026-10-22T11:00:00.000Z',
  },
];
export function createMobileDemo(): MobileData {
  return {
    version: 1,
    profile: {
      name: 'Ana Oliveira',
      email: 'ana@exemplo.com',
      city: 'Ourinhos, SP',
      bloodType: 'O+',
    },
    preferences: { ownType: true, otherTypes: true },
    screeningDone: false,
    visits: [],
    readAlertIds: [],
    remoteAlerts: [],
    apiUrl: '',
  };
}
export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s*[,/]\s*/g, ',')
    .trim();
}
export function validateProfile(profile: Profile): Profile {
  if (profile.name.trim().length < 3 || profile.name.length > 100)
    throw new Error('Informe seu nome completo, com até 100 caracteres.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim()) || profile.email.length > 120)
    throw new Error('Confira o e-mail informado.');
  if (profile.city.trim().length < 3 || profile.city.length > 100)
    throw new Error('Informe sua cidade e UF. Exemplo: Ourinhos, SP.');
  if (!bloodTypes.includes(profile.bloodType))
    throw new Error('Selecione seu tipo sanguíneo ou Não sei.');
  return {
    ...profile,
    name: profile.name.trim(),
    email: profile.email.trim(),
    city: profile.city.trim(),
  };
}
export function visibleAlerts(alerts: MobileAlert[], profile: Profile, preferences: Preferences) {
  return alerts.filter(
    (alert) =>
      normalize(alert.region.split('·')[0] ?? '') === normalize(profile.city) &&
      (alert.bloodType === profile.bloodType ? preferences.ownType : preferences.otherTypes),
  );
}
export function parseAlerts(value: unknown): MobileAlert[] {
  if (!Array.isArray(value) || value.length > 200)
    throw new Error('A API retornou uma lista de avisos inválida.');
  const ids = new Set<string>();
  for (const alert of value) {
    if (
      !alert ||
      typeof alert !== 'object' ||
      !['id', 'title', 'message', 'bloodType', 'region', 'unitName', 'publishedAt'].every(
        (key) =>
          typeof alert[key] === 'string' && alert[key].length > 0 && alert[key].length <= 1000,
      ) ||
      !bloodTypes.includes(alert.bloodType) ||
      alert.bloodType === 'Não sei' ||
      !['critico', 'baixo', 'mobilizacao'].includes(alert.level) ||
      !Number.isFinite(Date.parse(alert.publishedAt)) ||
      ids.has(alert.id)
    ) {
      throw new Error('A API retornou um aviso inválido.');
    }
    ids.add(alert.id);
  }
  return value as MobileAlert[];
}
export function restoreMobile(raw: string): MobileData {
  const d = JSON.parse(raw) as MobileData;
  if (
    !d ||
    d.version !== 1 ||
    !d.profile ||
    !d.preferences ||
    typeof d.preferences.ownType !== 'boolean' ||
    typeof d.preferences.otherTypes !== 'boolean' ||
    typeof d.screeningDone !== 'boolean' ||
    typeof d.apiUrl !== 'string' ||
    d.apiUrl.length > 200 ||
    !Array.isArray(d.visits) ||
    !Array.isArray(d.readAlertIds) ||
    !d.readAlertIds.every((id) => typeof id === 'string') ||
    !d.visits.every(
      (v) =>
        v &&
        typeof v.id === 'string' &&
        units.some((u) => u.id === v.unitId) &&
        isDate(v.date) &&
        ['09:00', '09:30', '10:00'].includes(v.time),
    )
  ) {
    throw new Error('Dados locais inválidos.');
  }
  return { ...d, profile: validateProfile(d.profile), remoteAlerts: parseAlerts(d.remoteAlerts) };
}
export function isDate(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return (
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}
export function nextDates(now = new Date()): string[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + 1, 12);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}
export function dateLabel(date: string, short = false) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(
    'pt-BR',
    short ? { day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' },
  );
}
export function bookVisit(data: MobileData, visit: Visit): MobileData {
  if (!data.screeningDone) throw new Error('Responda à pré-triagem antes de reservar um horário.');
  if (
    !units.some((u) => u.id === visit.unitId) ||
    !nextDates().includes(visit.date) ||
    !['09:00', '09:30', '10:00'].includes(visit.time)
  )
    throw new Error('Escolha uma data e um horário disponíveis.');
  if (data.visits.some((v) => v.date === visit.date))
    throw new Error('Você já tem uma visita nesse dia. Consulte Doações.');
  return { ...data, visits: [...data.visits, visit] };
}
export function validateApiUrl(value: string) {
  const raw = value.trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Use o endereço completo. Exemplo: http://192.168.0.10:3000');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Informe apenas o endereço da API, sem caminho, senha ou parâmetros.');
  return raw;
}
