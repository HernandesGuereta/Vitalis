import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Router } from 'express';
import { HttpError, uuid } from './routes.ts';

export const targets = {
  'O+': 100,
  'O-': 40,
  'A+': 80,
  'A-': 30,
  'B+': 50,
  'B-': 25,
  'AB+': 25,
  'AB-': 15,
} as const;
export type BloodType = keyof typeof targets;
export const stockLevel = (quantity: number, target: number) =>
  quantity <= target * 0.25 ? 'critico' : quantity <= target * 0.5 ? 'baixo' : 'adequado';
export function stockMessage(type: BloodType, level: 'baixo' | 'critico', unit: string) {
  return {
    title: `Estoque ${level === 'critico' ? 'crítico' : 'baixo'} de ${type}`,
    message: `O estoque de ${type} da ${unit} está ${level === 'critico' ? 'crítico' : 'baixo'}. Sua ajuda pode fazer a diferença. Faça a pré-triagem orientativa no Vitalis e consulte os horários para doar. A aptidão será avaliada pela equipe do hemocentro.`,
  };
}
export const publicAlertsSql = `SELECT p.id,p.title,p.message,p.blood_type AS "bloodType",p.region,u.name AS "unitName",p.level,p.published_at AS "publishedAt" FROM public_alerts p JOIN units u ON u.id=p.unit_id WHERE p.automatic AND p.active`;
export async function enqueueAlert(
  client: PoolClient,
  id: string,
  type: string,
  city: string,
  level: string,
) {
  await client.query(
    `INSERT INTO push_deliveries(id,alert_id,subscription_id,level)
    SELECT gen_random_uuid(),$1,s.id,$4 FROM push_subscriptions s
    WHERE lower(trim(s.city))=lower(trim($3)) AND ((s.own_type AND s.blood_type=$2) OR (s.other_types AND s.blood_type IS DISTINCT FROM $2))
    ON CONFLICT(alert_id,subscription_id,level) DO NOTHING`,
    [id, type, city, level],
  );
}
export function stockRoutes(router: Router, pool: () => Pool) {
  router.get('/stock', async (_req, res) => {
    const actor = res.locals.actor;
    if (actor.role !== 'admin') throw new HttpError(403, 'Acesso restrito à unidade.');
    const result = await pool().query(
      'SELECT revision,quantities,updated_at AS "updatedAt" FROM stock_state WHERE unit_id=$1',
      [actor.unitId],
    );
    res.json(result.rows[0] ?? { revision: 0, quantities: {}, updatedAt: null });
  });
  router.post('/stock/sync', async (req, res) => {
    const actor = res.locals.actor;
    if (actor.role !== 'admin')
      throw new HttpError(403, 'Somente a equipe pode sincronizar o estoque.');
    const body = req.body;
    if (
      !body ||
      Object.keys(body).some((k) => !['requestId', 'revision', 'quantities'].includes(k)) ||
      !uuid(body.requestId) ||
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0 ||
      !body.quantities ||
      Array.isArray(body.quantities) ||
      Object.keys(body.quantities).length !== 8 ||
      Object.keys(body.quantities).some((k) => !Object.hasOwn(targets, k)) ||
      Object.values(body.quantities).some(
        (v) => !Number.isSafeInteger(v) || (v as number) < 0 || (v as number) > 1000000,
      )
    )
      throw new HttpError(400, 'Informe as quantidades inteiras dos oito tipos sanguíneos.');
    const quantities = Object.fromEntries(Object.keys(targets).map((k) => [k, body.quantities[k]]));
    const hash = createHash('sha256').update(JSON.stringify(quantities)).digest('hex');
    const client = await pool().connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO stock_state(unit_id) VALUES($1) ON CONFLICT DO NOTHING', [
        actor.unitId,
      ]);
      const state = (
        await client.query('SELECT * FROM stock_state WHERE unit_id=$1 FOR UPDATE', [actor.unitId])
      ).rows[0];
      if (state.request_id === body.requestId) {
        if (state.request_hash !== hash)
          throw new HttpError(409, 'A tentativa já foi usada para outro estoque.');
        await client.query('COMMIT');
        res.json({ revision: state.revision });
        return;
      }
      if (state.revision !== body.revision)
        throw new HttpError(
          409,
          'O estoque foi sincronizado em outra sessão. Recarregue os dados antes de continuar.',
        );
      const unit = (await client.query('SELECT name,city FROM units WHERE id=$1', [actor.unitId]))
        .rows[0];
      for (const [type, target] of Object.entries(targets)) {
        const level = stockLevel(quantities[type], target);
        const previous = (
          await client.query(
            'SELECT * FROM public_alerts WHERE unit_id=$1 AND blood_type=$2 AND automatic AND active',
            [actor.unitId, type],
          )
        ).rows[0];
        if (level === 'adequado') {
          if (previous)
            await client.query('UPDATE public_alerts SET active=false WHERE id=$1', [previous.id]);
          continue;
        }
        const severity = level === 'critico' ? 2 : 1;
        const id = previous?.id ?? randomUUID();
        const text = stockMessage(type as BloodType, level, unit.name);
        await client.query(
          `INSERT INTO public_alerts(id,unit_id,title,message,blood_type,region,automatic,active,level,notified_level) VALUES($1,$2,$3,$4,$5,$6,true,true,$7,$8)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title,message=excluded.message,level=excluded.level,notified_level=GREATEST(public_alerts.notified_level,excluded.notified_level),published_at=CASE WHEN public_alerts.notified_level<excluded.notified_level THEN now() ELSE public_alerts.published_at END`,
          [id, actor.unitId, text.title, text.message, type, unit.city, level, severity],
        );
        if (!previous || severity > previous.notified_level) {
          await client.query(
            "UPDATE push_deliveries SET status='cancelled' WHERE alert_id=$1 AND level<>$2 AND status='pending'",
            [id, level],
          );
          await enqueueAlert(client, id, type, unit.city, level);
        }
      }
      await client.query(
        `UPDATE push_deliveries d SET status='cancelled' FROM public_alerts a WHERE a.id=d.alert_id AND NOT a.active AND d.status IN ('pending','submitted')`,
      );
      const revision = state.revision + 1;
      await client.query(
        'UPDATE stock_state SET revision=$2,request_id=$3,request_hash=$4,quantities=$5,updated_at=now() WHERE unit_id=$1',
        [actor.unitId, revision, body.requestId, hash, JSON.stringify(quantities)],
      );
      await client.query('COMMIT');
      res.json({ revision });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  router.get('/stock/alerts', async (_req, res) => {
    const actor = res.locals.actor;
    if (actor.role !== 'admin') throw new HttpError(403, 'Acesso restrito à unidade.');
    const alerts = (
      await pool().query(`${publicAlertsSql} AND p.unit_id=$1 ORDER BY p.published_at DESC`, [
        actor.unitId,
      ])
    ).rows;
    res.json({ alerts });
  });
}
