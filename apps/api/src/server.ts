import { startPushWorker } from './push.ts';
import { createApp } from './app.ts';
import { createPool } from './db/pool.ts';
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';

const host = process.argv.includes('--lan') ? '0.0.0.0' : (process.env.HOST ?? '127.0.0.1');
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT deve ser um número inteiro entre 1 e 65535.');
}

const tls = process.env.TLS_CERT_FILE && process.env.TLS_KEY_FILE;
if (Boolean(process.env.TLS_CERT_FILE) !== Boolean(process.env.TLS_KEY_FILE))
  throw new Error('Configure o certificado e a chave TLS juntos.');
if (
  !tls &&
  (process.env.NODE_ENV === 'production' ||
    (!['localhost', '127.0.0.1', '::1'].includes(host) &&
      process.env.ALLOW_INSECURE_DEMO_LAN !== 'true'))
) {
  throw new Error(
    'Configure TLS_CERT_FILE/TLS_KEY_FILE para HTTPS. HTTP na rede local requer ALLOW_INSECURE_DEMO_LAN=true e somente dados fictícios.',
  );
}
const pool = createPool();
try {
  await pool.query('SELECT name FROM schema_migrations LIMIT 1');
  const role = (
    await pool.query(
      'SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user',
    )
  ).rows[0];
  if (role?.rolsuper || role?.rolcreatedb || role?.rolcreaterole) {
    throw new Error('privileged-role');
  }
} catch {
  await pool.end();
  throw new Error(
    'PostgreSQL indisponível, não preparado ou usuário com privilégios excessivos. Execute db:up, db:migrate, db:role e db:seed; use DATABASE_URL de vitalis_app.',
  );
}
const application = createApp(pool);
const server = tls
  ? createServer(
      {
        cert: readFileSync(process.env.TLS_CERT_FILE!),
        key: readFileSync(process.env.TLS_KEY_FILE!),
      },
      application,
    ).listen(port, host)
  : application.listen(port, host);
server.once('listening', () =>
  console.log(`Vitalis API iniciada em ${tls ? 'https' : 'http'}://${host}:${port}`),
);
const stopPushWorker = startPushWorker(pool);
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    stopPushWorker();
    server.close(() => void pool.end());
  });
