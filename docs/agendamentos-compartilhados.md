# Agenda compartilhada

O mobile e o desktop agora consultam a mesma API e o mesmo PostgreSQL para agendamentos. São unidades e contas fictícias. A integração é de reserva/cancelamento; não confirma aptidão, não registra atendimento clínico e não altera o estoque.

## Preparar e iniciar

Nesta máquina, o banco foi preparado na porta **5433**. As credenciais foram geradas no `.env` local. Não sobrescreva esse arquivo e não publique suas senhas.

Para uma nova instalação, configure as URLs e senhas descritas em [database/README.md](../database/README.md), depois execute na raiz:

```bash
npm ci
npm run db:up
npm run db:migrate
npm run db:role
npm run db:seed
```

Inicie em terminais separados:

```bash
npm run dev:api
npm run dev:desktop
npm run dev:mobile:web
```

A prévia web e o desktop usam `http://127.0.0.1:3000`. O PostgreSQL fica em outra porta e não deve ser informado no aplicativo.

## Acesso e cadastro

O mobile e o desktop têm login por e-mail e senha na entrada do aplicativo. Não existe autenticação separada da agenda nem entrada que ignore o login.

- **Doador:** toque em **Criar minha conta** no mobile. Informe nome e e-mail fictícios, senha de 12 a 128 caracteres e sua confirmação. O cadastro já inicia a sessão. Nos próximos acessos, use o mesmo e-mail e senha.
- **Hemocentro Centro:** `hemocentro@vitalis.demo`, senha `VitalisDemo2026!`. Esses campos já vêm preenchidos no desktop. O seed cria essa conta pública exclusivamente para demonstração.
- **Contas adicionais para testar isolamento:** `ana@exemplo.com` e `lucas@exemplo.com` usam `DEMO_DONOR_PASSWORD`; `renata@unidade.exemplo` e `equipe.jardim@unidade.exemplo` usam `DEMO_ADMIN_PASSWORD`, definidos no `.env`.

O cadastro público aceita somente doadores. A API rejeita campos de papel/unidade, e o usuário restrito do banco não pode inserir esses campos. Não há cadastro público de hemocentros nem recuperação de senha por e-mail nesta fase.

## Demonstrar o agendamento e o cancelamento

1. Entre no mobile e toque em **Agendar pré-triagem** na página inicial.
2. Escolha **Unidade Vitalis Centro**, dia e horário; confira os dados e toque em **Confirmar agendamento**. O servidor valida as vagas e vincula a reserva ao usuário autenticado.
3. Entre no desktop com o acesso predefinido. A visão geral apresenta **Solicitações de pré-triagem**; abra **Ver agendamentos recebidos** ou **Agendamentos** para consultar a tabela.
4. Ao confirmar no mobile, a reserva aparece automaticamente na unidade correspondente. O desktop recebe um evento autenticado da API após a gravação no PostgreSQL e consulta a lista atual. Também consulta a cada 5 segundos enquanto a tela está aberta, caso a conexão de eventos caia.
5. No mobile, abra **Meus agendamentos** na página inicial ou a aba **Agenda**. A lista também é consultada a cada 5 segundos com o aplicativo ativo.
6. Cancele pelo mobile ou pelo desktop, confirmando a ação. A situação passa para Cancelado e a vaga é liberada. Apenas reservas futuras e ativas podem ser canceladas.

A solicitação é para comparecer ao hemocentro e realizar a **pré-triagem presencial**. Não há questionário digital obrigatório, avaliação de aptidão ou confirmação de doação pelo aplicativo.

A conexão de eventos usa SSE com token no cabeçalho Authorization, sem token na URL. O servidor revalida a sessão e encerra a conexão ao expirar. A notificação imediata funciona no processo atual da API; múltiplas instâncias exigirão distribuição dos eventos. A consulta periódica continua lendo o estado autoritativo do PostgreSQL.

O servidor controla duas vagas por horário e uma reserva ativa por doador/dia. Tentativas simultâneas são validadas em transação no PostgreSQL. Repetir a mesma tentativa não duplica a reserva. Uma falha de rede pode ocorrer depois de o servidor gravar: atualize a agenda antes de tentar novamente.

O seed disponibiliza os sete dias seguintes, às 09:00, 09:30 e 10:00. Reexecutá-lo acrescenta os próximos dias sem substituir reservas existentes. A gestão visual de horários e capacidade fica para uma próxima etapa.

## Avisos públicos

