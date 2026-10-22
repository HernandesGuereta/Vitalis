import { Pool } from 'pg';

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString)
    throw new Error('Configure DATABASE_URL antes de iniciar a API ou os comandos do banco.');
  const pool = new Pool({
    connectionString,
    max: 8,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  // Não registra SQL, URLs de conexão ou dados pessoais.
  pool.on('error', () => console.error('Conexão ociosa com PostgreSQL interrompida.'));
  return pool;
}
