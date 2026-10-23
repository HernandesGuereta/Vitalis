export type SharedUser = {
  id: string;
  name: string;
  email: string;
  role: 'donor' | 'admin';
  unitId: string | null;
};
export type SharedSession = { token: string; expiresAt: string; user: SharedUser; url: string };
export type SharedUnit = { id: string; name: string; city: string };
export type SharedSlot = {
  id: string;
  unitId: string;
  date: string;
  time: string;
  available: number;
};
export type SharedAppointment = {
  id: string;
  slotId: string;
  canCancel: boolean;
  date: string;
  time: string;
  unitId: string;
  unitName: string;
  status: 'booked' | 'cancelled';
};
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function sharedRequest<T>(
  url: string,
  path: string,
  token?: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${url}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 204) return undefined as T;
    const value = await response.json();
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof value?.error === 'string' ? value.error : 'Não foi possível concluir.',
      );
    return value as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(
      method === 'POST' && path === '/v1/appointments'
        ? 'Não foi possível confirmar o agendamento. Atualize a agenda para verificar antes de tentar novamente.'
        : method === 'POST' && path.endsWith('/cancel')
          ? 'Não foi possível confirmar o cancelamento. Atualize a agenda para verificar e tente novamente.'
          : 'Sem conexão com o servidor. Confira a API e a rede e tente novamente.',
    );
  } finally {
    clearTimeout(timer);
  }
}
// Identifica uma tentativa de reserva; não é uma credencial de segurança.
export function requestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}