Para **Publicar no aplicativo**, o administrador precisa estar autenticado no desktop. A API determina a unidade pela sessão, valida o papel e salva o aviso no PostgreSQL. Não há publicação anônima. O mobile continua consultando o conteúdo público de avisos sem enviar dados de destinatários.

## Celular físico e HTTPS

Use `npm run dev:mobile` e o Expo Go compatível com SDK 57. O endereço no celular deve ser o IP ou domínio do computador/servidor, não `localhost`. Antes de entrar ou criar a conta, abra **Configurar conexão** e informe o endereço da API. Também é possível definir `EXPO_PUBLIC_API_URL` ao iniciar o Expo; essa variável contém somente um endereço público, nunca credenciais.

A API aceita HTTP sem configuração adicional apenas em loopback, para demonstração no próprio computador. Para a rede local, a configuração recomendada é HTTPS, usando `TLS_CERT_FILE` e `TLS_KEY_FILE` com certificado confiável pelo celular. Configure `VITE_API_URL` no `.env` para o endereço HTTPS do desktop e reinicie o desenvolvimento ou refaça o build. A configuração do Electron atualiza a política de conexão para essa origem exata. Nunca desabilite a verificação de certificados.

Para testar **exclusivamente contas e dados fictícios** em uma rede confiável, é possível habilitar `ALLOW_INSECURE_DEMO_LAN=true` no `.env` e iniciar `npm run dev:api:lan`. Isso não cifra credenciais ou reservas em trânsito e não deve ser usado com dados reais. A opção fica desabilitada por padrão. Em produção, a API recusa iniciar sem TLS direto; um proxy HTTPS exigirá configuração específica de implantação, ainda fora desta etapa.

## Privacidade da conta

Em **Conta → Meus dados** e **Conta → Privacidade** é possível:

- Corrigir o nome da conta no servidor.
- Consultar e copiar dados da própria conta, reservas e eventos associados, sem senha ou token.
- Excluir a conta fictícia após escrever **EXCLUIR**. Isso elimina suas reservas e sessões; eventos anteriores ficam sem vínculo com a conta até a limpeza.
- Sair da conta, revogando a sessão atual. Todas as sessões têm validade de até 30 minutos.

Sessões e reservas autenticadas ficam apenas na memória dos clientes. Ao reabrir/recarregar o aplicativo, é necessário entrar novamente. O mobile mantém preferências e avisos recebidos em memória e não carrega o armazenamento antigo de perfil/visitas. A agenda administrativa local anterior permanece em uma seção recolhida do desktop, sem importação automática para o banco.

Consulte [privacidade.md](privacidade.md) para os controles aplicados e as pendências anteriores a dados reais.

## Rotas

| Método e rota | Acesso |
| --- | --- |
| `GET /health` | Estado do banco, sem detalhes internos |
| `GET /privacy` | Informações do tratamento no protótipo |
| `POST /v1/auth/register` | Cadastro somente de doador; nome, e-mail e senha; limite de tentativas |
| `POST /v1/auth/login` | Credenciais; limite de tentativas |
| `POST /v1/auth/logout` | Sessão autenticada |
| `GET /v1/me` | Próprio perfil |
| `PATCH /v1/me` | Correção do próprio nome |
| `GET /v1/units` | Conta autenticada |
| `GET /v1/slots?unitId=centro` | Conta autenticada |
| `GET /v1/appointments` | Doador: próprias reservas; administrador: própria unidade |
| `GET /v1/appointments/events` | Eventos SSE da própria unidade; somente administrador |
| `POST /v1/appointments` | Doador; apenas ID do horário e ID da tentativa |
| `POST /v1/appointments/:id/cancel` | Titular da reserva ou administrador da unidade |
| `GET /v1/me/export` | Próprios dados |
| `DELETE /v1/me` | Conta de doador, confirmação explícita |
| `GET /demo/alerts` | Conteúdo público |
| `POST /demo/alerts` | Administrador da unidade autenticado |

## Verificar

```bash
npm run validate
npm run test:db
npm run test:mobile:ui
npm run test:ui --workspace @vitalis/desktop
```

`validate` não exige PostgreSQL para seus testes básicos. Os testes de banco e de interface exigem `TEST_DATABASE_URL` preparado e o usuário `vitalis_app` criado. Os testes gráficos usam uma porta livre para sua API, sem interromper a API da demonstração. Os testes usam dados e esquemas temporários, preservando a demonstração do usuário. A validação gráfica do mobile é pela prévia web, não por um aparelho Android/iOS real.
