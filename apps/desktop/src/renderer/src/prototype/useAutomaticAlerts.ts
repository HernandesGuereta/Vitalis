import { useEffect, useRef, useState } from 'react';
import { apiRequest } from './sharedApi';
import type { StockItem } from './model';
export type AutomaticAlert = {
  id: string;
  title: string;
  message: string;
  bloodType: string;
  region: string;
  unitName: string;
  level: 'baixo' | 'critico';
  publishedAt: string;
};
export function useAutomaticAlerts(enabled: boolean, stock: StockItem[]) {
  const desired = JSON.stringify(Object.fromEntries(stock.map((s) => [s.bloodType, s.quantity])));
  const latest = useRef(desired);
  latest.current = desired;
  const [alerts, setAlerts] = useState<AutomaticAlert[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(false);
  const trigger = useRef(() => {});
  useEffect(() => {
    setAlerts([]);
    setSynced(false);
    setError('');
    if (!enabled) return;
    let alive = true,
      working = false,
      last = '',
      revision: number | undefined;
    let pending:
      | {
          requestId: string;
          revision: number;
          quantities: Record<string, number>;
          key: string;
        }
      | undefined;
    async function sync() {
      if (working || !alive) return;
      working = true;
      setBusy(true);
      try {
        if (revision === undefined)
          revision = (await apiRequest<{ revision: number }>('/v1/stock')).revision;
        if (!alive) return;
        // Uma resposta perdida repete a mesma tentativa antes de enviar uma alteração mais nova.
        for (let i = 0; i < 2; i++) {
          if (!pending && last === latest.current) break;
          pending ??= {
            requestId: crypto.randomUUID(),
            revision: revision!,
            quantities: JSON.parse(latest.current),
            key: latest.current,
          };
          const { key, ...body } = pending!;
          const result: { revision: number } = await apiRequest<{
            revision: number;
          }>('/v1/stock/sync', 'POST', body);
          revision = result.revision;
          last = key;
          pending = undefined;
          if (!alive) return;
        }
        const result = await apiRequest<{ alerts: AutomaticAlert[] }>('/v1/stock/alerts');
        if (alive) {
          setAlerts(result.alerts);
          setError('');
          setSynced(last === latest.current);
        }
      } catch (e) {
        if (alive) {
          setSynced(false);
          setError(e instanceof Error ? e.message : 'Não foi possível sincronizar o estoque.');
        }
      } finally {
        working = false;
        if (alive) setBusy(false);
      }
    }
    trigger.current = () => void sync();
    void sync();
    const timer = setInterval(() => void sync(), 5000);
    return () => {
      alive = false;
      clearInterval(timer);
      trigger.current = () => {};
    };
  }, [enabled]);
  useEffect(() => {
    setSynced(false);
    trigger.current();
  }, [desired]);
  return { alerts, error, busy, synced, retry: () => trigger.current() };
}
