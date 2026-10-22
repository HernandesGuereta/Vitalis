-- O cadastro público pode inserir somente contas de doador.
ALTER TABLE accounts ALTER COLUMN role SET DEFAULT 'donor';
