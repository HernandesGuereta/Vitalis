export const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;
export type BloodType = (typeof bloodTypes)[number];
export type MovementKind = 'entrada' | 'saida';
export type StockStatus = 'adequado' | 'baixo' | 'critico';

export interface Movement {
  id: string;
  bloodType: BloodType;
  kind: MovementKind;
  quantity: number;
  reason: string;
  note: string;
  createdAt: string;
  responsible: string;
  location?: string;
  expiresOn?: string;
}

export interface PrototypeData {
  version: 1;
  movements: Movement[];
}

export interface StockItem {
  bloodType: BloodType;
  quantity: number;
  target: number;
  status: StockStatus;
}

// Valores de demonstração: não representam parâmetros clínicos ou operacionais.
const openingStock: Record<BloodType, number> = {
  'O+': 70, 'O-': 16, 'A+': 54, 'A-': 12,
  'B+': 28, 'B-': 6, 'AB+': 12, 'AB-': 4,
};

const targets: Record<BloodType, number> = {
  'O+': 100, 'O-': 40, 'A+': 80, 'A-': 30,
  'B+': 50, 'B-': 25, 'AB+': 25, 'AB-': 15,
};

export const reasons: Record<MovementKind, readonly string[]> = {
  entrada: ['Coleta simulada', 'Transferência recebida', 'Ajuste de demonstração'],
  saida: ['Uso simulado', 'Transferência enviada', 'Descarte simulado'],
};

export const donors: ReadonlyArray<{
  id: string;
  name: string;
  bloodType: BloodType;
  city: string;
  donations: number;
}> = [
  { id: 'DOA-001', name: 'Ana Martins', bloodType: 'O+', city: 'Ourinhos, SP', donations: 4 },
  { id: 'DOA-002', name: 'Rafael Almeida', bloodType: 'A+', city: 'Ourinhos, SP', donations: 7 },
  { id: 'DOA-003', name: 'Camila Santos', bloodType: 'O-', city: 'Salto Grande, SP', donations: 3 },
  { id: 'DOA-004', name: 'Pedro Oliveira', bloodType: 'B+', city: 'Ourinhos, SP', donations: 2 },
  { id: 'DOA-005', name: 'Juliana Costa', bloodType: 'AB+', city: 'Santa Cruz do Rio Pardo, SP', donations: 5 },
  { id: 'DOA-006', name: 'Lucas Ferreira', bloodType: 'A-', city: 'Ourinhos, SP', donations: 1 },
  { id: 'DOA-007', name: 'Beatriz Lima', bloodType: 'B-', city: 'Chavantes, SP', donations: 6 },
  { id: 'DOA-008', name: 'Gabriel Souza', bloodType: 'AB-', city: 'Ourinhos, SP', donations: 2 },
  { id: 'DOA-009', name: 'Mariana Ribeiro', bloodType: 'O+', city: 'Ipaussu, SP', donations: 3 },
  { id: 'DOA-010', name: 'Felipe Barbosa', bloodType: 'A+', city: 'Ourinhos, SP', donations: 4 },
];

export function createDemo(now = new Date()): PrototypeData {
  const samples: Array<[BloodType, MovementKind, number, number, string]> = [
    ['O+', 'entrada', 20, 6, 'Coleta simulada'],
    ['A+', 'entrada', 8, 5, 'Coleta simulada'],
    ['O-', 'saida', 8, 4, 'Uso simulado'],
    ['AB+', 'entrada', 6, 3, 'Transferência recebida'],
    ['O+', 'saida', 6, 2, 'Uso simulado'],
    ['B+', 'entrada', 3, 1, 'Coleta simulada'],
    ['B-', 'saida', 2, 0, 'Transferência enviada'],
    ['AB-', 'saida', 2, 0, 'Uso simulado'],
  ];

  return {
    version: 1,
    movements: samples.map(([bloodType, kind, quantity, daysAgo, reason], index) => {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      // Mantém os registros iniciais no passado, inclusive ao iniciar antes das 9h.
      date.setTime(date.getTime() - (samples.length - index) * 20 * 60 * 1000);
      return {
        id: `DEMO-${String(index + 1).padStart(3, '0')}`,
        bloodType, kind, quantity, reason,
        note: 'Registro fictício para apresentação do protótipo.',
        createdAt: date.toISOString(),
        responsible: index % 2 === 0 ? 'Marina Costa' : 'Daniel Alves',
      };
    }),
  };
}

