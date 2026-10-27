import { createPool } from './pool.ts';
import { migrate } from './migrate.ts';
import { seed } from './seed.ts';
import { grantRuntimeRole } from './runtimeRole.ts';
export async function cleanup(pool: ReturnType<typeof createPool>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM sessions WHERE expires_at < now()');
    await client.query(
      `DELETE FROM appointments WHERE service_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date - 30`,
    );
    await client.query(`DELETE FROM audit_events WHERE created_at < now() - interval '30 days'`);
    await client.query(`DELETE FROM public_alerts WHERE NOT active AND published_at < now() - interval '30 days'`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
const pool = createPool(process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL);
try {
  const command = process.argv[2];
  if (command === 'migrate') await migrate(pool);
  else if (command === 'role') await grantRuntimeRole(pool);
  else if (command === 'seed') {
    if (!process.env.DEMO_DONOR_PASSWORD || !process.env.DEMO_ADMIN_PASSWORD)
      throw new Error(
        'Configure DEMO_DONOR_PASSWORD e DEMO_ADMIN_PASSWORD no .env com senhas distintas de ao menos 12 caracteres.',
      );
    if (process.env.DEMO_DONOR_PASSWORD === process.env.DEMO_ADMIN_PASSWORD)
      throw new Error('Use senhas distintas para doador e administrador.');
    await seed(pool, process.env.DEMO_DONOR_PASSWORD, process.env.DEMO_ADMIN_PASSWORD);
  } else if (command === 'cleanup') await cleanup(pool);
  else throw new Error('Comando esperado: migrate, role, seed ou cleanup.');
  console.log('Operação do banco concluída.');
} catch (error) {
  console.error(
    error instanceof Error && !('code' in error)
      ? error.message
      : 'Falha na operação do banco. Confira conexão, permissões e migrações.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
