import { randomUUID } from 'node:crypto';
import type { Router } from 'express';
import type { Pool } from 'pg';
import { HttpError } from './routes.ts';
import { targets } from './stock.ts';

export function pushRoutes(router: Router, pool: () => Pool) {
  router.post('/push/subscriptions', async (req, res) => {
    const actor = res.locals.actor,
      body = req.body;
    if (actor.role !== 'donor')
      throw new HttpError(403, 'Somente doadores podem ativar notificações.');
    if (
      !body ||
      Object.keys(body).some(
        (k) => !['token', 'city', 'bloodType', 'ownType', 'otherTypes', 'consent'].includes(k),
      ) ||
      body.consent !== true ||
      typeof body.token !== 'string' ||
      !/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,200}\]$/.test(body.token) ||
      typeof body.city !== 'string' ||
      body.city.trim().length < 3 ||
      body.city.length > 100 ||
      !(
        body.bloodType === null ||
        (typeof body.bloodType === 'string' && Object.hasOwn(targets, body.bloodType))
      ) ||
      typeof body.ownType !== 'boolean' ||
      typeof body.otherTypes !== 'boolean'
    )
      throw new HttpError(400, 'Revise a permissão e as preferências de notificação.');
    const client = await pool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [actor.id]);
      const count = (
        await client.query(
          'SELECT count(*)::int n FROM push_subscriptions WHERE account_id=$1 AND token<>$2',
          [actor.id, body.token],
        )
      ).rows[0].n;
      if (count >= 5)
        throw new HttpError(
          409,
          'Esta conta já possui cinco aparelhos. Desative as notificações da conta antes de registrar outros.',
        );
      const subscription = (
        await client.query(
          `INSERT INTO push_subscriptions(id,account_id,token,city,blood_type,own_type,other_types) VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(token) DO UPDATE SET account_id=excluded.account_id,city=excluded.city,blood_type=excluded.blood_type,own_type=excluded.own_type,other_types=excluded.other_types,consent_at=now() RETURNING id`,
          [
            randomUUID(),
            actor.id,
            body.token,
            body.city.trim(),
            body.bloodType,
            body.ownType,
            body.otherTypes,
          ],
        )
      ).rows[0];
      // A ativação é explícita. Avisos ativos também ficam disponíveis para um aparelho novo.
      await client.query(
        `INSERT INTO push_deliveries(id,alert_id,subscription_id,level)
        SELECT gen_random_uuid(),a.id,$1,a.level FROM public_alerts a JOIN push_subscriptions s ON s.id=$1
        WHERE a.automatic AND a.active AND lower(trim(a.region))=lower(trim(s.city)) AND ((s.own_type AND s.blood_type=a.blood_type) OR (s.other_types AND s.blood_type IS DISTINCT FROM a.blood_type))
        ON CONFLICT(alert_id,subscription_id,level) DO NOTHING`,
        [subscription.id],
      );
      await client.query('COMMIT');
      res.status(201).json({
        enabled: true,
        deliveryEnabled: process.env.PUSH_ENABLED === 'true',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  router.get('/push/preferences', async (_req, res) => {
    const result = await pool().query(
      'SELECT count(*)::int n FROM push_subscriptions WHERE account_id=$1',
      [res.locals.actor.id],
    );
    res.json({ enabled: result.rows[0].n > 0 });
  });
  router.patch('/push/preferences', async (req, res) => {
    const b = req.body;
    if (
      !b ||
      Object.keys(b).some((k) => !['city', 'bloodType', 'ownType', 'otherTypes'].includes(k)) ||
      typeof b.city !== 'string' ||
      b.city.trim().length < 3 ||
      b.city.length > 100 ||
      !(
        b.bloodType === null ||
        (typeof b.bloodType === 'string' && Object.hasOwn(targets, b.bloodType))
      ) ||
      typeof b.ownType !== 'boolean' ||
      typeof b.otherTypes !== 'boolean'
    )
      throw new HttpError(400, 'Revise suas preferências.');
    await pool().query(
      'UPDATE push_subscriptions SET city=$2,blood_type=$3,own_type=$4,other_types=$5 WHERE account_id=$1',
      [res.locals.actor.id, b.city.trim(), b.bloodType, b.ownType, b.otherTypes],
    );
    res.sendStatus(204);
  });
  router.delete('/push/subscriptions', async (_req, res) => {
    await pool().query('DELETE FROM push_subscriptions WHERE account_id=$1', [res.locals.actor.id]);
    res.sendStatus(204);
  });
}

type PushTicket = {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
};
export type PushTransport = {
  send: (token: string, alertId: string) => Promise<PushTicket>;
  receipt: (id: string) => Promise<PushTicket | undefined>;
};
export function expoTransport(accessToken: string): PushTransport {
  const request = async <T>(path: string, body: unknown): Promise<T> => {
    const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('push-provider-unavailable');
    return (await response.json()) as T;
  };
  return {
    send: async (token, alertId) => {
      const result = await request<{ data: PushTicket }>('send', {
        to: token,
        title: 'Vitalis · Aviso da sua região',
        body: 'Uma unidade da sua região precisa de doações. Abra o Vitalis para consultar o aviso de escassez e as orientações.',
        sound: 'default',
        channelId: 'escassez',
        ttl: 3600,
        data: { screen: 'alerts', alertId },
      });
      if (!result?.data || !['ok', 'error'].includes(result.data.status))
        throw new Error('invalid-push-ticket');
      return result.data;
    },
    receipt: async (id) => {
      const result = await request<{ data: Record<string, PushTicket> }>('getReceipts', {
        ids: [id],
      });
      return result?.data?.[id];
    },
  };
}
// PostgreSQL guarda a fila; reiniciar a API não perde mensagens nem repete tickets já aceitos.
export async function deliverPush(pool: Pool, transport: PushTransport) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE push_deliveries d SET status='cancelled' FROM public_alerts a,push_subscriptions s
      WHERE d.alert_id=a.id AND d.subscription_id=s.id AND d.status IN ('pending','submitted') AND
      (NOT a.active OR lower(trim(a.region))<>lower(trim(s.city)) OR NOT ((s.own_type AND s.blood_type=a.blood_type) OR (s.other_types AND s.blood_type IS DISTINCT FROM a.blood_type)))`);
    const rows = (
      await client.query(`SELECT d.*,s.token FROM push_deliveries d JOIN push_subscriptions s ON s.id=d.subscription_id
      WHERE d.status IN ('pending','submitted') AND d.next_attempt_at<=now() ORDER BY d.created_at FOR UPDATE OF d SKIP LOCKED LIMIT 10`)
    ).rows;
    for (const row of rows) {
      try {
        const ticket =
          row.status === 'submitted'
            ? await transport.receipt(row.ticket_id)
            : await transport.send(row.token, row.alert_id);
        if (!ticket) throw new Error('receipt-not-ready');
        if (ticket.status === 'error') {
          const code = ticket.details?.error ?? 'ProviderError';
          if (code === 'DeviceNotRegistered')
            await client.query('DELETE FROM push_subscriptions WHERE id=$1', [row.subscription_id]);
          else
            await client.query(
              `UPDATE push_deliveries SET status='failed',error_code=$2 WHERE id=$1`,
              [row.id, code.slice(0, 80)],
            );
        } else if (row.status === 'submitted') {
          await client.query(
            "UPDATE push_deliveries SET status='receipt_ok',error_code=NULL WHERE id=$1",
            [row.id],
          );
        } else {
          if (!ticket.id) throw new Error('missing-ticket');
          await client.query(
            "UPDATE push_deliveries SET status='submitted',ticket_id=$2,next_attempt_at=now()+interval '15 minutes',error_code=NULL WHERE id=$1",
            [row.id, ticket.id],
          );
        }
      } catch {
        await client.query(
          `UPDATE push_deliveries SET attempts=attempts+1,status=CASE WHEN attempts>=5 OR created_at<now()-interval '1 hour' THEN 'failed' ELSE status END,
          error_code='ProviderUnavailable',next_attempt_at=now()+make_interval(secs=>LEAST(900,30*power(2,attempts)::int)) WHERE id=$1`,
          [row.id],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export function startPushWorker(pool: Pool) {
  if (process.env.PUSH_ENABLED !== 'true') return () => {};
  if (!process.env.EXPO_PUSH_ACCESS_TOKEN)
    throw new Error('Configure EXPO_PUSH_ACCESS_TOKEN antes de ativar push.');
  const transport = expoTransport(process.env.EXPO_PUSH_ACCESS_TOKEN);
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await deliverPush(pool, transport);
    } catch {
      console.error('Não foi possível processar a fila de notificações.');
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void run(), 15000);
  timer.unref();
  void run();
  return () => clearInterval(timer);
}
