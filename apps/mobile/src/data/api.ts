import { parseAlerts, validateApiUrl } from './model';

export async function fetchAlerts(address: string) {
  const url = validateApiUrl(address);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const health = await fetch(`${url}/demo/health`, { signal: controller.signal });
    if (!health.ok || (await health.json()).service !== 'vitalis-demo')
      throw new Error('API inválida.');
    const response = await fetch(`${url}/demo/alerts`, { signal: controller.signal });
    if (!response.ok) throw new Error('Não foi possível buscar os avisos.');
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('alerts' in body))
      throw new Error('Resposta inválida.');
    return parseAlerts(body.alerts);
  } finally {
    clearTimeout(timer);
  }
}
