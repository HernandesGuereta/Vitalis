# Vitalis

Monorepositório TypeScript da plataforma de doação de sangue, com aplicativo do doador e administrador desktop baseados nos PDFs de design e na logo oficial da equipe.

A etapa atual tem **cadastro de doador, login por e-mail/senha e agendamentos ligados ao PostgreSQL**. Na página inicial do mobile, o usuário faz uma pré-triagem digital curta para obter uma orientação inicial antes de sair de casa. O agendamento de doação é uma ação separada, e a reserva aparece automaticamente no desktop da unidade. Ambos usam uma única autenticação em cada aplicativo. O estoque, os cadastros administrativos e os demais fluxos anteriores continuam como demonstrações locais, identificadas separadamente.

Não há integração com hemocentros reais, decisão de aptidão clínica nem envio de e-mail ou WhatsApp. Avisos de escassez são automáticos; push nativo está preparado, com configuração e teste físico pendentes. Use somente dados fictícios. Consulte [a agenda compartilhada](docs/agendamentos-compartilhados.md), [as decisões de privacidade](docs/privacidade.md) e [o contexto do produto](docs/contexto.md).

## Stack

| Parte | Tecnologia |
| --- | --- |
| Mobile | React Native + Expo SDK 58 + TypeScript; prévia React Native Web |
| Desktop | React + Electron + electron-vite |
| API | Node.js 24 + Express 5 + driver `pg` |
| Banco | PostgreSQL 18, migrações SQL e volume Docker |
| Organização | npm workspaces e um `package-lock.json` |

As versões de React/React Native acompanham a base do Expo SDK 58. Não há ORM, orquestrador de monorepositório ou biblioteca adicional de estado/navegação.

## Preparar o ambiente

Requisitos: Node.js 24.18+ da linha 24, npm 11, Git e Docker com Compose. Para executar o desktop é necessário ambiente gráfico; para mobile, Expo Go compatível ou emulador configurado. Use `.nvmrc` com nvm, se disponível.

Na raiz:

```bash
npm ci
cp .env.example .env
```

**Não sobrescreva um `.env` já configurado.** No PowerShell, a cópia equivalente é `Copy-Item .env.example .env`.

Em uma instalação nova, substitua os marcadores no `.env`: defina `POSTGRES_PASSWORD` e use o mesmo valor nas URLs do proprietário, `DATABASE_ADMIN_URL` e `TEST_DATABASE_URL`. Defina senhas distintas de ao menos 12 caracteres para o usuário de banco `vitalis_app`, `DEMO_DONOR_PASSWORD` e `DEMO_ADMIN_PASSWORD`. `DATABASE_ADMIN_URL` usa o proprietário do banco somente para manutenção; `DATABASE_URL` usa o usuário restrito da API. Não coloque senhas em variáveis `VITE_*`, pois elas são públicas no renderer.

Nesta máquina, as senhas já foram geradas no `.env`, e o PostgreSQL usa **127.0.0.1:5433** devido a conflito na porta 5432. O exemplo mantém a porta padrão; ao alterá-la, atualize `POSTGRES_PORT` e as URLs juntas. Detalhes em [database/README.md](database/README.md).

```bash
npm run db:up
npm run db:migrate
npm run db:role
npm run db:seed
npm run db:check
```

Migrações e seed podem ser reexecutados sem apagar reservas ou redefinir senhas. O seed acrescenta horários futuros para a próxima semana. `db:role` concede os acessos necessários às tabelas após migrações.

## Executar

Use terminais separados na raiz:

```bash
# API conectada ao PostgreSQL
npm run dev:api

# Administrador Electron
npm run dev:desktop

# Prévia mobile no navegador
npm run dev:mobile:web

# Alternativa: mobile com QR code para Expo Go
npm run dev:mobile
```

A API usa loopback e porta 3000 por padrão. O Vite do desktop usa `127.0.0.1:5173`. `VITE_API_URL` configura o endereço da API no desktop; alterações exigem reiniciar o desenvolvimento ou refazer o build.

