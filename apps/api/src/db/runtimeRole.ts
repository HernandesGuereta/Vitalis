import type { Pool } from 'pg';

export async function grantRuntimeRole(pool: Pool) {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('Configure DATABASE_URL para vitalis_app.');
  const url = new URL(raw);
  const password = decodeURIComponent(url.password);
  if (
    url.username !== 'vitalis_app' ||
    password.length < 12 ||
    /DEFINA|CHANGE_ME|SUA_SENHA/i.test(password)
  )
    throw new Error('DATABASE_URL deve usar vitalis_app com senha de ao menos 12 caracteres.');
  const admin = new URL(process.env.DATABASE_ADMIN_URL ?? raw);
  if (admin.hostname !== url.hostname || admin.port !== url.port || admin.pathname !== url.pathname)
    throw new Error('As URLs de manutenção e aplicação devem apontar para o mesmo banco.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!(await client.query(`SELECT 1 FROM pg_roles WHERE rolname='vitalis_app'`)).rowCount) {
      // O format do PostgreSQL escapa o literal; a senha não aparece nos logs da aplicação.
      const sql = (
        await client.query(
          `SELECT format('CREATE ROLE vitalis_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', $1::text) AS sql`,
          [password],
        )
      ).rows[0].sql;
      await client.query(sql);
    }
    const database = (
      await client.query(
        `SELECT format('GRANT CONNECT ON DATABASE %I TO vitalis_app', current_database()) AS sql`,
      )
    ).rows[0].sql;
    await client.query(database);
    const grantSchema = (
      await client.query(
        `SELECT format('GRANT USAGE ON SCHEMA %I TO vitalis_app', current_schema()) AS sql`,
      )
    ).rows[0].sql;
    await client.query(grantSchema);
    await client.query(`GRANT SELECT ON units,slots TO vitalis_app`);
    // PostgreSQL exige privilégio de UPDATE para o bloqueio FOR UPDATE das vagas.
    await client.query(`GRANT UPDATE(capacity) ON slots TO vitalis_app`);
    await client.query(`GRANT SELECT,DELETE ON accounts TO vitalis_app`);
    // O papel é definido pelo DEFAULT do banco; o cadastro não pode fornecer role/unit_id.
    await client.query(`GRANT INSERT(id,email,name,password_hash) ON accounts TO vitalis_app`);
    await client.query(`GRANT UPDATE(name) ON accounts TO vitalis_app`);
    await client.query(`GRANT SELECT,INSERT,DELETE ON sessions TO vitalis_app`);
    await client.query(`GRANT SELECT,INSERT,UPDATE ON appointments TO vitalis_app`);
    await client.query(`GRANT SELECT,INSERT ON audit_events TO vitalis_app`);
    await client.query(`GRANT USAGE ON SEQUENCE audit_events_id_seq TO vitalis_app`);
    await client.query(`GRANT SELECT,INSERT,UPDATE ON public_alerts TO vitalis_app`);
    // A API pode verificar o estado das migrações, mas não pode alterá-lo.
    await client.query(`GRANT SELECT ON schema_migrations TO vitalis_app`);
    if ((await client.query('SELECT current_schema() AS name')).rows[0].name === 'public') {
      await client.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
