# Banco de dados

Esta pasta reserva o local para a futura modelagem PostgreSQL, migrações e documentação do banco. Nesta etapa não há tabelas, dados de exemplo, scripts SQL, ORM ou conexão com a API.

O serviço local é definido em `../compose.yaml`. Execute os comandos `npm run db:*` a partir da raiz do monorepositório; consulte o README principal para preparar o `.env`.

O volume Docker `postgres_data` persiste os dados. `npm run db:down` encerra o serviço e preserva o volume. A imagem PostgreSQL 18 monta o volume em `/var/lib/postgresql`.

Se usar uma instalação local do PostgreSQL, crie um banco vazio e ajuste a futura `DATABASE_URL` no `.env`. Ainda não é necessário iniciar o banco para executar as aplicações.
