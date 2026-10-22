# PostgreSQL do Vitalis

O banco armazena a agenda compartilhada e os avisos públicos. O driver é `pg`, sem ORM. A API usa `DATABASE_URL`; somente o processo da API conhece essa credencial. Mobile e Electron renderer consomem HTTP/HTTPS e nunca acessam PostgreSQL diretamente.

## Preparação

Na raiz, configure `.env` conforme `.env.example`:

- `POSTGRES_PASSWORD`: senha própria do proprietário, definida antes da primeira criação do volume. Use o mesmo valor em `DATABASE_ADMIN_URL` e `TEST_DATABASE_URL`.
- `DATABASE_ADMIN_URL`: proprietário do banco, usado apenas por migrações, permissões, seed e limpeza.
- `DATABASE_URL`: usuário `vitalis_app` com senha distinta de pelo menos 12 caracteres.
- `DEMO_DONOR_PASSWORD` e `DEMO_ADMIN_PASSWORD`: senhas distintas de pelo menos 12 caracteres para as contas fictícias.
- `TEST_DATABASE_URL`: banco separado cujo nome contém `test`, com acesso para criar esquemas temporários.

Não copie um novo `.env` por cima de um arquivo já configurado. A instalação realizada nesta máquina usa a porta **5433**, pois 5432 apresentou conflito. O exemplo mantém 5432 para outras instalações; ajuste as URLs e `POSTGRES_PORT` juntas. Senhas locais foram geradas no `.env`, ignorado pelo Git e com permissão 0600 neste macOS.

```bash
npm run db:up
npm run db:migrate
npm run db:role
npm run db:seed
npm run db:check
```

O Compose mantém PostgreSQL 18 com a porta vinculada somente a `127.0.0.1` e volume `postgres_data`. `npm run db:down` preserva os dados. Não use a remoção do volume para atualizar a aplicação.

## Esquema

| Tabela | Conteúdo |
| --- | --- |
| `schema_migrations` | Migrações SQL já aplicadas |
| `units` | Duas unidades fictícias e sua cidade |
| `accounts` | Nome, e-mail, derivação da senha, papel e vínculo administrativo com unidade |
| `sessions` | Resumo SHA-256 do token e validade da sessão |
| `slots` | Unidade, início do atendimento e capacidade |
| `appointments` | Doador, horário, data local, situação e chave de repetição da tentativa |
| `audit_events` | Identificador do ator, ação, identificador do recurso e instante; sem senhas ou conteúdo de saúde |
| `public_alerts` | Conteúdo público de avisos da unidade; sem destinatários |

Não existem colunas de CPF, nascimento, tipo sanguíneo do doador ou respostas de saúde. Reservas de doação também exigem cuidado com privacidade pelo seu contexto, mesmo sem esses campos.

As migrações em `migrations/` executam em transação, com controle de versão e bloqueio para evitar aplicação concorrente. Reexecutar não apaga dados. `db:role` cria o usuário restrito e concede permissões às tabelas existentes; execute-o após migrações que adicionem tabelas.

O usuário da API não é superusuário, não cria bancos ou usuários e não tem permissão para criar tabelas no esquema. O cadastro só pode inserir `id`, `name`, `email` e `password_hash`: a migração `002_donor_registration.sql` define o papel padrão como `donor`, sem permitir que a API insira um papel administrativo. A atualização de contas é limitada à coluna `name`. A permissão de atualização da coluna `slots.capacity` é necessária para o bloqueio `FOR UPDATE` usado na reserva; não há rota pública para alterar essa capacidade. O servidor recusa iniciar usando uma conta com privilégios administrativos.

## Dados de demonstração

| Conta | Papel | Senha no `.env` |
| --- | --- | --- |
| `ana@exemplo.com` | Doadora | `DEMO_DONOR_PASSWORD` |
| `lucas@exemplo.com` | Doador | `DEMO_DONOR_PASSWORD` |
| `renata@unidade.exemplo` | Administradora da unidade Centro | `DEMO_ADMIN_PASSWORD` |
| `equipe.jardim@unidade.exemplo` | Administradora da unidade Jardim | `DEMO_ADMIN_PASSWORD` |
| `hemocentro@vitalis.demo` | Equipe da unidade Centro; acesso padrão do desktop | `VitalisDemo2026!` (credencial pública do protótipo) |

O mobile permite criar novas contas de doador com nome/e-mail fictícios e senha de 12 a 128 caracteres. Não há cadastro público de administradores ou hemocentros. A senha pública acima é intencional para a apresentação fictícia; não é uma credencial operacional.

O seed gera sete dias futuros, com 09:00, 09:30 e 10:00 em cada unidade, duas vagas por horário. Reexecute `db:seed` para disponibilizar a próxima semana. Ele acrescenta exemplos ausentes sem apagar reservas nem redefinir senhas. Se excluir uma conta fictícia pelo aplicativo, o seed poderá recriá-la; isso é exclusivo do protótipo e deve ser considerado ao demonstrar exclusão.

As datas da agenda usam `America/Sao_Paulo`; os instantes são `timestamptz`. A API bloqueia doador e horário durante a transação, verifica capacidade e exige uma única reserva ativa por doador/dia. A mesma chave de tentativa não cria duas reservas. Uma tentativa cancelada não é reutilizada para confirmar outra reserva.

## Limpeza e retenção de teste

```bash
npm run db:cleanup
```

Remove reservas cuja data de atendimento passou há mais de 30 dias, eventos e avisos com mais de 30 dias, além de sessões expiradas. Contas ficam até serem excluídas. Esse prazo é uma decisão para dados fictícios, não um prazo imposto pela LGPD nem uma política clínica. A rotina é manual nesta versão; um ambiente contínuo deverá agendá-la e verificar sua execução.

## Testes reais

Prepare uma vez o banco de testes vazio no mesmo servidor. Por exemplo, com o Compose:

```bash
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" vitalis_test'
npm run test:db
```

Se o banco já existir, não precisa recriá-lo. `TEST_DATABASE_URL` deve apontar para esse banco. Os testes criam e removem apenas esquemas temporários com nomes gerados; não limpam tabelas da demonstração. Verificam cadastro sem elevação de privilégios, persistência, lotação concorrente, duplicidade, isolamento por conta/unidade, atualização automática, cancelamento, exportação, exclusão, revogação da sessão e permissões do usuário restrito.

Consulte [a agenda compartilhada](../docs/agendamentos-compartilhados.md) e [as decisões de privacidade](../docs/privacidade.md).