export function getStock(data: PrototypeData): StockItem[] {
  return bloodTypes.map((bloodType) => {
    const quantity = data.movements.reduce((total, movement) => {
      if (movement.bloodType !== bloodType) return total;
      return total + (movement.kind === 'entrada' ? movement.quantity : -movement.quantity);
    }, openingStock[bloodType]);
    const ratio = quantity / targets[bloodType];
    const status = ratio <= 0.25 ? 'critico' : ratio <= 0.5 ? 'baixo' : 'adequado';
    return { bloodType, quantity, target: targets[bloodType], status };
  });
}

export function addMovement(data: PrototypeData, movement: Movement): PrototypeData {
  if (!bloodTypes.includes(movement.bloodType)) throw new Error('Selecione um tipo sanguíneo válido.');
  if (movement.kind !== 'entrada' && movement.kind !== 'saida') throw new Error('Selecione entrada ou saída.');
  if (!Number.isSafeInteger(movement.quantity) || movement.quantity < 1 || movement.quantity > 10000) {
    throw new Error('Informe uma quantidade inteira entre 1 e 10.000 bolsas.');
  }
  if (!reasons[movement.kind].includes(movement.reason)) throw new Error('Selecione um motivo válido.');
  if (!movement.id || data.movements.some((item) => item.id === movement.id)) {
    throw new Error('Esta movimentação já foi registrada.');
  }
  if (!Number.isFinite(Date.parse(movement.createdAt))) throw new Error('Data de movimentação inválida.');
  if (!movement.responsible.trim() || movement.responsible.length > 80 || movement.note.length > 160) {
    throw new Error('Revise o responsável e a observação da movimentação.');
  }
  if (movement.location !== undefined && (typeof movement.location !== 'string' || movement.location.length > 160)) {
    throw new Error('Revise a origem ou o destino informado.');
  }
  if (movement.expiresOn && (!/^\d{4}-\d{2}-\d{2}$/.test(movement.expiresOn) || !Number.isFinite(Date.parse(movement.expiresOn)))) {
    throw new Error('Informe uma validade válida.');
  }
  const available = getStock(data).find((item) => item.bloodType === movement.bloodType)!.quantity;
  if (movement.kind === 'saida' && movement.quantity > available) {
    throw new Error(`Há apenas ${available} bolsas de ${movement.bloodType} disponíveis.`);
  }
  return { version: 1, movements: [...data.movements, { ...movement, note: movement.note.trim() }] };
}

export function restoreDemo(raw: string): PrototypeData {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1 ||
      !('movements' in value) || !Array.isArray(value.movements)) {
    throw new Error('Formato dos dados locais não reconhecido.');
  }
  let result: PrototypeData = { version: 1, movements: [] };
  for (const candidate of value.movements) {
    if (typeof candidate !== 'object' || candidate === null ||
        typeof candidate.id !== 'string' || typeof candidate.bloodType !== 'string' ||
        typeof candidate.kind !== 'string' || typeof candidate.quantity !== 'number' ||
        typeof candidate.reason !== 'string' || typeof candidate.note !== 'string' ||
        typeof candidate.createdAt !== 'string' || typeof candidate.responsible !== 'string') {
      throw new Error('Movimentação local inválida.');
    }
    result = addMovement(result, candidate as Movement);
  }
  return result;
}

export function getWeekActivity(data: PrototypeData, now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - index));
    const sameDay = (value: string) => new Date(value).toDateString() === date.toDateString();
    const movements = data.movements.filter((movement) => sameDay(movement.createdAt));
    return {
      date,
      incoming: movements.filter((item) => item.kind === 'entrada').reduce((sum, item) => sum + item.quantity, 0),
      outgoing: movements.filter((item) => item.kind === 'saida').reduce((sum, item) => sum + item.quantity, 0),
    };
  });
}