Para o celular físico, o endereço da API deve ser o IP/domínio do computador ou servidor. HTTPS é configurável por `TLS_CERT_FILE` e `TLS_KEY_FILE` e exige certificado confiável no aparelho. HTTP na rede requer `ALLOW_INSECURE_DEMO_LAN=true` e `npm run dev:api:lan`, exclusivamente para dados fictícios em rede de teste. A opção fica desligada por padrão. Veja [o guia de conexão](docs/agendamentos-compartilhados.md#celular-físico-e-https).

Também existem `npm run android --workspace @vitalis/mobile` e `npm run ios --workspace @vitalis/mobile` para emuladores configurados.

## Testar a jornada compartilhada

1. No mobile, toque em **Criar minha conta**. Informe nome e e-mail fictícios, uma senha de 12 a 128 caracteres e sua confirmação. O cadastro cria somente doadores e já abre a página inicial. Nos próximos acessos, use **Entrar**.
2. Na página inicial, toque em **Fazer pré-triagem** para responder ao questionário orientativo. As respostas ficam somente na tela e são descartadas ao sair. Para reservar uma visita, use **Agendar doação**, escolha unidade, dia e horário e confirme. Para demonstrar com o acesso padrão do desktop, escolha **Unidade Vitalis Centro**. A triagem completa e a decisão de aptidão continuam com a equipe do hemocentro.
3. No desktop, o acesso fictício já vem preenchido: **`hemocentro@vitalis.demo` / `VitalisDemo2026!`**. Clique em **Entrar no hemocentro**. Essa credencial é pública e exclusiva do protótipo, criada por `db:seed`.
4. A visão geral mostra as solicitações; abra **Agendamentos** para consultar ou cancelar. A atualização chega por conexão autenticada com a API, com consulta a cada 5 segundos como alternativa. Não há segundo login da agenda.
5. No mobile, consulte **Meus agendamentos** na página inicial ou a aba **Agenda**. Cancelamentos feitos pela unidade também aparecem ali.

Em **Conta → Meus dados** é possível corrigir o nome. Em **Conta → Privacidade**, consultar/copiar os próprios dados e excluir a conta. Sessões duram até 30 minutos e ficam apenas em memória; reabrir/recarregar exige novo login. A recuperação de senha por e-mail ainda não está implementada.

Registre entradas e saídas no desktop: a API gera mensagens prontas de escassez automaticamente, sem criação/publicação manual pelo hemocentro. Os avisos ficam no PostgreSQL e são encerrados após reposição. Consulte [avisos automáticos e push](docs/avisos-automaticos.md) para os limites, a migração e a configuração necessária para receber com o app fechado.

As reservas anteriores salvas localmente não são importadas. O mobile usa a conta autenticada e as reservas do servidor. O desktop preserva sua agenda local anterior em uma seção recolhida. Não há cadastro público de hemocentros: as contas administrativas são preparadas no banco.

O questionário usa oito perguntas básicas e uma pergunta adicional para algumas faixas de idade. Ele não libera a doação nem envia respostas ao hemocentro. As regras, fontes e limitações estão em [pré-triagem digital](docs/pre-triagem-digital.md).

## Banco e manutenção

```bash
npm run db:logs
npm run db:cleanup
npm run db:down
```

`db:down` preserva o volume. `db:cleanup` remove reservas cuja data passou há mais de 30 dias, eventos/avisos encerrados com mais de 30 dias e sessões expiradas. A limpeza é manual nesta versão. Esse prazo é uma convenção para dados fictícios, não uma regra clínica ou prazo imposto pela LGPD.

A API recusa iniciar com usuário de banco superusuário ou capaz de criar bancos/papéis. Mobile e desktop nunca recebem as credenciais do PostgreSQL.

## Validar

```bash
# Tipos, testes básicos, builds, compatibilidade Expo e bundles Android/iOS
npm run validate

# Integração real com PostgreSQL e usuário restrito
npm run test:db

# Interface completa e integração mobile → API → PostgreSQL → desktop
npm run test:mobile:ui

# Validação de agendamento: banco real e jornada visual com falhas de conexão
npm run test:appointments

# Regressão da interface anterior do administrador
npm run test:ui --workspace @vitalis/desktop
```

`test:db` e os dois testes gráficos precisam de `TEST_DATABASE_URL` apontando para um banco separado cujo nome contenha `test`. Prepare uma vez um banco `vitalis_test`, conforme [o guia do banco](database/README.md#testes-reais). Eles usam e removem esquemas temporários; não limpam a demonstração do usuário. Os testes gráficos escolhem uma porta livre para sua própria API e precisam de ambiente gráfico. A prévia mobile testada é web; execução em Android/iOS real e VoiceOver/TalkBack ainda precisam de validação.

A [validação de agendamentos](docs/validacao-agendamentos.md) descreve os cenários cobertos, incluindo última vaga, resposta perdida após gravação, reinício da API, cancelamento pelos dois aplicativos e sessão expirada. Os testes gráficos restauram o build desktop com o endereço normal da API ao terminar, inclusive quando falham.

Se os serviços Expo não estiverem acessíveis, `EXPO_OFFLINE=1 npm run validate` usa os metadados incluídos no SDK para a verificação de versões. Repita `npm run check:mobile` online para consultar as recomendações remotas.

O export mobile gera JavaScript/assets, não APK/IPA. O build desktop gera arquivos locais, sem instalador ou assinatura. Depois do build, use `npm run start:api` e `npm run start:desktop`. O aviso `preload config is missing` é esperado: ainda não há IPC ou preload nesta interface.

## Pastas

| Pasta/arquivo | Responsabilidade |
| --- | --- |
| `apps/api/src/app.ts` | Configuração Express, políticas HTTP, saúde, transparência e avisos públicos |
| `apps/api/src/routes.ts` | Cadastro exclusivo de doador, login, sessões, autorização, agenda, eventos e operações sobre os próprios dados |
| `apps/api/src/security.ts` | Derivação/verificação de senhas e tokens |
| `apps/api/src/db/` | Pool, migrações, papel restrito, seed e manutenção |
| `apps/api/tests/` | Segurança, HTTP e integração PostgreSQL isolada |
| `apps/desktop/src/main/` | Janela e ciclo de vida do Electron, com isolamento e sandbox |
| `apps/desktop/src/renderer/src/` | Interface React, navegação e estilos administrativos |
| `apps/desktop/src/renderer/src/views/` | Telas do administrador, incluindo `SharedAgendaView.tsx` |
| `apps/desktop/src/renderer/src/prototype/` | Modelos da demonstração local e cliente da API compartilhada |
| `apps/desktop/src/renderer/src/components/` | Elementos visuais compartilhados |
| `apps/desktop/tests/` | Regras locais e teste gráfico com perfil isolado |
| `apps/mobile/App.tsx` | Cabeçalho, abas, áreas seguras e navegação protegida pela sessão |
| `apps/mobile/src/screens/ScreeningScreen.tsx` | Questionário e orientação inicial, com respostas apenas na memória da tela |
| `apps/mobile/src/data/screening.ts` | Perguntas e regras orientativas, sem API ou persistência |
| `apps/mobile/src/SharedAgenda.tsx` | Sessão única, agenda, reserva, cancelamento e privacidade; dados em memória |
| `apps/mobile/src/data/` | Exemplos locais e clientes HTTP; o armazenamento antigo não participa do fluxo autenticado |
| `apps/mobile/src/screens/` | Telas baseadas no PDF da equipe |
| `apps/mobile/src/components/` | Campos, botões, cartões e ícones |
| `apps/mobile/assets/` e assets do desktop | Logo oficial, sem redesenho |
| `apps/mobile/tests/` | Regras e teste gráfico integrado com banco isolado |
| `database/migrations/` | Esquema SQL versionado |
| `docs/design/` | Referências exportadas do design e mapa das telas |
| `docs/` | Contexto, guias, integração e decisões de privacidade |

A raiz centraliza npm workspaces, lockfile, configurações TypeScript, Compose e exemplos de ambiente. `.npmrc` mantém o cache npm local ignorado. `.env`, dependências, caches e saídas (`dist/`, `dist-web/`, `out/`) são ignorados pelo Git. O Metro preserva a configuração padrão do Expo para monorepositórios.

## Git e limites

Repositório na branch `main`. Use `git status`, `git log --oneline` e `git remote -v` para inspecionar o trabalho e o destino do GitHub. O projeto não altera a configuração global do Git.

A base aplica controles técnicos de proteção de dados; não declara conformidade integral com a LGPD. Antes de dados reais, precisam ser definidos controlador, canal de atendimento, bases legais, retenção adequada, tratamento de dados sensíveis, proteção de volumes/backups e processos de direitos e incidentes. O registro das medidas e pendências está em [docs/privacidade.md](docs/privacidade.md).
