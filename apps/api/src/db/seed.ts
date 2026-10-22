import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { hashPassword } from '../security.ts';
import { demoCenterEmail, demoCenterPassword } from '../demoAccess.ts';

export async function seed(pool: Pool, donorPassword: string, adminPassword: string) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('O seed é exclusivo da demonstração com dados fictícios.');
  const donorHash = await hashPassword(donorPassword);
  const adminHash = await hashPassword(adminPassword);
  const centerHash = await hashPassword(demoCenterPassword);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO units(id,name,city) VALUES ('centro','Unidade Vitalis Centro','Ourinhos, SP'),('jardim','Unidade Jardim Paulista','Ourinhos, SP') ON CONFLICT DO NOTHING`,
    );
    await client.query(
      'INSERT INTO accounts(id,email,name,password_hash,role,unit_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(email) DO NOTHING',
      [randomUUID(), demoCenterEmail, 'Equipe Vitalis Centro', centerHash, 'admin', 'centro'],
    );
    for (const [email, name, role, unit] of [
      ['ana@exemplo.com', 'Ana Oliveira', 'donor', null],
      ['lucas@exemplo.com', 'Lucas Santos', 'donor', null],
      ['renata@unidade.exemplo', 'Renata Costa', 'admin', 'centro'],
      ['equipe.jardim@unidade.exemplo', 'Equipe Jardim', 'admin', 'jardim'],
    ]) {
      await client.query(
        'INSERT INTO accounts(id,email,name,password_hash,role,unit_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(email) DO NOTHING',
        [randomUUID(), email, name, role === 'donor' ? donorHash : adminHash, role, unit],
      );
    }
    // Reexecutar acrescenta a próxima semana sem apagar reservas ou redefinir senhas.
    for (const unit of ['centro', 'jardim'])
      for (let day = 1; day <= 7; day++)
        for (const time of ['09:00', '09:30', '10:00']) {
          await client.query(
            `INSERT INTO slots(id,unit_id,starts_at,capacity) VALUES($1,$2,(((now() AT TIME ZONE 'America/Sao_Paulo')::date + $3::integer) + $4::time) AT TIME ZONE 'America/Sao_Paulo',2) ON CONFLICT(unit_id,starts_at) DO NOTHING`,
            [randomUUID(), unit, day, time],
          );
        }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
