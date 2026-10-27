import express from 'express';
import { publicAlertsSql } from './stock.ts';
import type { ErrorRequestHandler } from 'express';
import type { Pool } from 'pg';
import { HttpError, protectedRoutes } from './routes.ts';

export function createApp(pool?: Pool) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    const origin = req.headers.origin;
    const additional = (process.env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (
      origin &&
      origin !== 'null' &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) &&
      !additional.includes(origin)
    ) {
      res.status(403).json({ error: 'Origem não permitida.' });
      return;
    }
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  const { router, authenticate } = protectedRoutes(pool);
  app.get('/demo/health', (_req, res) => res.json({ service: 'vitalis-demo', version: 1 }));
  app.get('/health', async (_req, res) => {
    if (!pool) throw new HttpError(503, 'Banco não configurado.');
    await pool.query('SELECT 1');
    res.json({ service: 'vitalis', database: 'ready' });
  });
  app.get('/privacy', (_req, res) =>
    res.json({
      version: '2026-10-prototype',
      purpose: 'Teste de contas e agendamentos de uma unidade fictícia.',
      data: [
        'Nome',
        'E-mail de acesso',
        'Senha derivada com scrypt',
        'Reservas',
        'Eventos de acesso e alteração',
      ],
      notCollected: ['CPF', 'Nascimento', 'Respostas de saúde'],
      optionalPush:
        'Com autorização: token do aparelho, cidade, tipo sanguíneo opcional e filtros. Desativar ou excluir a conta remove o cadastro push.',
      sessionMinutes: 30,
      retention: {
        accounts: 'Até a exclusão da conta fictícia.',
        appointments: 'Datas de atendimento com mais de 30 dias, removidas pela rotina db:cleanup.',
        auditAndAlerts: 'Eventos e avisos com mais de 30 dias, removidos pela rotina db:cleanup.',
        sessions:
          'Acesso expira em 30 minutos; registros expirados são removidos no login ou db:cleanup.',
      },
      rights:
        'Consulte, corrija seu nome, exporte e exclua sua conta de teste em Conta → Privacidade no aplicativo.',
      contact:
        process.env.PRIVACY_CONTACT ??
        'Canal do controlador ainda não definido; use somente dados fictícios.',
      limitation:
        'Protótipo com dados fictícios. Base legal, controlador, retenção clínica e governança devem ser definidos antes de dados reais.',
    }),
  );
  app.get('/demo/alerts', async (_req, res) => {
    const alerts = pool
      ? (await pool.query(`${publicAlertsSql} ORDER BY p.published_at DESC LIMIT 200`)).rows
      : [];
    res.json({ alerts });
  });
  app.post('/demo/alerts', authenticate, async (req, res) => {
    const actor = res.locals.actor;
    if (actor.role !== 'admin')
      throw new HttpError(403, 'Somente a equipe autorizada pode publicar avisos.');
    throw new HttpError(410, 'Os avisos de escassez são gerados automaticamente pelo estoque.');
  });
  app.use('/v1', router);
  const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    const status = error && typeof error === 'object' && 'status' in error ? error.status : 500;
    const code = status === 413 ? 413 : status === 400 ? 400 : 503;
    // Não devolve stack, SQL, credenciais ou corpo de requisição.
    res.status(code).json({
      error:
        code === 413
          ? 'Mensagem maior que o limite permitido.'
          : code === 400
            ? 'JSON inválido.'
            : 'Serviço indisponível. Confira o banco e tente novamente.',
    });
  };
  app.use(handleError);
  return app;
}
export const app = createApp();
