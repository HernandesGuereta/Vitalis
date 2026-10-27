import { pushRoutes } from './push.ts';
import { stockRoutes } from './stock.ts';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { EventEmitter } from 'node:events';
import { hashPassword, newToken, tokenHash, verifyPassword } from './security.ts';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
type Actor = {
  id: string;
  name: string;
  email: string;
  role: 'donor' | 'admin';
  unitId: string | null;
};
export const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'Dados inválidos.');
  return value as Record<string, unknown>;
};
const projection = `SELECT a.id,a.status,a.slot_id AS "slotId",(a.status='booked' AND s.starts_at>now()) AS "canCancel",to_char(s.starts_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS date,
  to_char(s.starts_at AT TIME ZONE 'America/Sao_Paulo','HH24:MI') AS time,
  s.unit_id AS "unitId",u.name AS "unitName",a.created_at AS "createdAt"
  FROM appointments a JOIN slots s ON s.id=a.slot_id JOIN units u ON u.id=s.unit_id`;

export function protectedRoutes(pool?: Pool) {
  const router = Router();
  const changes = new EventEmitter();
  changes.setMaxListeners(100);
  const requirePool = () => {
    if (!pool) throw new HttpError(503, 'Banco não configurado. Inicie a API com DATABASE_URL.');
    return pool;
  };
  const dummyHash = hashPassword('apenas-tempo-de-verificacao');
  const attempts = new Map<string, { count: number; until: number }>();
  let activeLogins = 0;
  router.post('/auth/register', async (req, res) => {
    const db = requirePool();
    const body = object(req.body);
    if (
      Object.keys(body).some((key) => !['name', 'email', 'password'].includes(key)) ||
      typeof body.name !== 'string' ||
      body.name.trim().length < 3 ||
      body.name.length > 100 ||
      typeof body.email !== 'string' ||
      body.email.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
      typeof body.password !== 'string' ||
      body.password.length < 12 ||
      body.password.length > 128
    ) {
      throw new HttpError(
        400,
        'Informe nome, e-mail válido e senha com 12 a 128 caracteres. O cadastro é somente de doador.',
      );
    }
    const key = tokenHash(`register:${req.ip ?? ''}`);
    const now = Date.now();
    for (const [k, value] of attempts) if (value.until < now) attempts.delete(k);
    const attempt = attempts.get(key) ?? { count: 0, until: now + 15 * 60_000 };
    if (attempt.count >= 5 || attempts.size >= 1000 || activeLogins >= 4) {
      res.setHeader('Retry-After', '900');
      throw new HttpError(429, 'Muitos cadastros. Aguarde antes de tentar novamente.');
    }
    attempts.set(key, { ...attempt, count: attempt.count + 1 });
    activeLogins++;
    try {
      const passwordHash = await hashPassword(body.password);
      const token = newToken();
      const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const user = (
          await client.query(
            `INSERT INTO accounts(id,name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id,name,email,role,unit_id AS "unitId"`,
            [randomUUID(), body.name.trim(), body.email.trim().toLowerCase(), passwordHash],
          )
        ).rows[0];
        await client.query(
          'INSERT INTO sessions(token_hash,account_id,expires_at) VALUES($1,$2,$3)',
          [tokenHash(token), user.id, expiresAt],
        );
        await client.query(
          `INSERT INTO audit_events(actor_id,action) VALUES($1,'account_registered')`,
          [user.id],
        );
        await client.query('COMMIT');
        res.status(201).json({ user, token, expiresAt });
      } catch (error) {
        await client.query('ROLLBACK');
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
          throw new HttpError(
            409,
            'Não foi possível cadastrar com esses dados. Se você já tem uma conta, entre com seu e-mail e senha.',
          );
        throw error;
      } finally {
        client.release();
      }
    } finally {
      activeLogins--;
    }
  });
  router.post('/auth/login', async (req, res) => {
    const db = requirePool();
    const body = object(req.body);
    if (
      typeof body.email !== 'string' ||
      body.email.length > 120 ||
      typeof body.password !== 'string' ||
      body.password.length > 128 ||
      body.password.length < 1
    )
      throw new HttpError(400, 'Informe e-mail e senha.');
    const email = body.email.trim().toLowerCase();
    const key = tokenHash(`${req.ip ?? ''}:${email}`);
    const now = Date.now();
    for (const [k, value] of attempts) if (value.until < now) attempts.delete(k);
    const attempt = attempts.get(key) ?? { count: 0, until: now + 15 * 60_000 };
    if (attempt.count >= 5 || attempts.size >= 1000 || activeLogins >= 4) {
      res.setHeader('Retry-After', '900');
      throw new HttpError(429, 'Muitas tentativas. Aguarde e tente novamente.');
    }
    attempt.count++;
    attempts.set(key, attempt);
    activeLogins++;
    try {
      const account = (
        await db.query(
          `SELECT id,name,email,role,unit_id AS "unitId",password_hash FROM accounts WHERE email=$1`,
          [email],
        )
      ).rows[0];
      const valid = await verifyPassword(
        body.password,
        account?.password_hash ?? (await dummyHash),
      );
      if (!account || !valid) throw new HttpError(401, 'E-mail ou senha inválidos.');
      const token = newToken();
      const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
      await db.query('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES($1,$2,$3)', [
        tokenHash(token),
        account.id,
        expiresAt,
      ]);
      await db.query('DELETE FROM sessions WHERE expires_at < now()');
      await db.query(`INSERT INTO audit_events(actor_id,action) VALUES($1,'login')`, [account.id]);
      attempts.delete(key);
      const user: Actor = {
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        unitId: account.unitId,
      };
      res.json({ token, expiresAt, user });
    } finally {
      activeLogins--;
    }
  });
  const authenticate: RequestHandler = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !/^Bearer [A-Za-z0-9_-]{43}$/.test(header))
      throw new HttpError(401, 'Entre na conta para acessar a agenda.');
    const token = header.slice(7);
    const user = (
      await requirePool().query(
        `SELECT a.id,a.name,a.email,a.role,a.unit_id AS "unitId",s.expires_at AS "expiresAt" FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at > now()`,
        [tokenHash(token)],
      )
    ).rows[0];
    if (!user) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.');
    res.locals.sessionExpiresAt = user.expiresAt;
    delete user.expiresAt;
    res.locals.actor = user as Actor;
    res.locals.tokenHash = tokenHash(token);
    next();
  };
  router.use(authenticate);
  stockRoutes(router, requirePool);
  pushRoutes(router, requirePool);
  router.get('/appointments/events', (req, res) => {
    const actor = res.locals.actor as Actor;
    if (actor.role !== 'admin')
      throw new HttpError(403, 'Atualizações da unidade exigem acesso administrativo.');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('event: ready\ndata: {}\n\n');
    let checking = false;
    const update = async (unitId?: string) => {
      if (checking || res.writableEnded || (unitId && unitId !== actor.unitId)) return;
      checking = true;
      try {
        const valid = await requirePool().query(
          'SELECT 1 FROM sessions WHERE token_hash=$1 AND expires_at>now()',
          [res.locals.tokenHash],
        );
        if (!valid.rowCount) {
          res.end();
          return;
        }
        res.write(unitId ? 'event: appointments-changed\ndata: {}\n\n' : ': keepalive\n\n');
      } catch {
        res.end();
      } finally {
        checking = false;
      }
    };
    const listener = (unitId: string) => {
      void update(unitId);
    };
    changes.on('appointments', listener);
    const timer = setInterval(() => void update(), 15000);
    const expiry = setTimeout(
      () => res.end(),
      Math.max(0, new Date(res.locals.sessionExpiresAt).getTime() - Date.now()),
    );
    res.on('close', () => {
      changes.off('appointments', listener);
      clearInterval(timer);
      clearTimeout(expiry);
    });
  });
  router.post('/auth/logout', async (_req, res) => {
    await requirePool().query('DELETE FROM push_subscriptions WHERE account_id=$1', [
      res.locals.actor.id,
    ]);
    await requirePool().query('DELETE FROM sessions WHERE token_hash=$1', [res.locals.tokenHash]);
    res.sendStatus(204);
  });
  router.get('/me', (_req, res) => res.json({ user: res.locals.actor }));
  router.patch('/me', async (req, res) => {
    const body = object(req.body);
    if (
      Object.keys(body).some((k) => k !== 'name') ||
      typeof body.name !== 'string' ||
      body.name.trim().length < 3 ||
      body.name.length > 100
    )
      throw new HttpError(400, 'Informe apenas o nome, com 3 a 100 caracteres.');
    await requirePool().query('UPDATE accounts SET name=$1 WHERE id=$2', [
      body.name.trim(),
      res.locals.actor.id,
    ]);
    res.json({ user: { ...res.locals.actor, name: body.name.trim() } });
  });
  router.get('/units', async (_req, res) =>
    res.json({
      units: (await requirePool().query('SELECT id,name,city FROM units ORDER BY id')).rows,
    }),
  );
  router.get('/slots', async (req, res) => {
    if (!['centro', 'jardim'].includes(String(req.query.unitId)))
      throw new HttpError(400, 'Escolha uma unidade.');
    const result = await requirePool().query(
      `SELECT s.id,s.unit_id AS "unitId",
      to_char(s.starts_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS date,
      to_char(s.starts_at AT TIME ZONE 'America/Sao_Paulo','HH24:MI') AS time,
      (s.capacity - count(a.id)::integer) AS available
      FROM slots s LEFT JOIN appointments a ON a.slot_id=s.id AND a.status='booked'
      WHERE s.unit_id=$1 AND s.starts_at > now() AND s.starts_at < now()+interval '8 days'
      GROUP BY s.id ORDER BY s.starts_at`,
      [req.query.unitId],
    );
    res.json({ slots: result.rows });
  });
  router.get('/appointments', async (_req, res) => {
    const actor = res.locals.actor as Actor;
    const sql =
      actor.role === 'donor'
        ? `${projection} WHERE a.donor_id=$1 ORDER BY s.starts_at DESC LIMIT 200`
        : `${projection.replace('SELECT a.id,', 'SELECT d.name AS "donorName",a.id,')} JOIN accounts d ON d.id=a.donor_id WHERE s.unit_id=$1 ORDER BY s.starts_at DESC LIMIT 200`;
    const result = await requirePool().query(sql, [
      actor.role === 'donor' ? actor.id : actor.unitId,
    ]);
    res.json({ appointments: result.rows });
  });
  router.post('/appointments', async (req, res) => {
    const actor = res.locals.actor as Actor;
    if (actor.role !== 'donor')
      throw new HttpError(403, 'Somente o doador pode criar sua reserva.');
    const body = object(req.body);
    if (
      !uuid(body.slotId) ||
      !uuid(body.requestId) ||
      Object.keys(body).some((k) => !['slotId', 'requestId'].includes(k))
    )
      throw new HttpError(
        400,
        'Escolha um horário válido. Não envie dados pessoais ou de saúde neste formulário.',
      );
    const client = await requirePool().connect();
    try {
      await client.query('BEGIN');
      // Serializa reservas do mesmo doador, inclusive em unidades/horários diferentes.
      await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [actor.id]);
      const previous = (
        await client.query(
          'SELECT id,slot_id,status FROM appointments WHERE donor_id=$1 AND request_id=$2',
          [actor.id, body.requestId],
        )
      ).rows[0];
      if (previous) {
        if (previous.status !== 'booked')
          throw new HttpError(
            409,
            'Esta tentativa de reserva já foi cancelada. Inicie uma nova reserva.',
          );
        if (previous.slot_id !== body.slotId)
          throw new HttpError(409, 'Identificador já utilizado em outra reserva.');
        await client.query('COMMIT');
        res.status(200).json({ id: previous.id });
        return;
      }
      const slot = (
        await client.query(
          `SELECT *,starts_at > now() AND starts_at < now()+interval '8 days' AS future,to_char(starts_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS date FROM slots WHERE id=$1 FOR UPDATE`,
          [body.slotId],
        )
      ).rows[0];
      if (!slot || !slot.future) throw new HttpError(409, 'Este horário não está mais disponível.');
      const count = (
        await client.query(
          `SELECT count(*)::integer AS total FROM appointments WHERE slot_id=$1 AND status='booked'`,
          [body.slotId],
        )
      ).rows[0].total;
      if (count >= slot.capacity)
        throw new HttpError(409, 'As vagas deste horário foram preenchidas. Escolha outro.');
      const id = randomUUID();
      await client.query(
        'INSERT INTO appointments(id,donor_id,slot_id,service_date,request_id) VALUES($1,$2,$3,$4,$5)',
        [id, actor.id, body.slotId, slot.date, body.requestId],
      );
      await client.query(
        `INSERT INTO audit_events(actor_id,action,resource_id) VALUES($1,'appointment_created',$2)`,
        [actor.id, id],
      );
      await client.query('COMMIT');
      changes.emit('appointments', slot.unit_id);
      res.status(201).json({ id });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
        throw new HttpError(409, 'Você já tem um agendamento ativo nesse dia.');
      throw error;
    } finally {
      client.release();
    }
  });
  router.post('/appointments/:id/cancel', async (req, res) => {
    const actor = res.locals.actor as Actor;
    if (!uuid(req.params.id)) throw new HttpError(400, 'Agendamento inválido.');
    const client = await requirePool().connect();
    try {
      await client.query('BEGIN');
      // A reserva e o cancelamento disputam o mesmo bloqueio de horário.
      const slot = (
        await client.query(
          `SELECT s.id,s.unit_id,s.starts_at>now() AS future FROM slots s JOIN appointments a ON a.slot_id=s.id
        WHERE a.id=$1 AND (($2='donor' AND a.donor_id=$3) OR ($2='admin' AND s.unit_id=$4)) FOR UPDATE OF s`,
          [req.params.id, actor.role, actor.id, actor.unitId],
        )
      ).rows[0];
      if (!slot) throw new HttpError(404, 'Agendamento não encontrado.');
      const appointment = (
        await client.query('SELECT status FROM appointments WHERE id=$1 FOR UPDATE', [
          req.params.id,
        ])
      ).rows[0];
      if (!appointment) throw new HttpError(404, 'Agendamento não encontrado.');
      // Uma resposta perdida pode ser repetida sem erro e sem duplicar a auditoria.
      if (appointment.status === 'cancelled') {
        await client.query('COMMIT');
        res.sendStatus(204);
        return;
      }
      if (!slot.future) throw new HttpError(409, 'O horário deste agendamento já passou.');
      await client.query(
        "UPDATE appointments SET status='cancelled',cancelled_at=now() WHERE id=$1",
        [req.params.id],
      );
      await client.query(
        `INSERT INTO audit_events(actor_id,action,resource_id) VALUES($1,'appointment_cancelled',$2)`,
        [actor.id, req.params.id],
      );
      await client.query('COMMIT');
      changes.emit('appointments', slot.unit_id);
      res.sendStatus(204);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  router.get('/me/export', async (_req, res) => {
    const actor = res.locals.actor as Actor;
    const appointments =
      actor.role === 'donor'
        ? (
            await requirePool().query(`${projection} WHERE a.donor_id=$1 ORDER BY s.starts_at`, [
              actor.id,
            ])
          ).rows
        : [];
    const events = (
      await requirePool().query(
        'SELECT action,resource_id AS "resourceId",created_at AS "createdAt" FROM audit_events WHERE actor_id=$1 ORDER BY created_at DESC LIMIT 1000',
        [actor.id],
      )
    ).rows;
    const pushPreferences = (
      await requirePool().query(
        'SELECT city,blood_type AS "bloodType",own_type AS "ownType",other_types AS "otherTypes",consent_at AS "consentAt" FROM push_subscriptions WHERE account_id=$1',
        [actor.id],
      )
    ).rows;
    res.json({
      exportedAt: new Date().toISOString(),
      user: actor,
      appointments,
      events,
      pushPreferences,
    });
  });
  router.delete('/me', async (req, res) => {
    const actor = res.locals.actor as Actor;
    if (actor.role !== 'donor')
      throw new HttpError(403, 'A exclusão de conta administrativa requer gestão da unidade.');
    if (object(req.body).confirmation !== 'EXCLUIR')
      throw new HttpError(400, 'Confirme a exclusão da conta de teste.');
    const client = await requirePool().connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM accounts WHERE id=$1', [actor.id]);
      await client.query(`INSERT INTO audit_events(action) VALUES('demo_account_deleted')`);
      await client.query('COMMIT');
      res.sendStatus(204);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  return { router, authenticate };
}
