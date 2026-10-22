export type AgendaSession = {
  token: string;
  expiresAt: string;
  user: { id: string; name: string; email: string; role: 'admin' | 'donor'; unitId: string | null };
};
export type SharedAppointment = {
  id: string;
  donorName: string;
  date: string;
  time: string;
  unitName: string;
  status: 'booked' | 'cancelled';
};
const base = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
let session: AgendaSession | null = null;
export const getAgendaSession = () =>
  session && Date.parse(session.expiresAt) > Date.now() ? session : null;
export async function apiRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  token = getAgendaSession()?.token,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      signal: AbortSignal.timeout(8000),
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('Sem conexão com a API. Inicie o banco e a API e tente novamente.');
  }
  if (response.status === 204) return undefined as T;
  const value = await response.json();
  if (!response.ok) {
    if (response.status === 401) session = null;
    throw new Error(
      typeof value?.error === 'string' ? value.error : 'Não foi possível concluir a operação.',
    );
  }
  return value as T;
}
export async function loginAgenda(email: string, password: string) {
  const next = await apiRequest<AgendaSession>('/v1/auth/login', 'POST', { email, password });
  if (next.user?.role !== 'admin') {
    await apiRequest('/v1/auth/logout', 'POST', undefined, next.token);
    throw new Error('Use uma conta administrativa para consultar a agenda da unidade.');
  }
  session = next;
  return next;
}
export function logoutAgenda() {
  const token = session?.token;
  session = null;
  if (token) void apiRequest('/v1/auth/logout', 'POST', undefined, token).catch(() => {});
}

export function watchAppointments(onChange: () => void) {
  const controller = new AbortController();
  let retry: ReturnType<typeof setTimeout> | undefined;
  async function connect() {
    const token = getAgendaSession()?.token;
    if (!token || controller.signal.aborted) return;
    try {
      const response = await fetch(`${base}/v1/appointments/events`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (event.includes('event: appointments-changed')) onChange();
        }
      }
    } catch {
      /* A consulta periódica continua disponível se a conexão cair. */
    }
    if (!controller.signal.aborted) retry = setTimeout(() => void connect(), 3000);
  }
  void connect();
  return () => {
    controller.abort();
    if (retry) clearTimeout(retry);
  };
}
