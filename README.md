# Vitalis

Estrutura inicial da plataforma de doação de sangue Vitalis, organizada como um monorepositório com **npm workspaces** e **TypeScript**.

O contexto do produto vem do artigo final fornecido pela equipe: conectar doadores e hemocentros e, futuramente, apoiar a gestão de doações, estoques, pré-triagem e comunicação. Consulte [docs/contexto.md](docs/contexto.md) para o resumo e a decisão de stack. O artigo cita Java/Spring Boot e MySQL; este repositório segue a solicitação atual, com Express e PostgreSQL.

**Escopo atual:** somente configuração e pontos de entrada executáveis. Mobile e desktop mostram uma mensagem de inicialização. A API inicia o Express sem rotas; uma requisição retorna `404`, como esperado. Não há cadastros, autenticação, regras clínicas, tabelas, conexão com banco ou integrações entre aplicações.

## Stack

| Parte | Base |
| --- | --- |
| Mobile | React Native + Expo SDK 57 + TypeScript |
| Desktop | React + Electron + TypeScript; Vite e electron-vite para desenvolvimento e build |
| API | Node.js 24 + Express 5 + TypeScript |
| Banco local | PostgreSQL 18 via Docker Compose, opcional nesta etapa |
| Monorepositório | npm workspaces, um único `package-lock.json` |

As versões de React e React Native do mobile acompanham o template oficial do Expo SDK 57. O desktop utiliza a mesma versão de React para evitar duplicações. Não há Nx, Turborepo, ORM, bibliotecas de navegação, estado ou notificações nesta base.

## Requisitos

- Node.js **24.18.0 ou superior da linha 24** e npm **11**. Com nvm, execute `nvm install` e `nvm use`; a versão está em `.nvmrc`.
- Git.
- Para o mobile: Expo Go compatível com SDK 57 ou emulador Android/iOS. Android exige Android Studio; o simulador iOS exige macOS e Xcode.
- Para abrir o desktop: ambiente gráfico compatível com Electron.
- Para o banco em container: Docker com Compose v2 e serviço Docker em execução. Ele não é necessário para iniciar as aplicações nesta etapa.

## Instalação

Na raiz do projeto:

```bash
npm ci
cp .env.example .env
```

No PowerShell, use `Copy-Item .env.example .env`. Não sobrescreva um `.env` que já tenha sido configurado.

`npm ci` instala todos os workspaces a partir do lockfile; não é preciso instalar dependências em cada pasta. Para adicionar ou atualizar dependências, use `npm install` na raiz com `--workspace @vitalis/<aplicação>`.

O `.npmrc` mantém o cache npm em `.npm-cache/`, ignorado pelo Git, e registra versões exatas ao adicionar dependências. O `.env` também é ignorado; somente `.env.example` deve ser versionado. As credenciais do exemplo são destinadas ao desenvolvimento local.

## Execução em desenvolvimento

Use terminais separados, todos na raiz. As aplicações ainda são independentes.

```bash
# Aplicativo mobile: inicia o Metro e apresenta o QR code do Expo
npm run dev:mobile

# Sistema desktop: inicia o Vite e abre a janela Electron
npm run dev:desktop

# API: inicia o Express com reinício automático ao alterar TypeScript
npm run dev:api
```

No terminal do Expo, pressione `a` para Android ou `i` para o simulador iOS. Também é possível executar:

```bash
npm run android --workspace @vitalis/mobile
npm run ios --workspace @vitalis/mobile
```

Em um dispositivo físico, use uma versão do Expo Go compatível com o SDK do projeto e mantenha computador e celular na mesma rede. Veja a [orientação oficial sobre incompatibilidade de SDK](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/).

A API usa `HOST=127.0.0.1` e `PORT=3000` por padrão e lê o `.env` da raiz com o suporte nativo do Node.js. O desktop usa `127.0.0.1:5173` internamente em desenvolvimento. O mobile ainda não faz chamadas à API. Quando essa integração for implementada, o acesso de um celular físico exigirá configurar a API para escutar na rede e usar o IP do computador.

## PostgreSQL local

Após criar o `.env`:

```bash
npm run db:up
npm run db:check
npm run db:logs
npm run db:down
```

`db:up` aguarda o healthcheck do PostgreSQL. A conexão local será em `localhost:5432`, com banco, usuário e senha definidos no `.env`. A porta pode ser alterada por `POSTGRES_PORT`; atualize também `DATABASE_URL` ao modificar os parâmetros de conexão.

O volume nomeado `postgres_data` preserva os dados ao encerrar o serviço com `db:down`. A pasta [database/](database/README.md) documenta o espaço reservado para a futura modelagem e migrações. A API ainda não utiliza `DATABASE_URL`; nenhum driver ou ORM foi instalado.

## Validação e builds

```bash
# Verifica os tipos das três aplicações
npm run typecheck

# Compila a API e o desktop
npm run build

# Verifica compatibilidade das dependências do Expo
npm run check:mobile

# Gera bundles JavaScript e assets para Android e iOS
npm run export:mobile

# Executa as quatro verificações acima
npm run validate
```

O export mobile valida o empacotamento JavaScript das duas plataformas; não gera APK/IPA nem substitui a execução em dispositivo. O build desktop gera os arquivos locais do Electron, sem instaladores ou assinatura. As verificações de tipos e builds não exigem PostgreSQL.

O desktop ainda não precisa de IPC nem de um script de preload. Por isso, o electron-vite pode emitir o aviso `preload config is missing`; o build de `main` e `renderer` continua normalmente.

Depois de `npm run build`, os pontos de entrada compilados podem ser executados com:

```bash
npm run start:api
npm run start:desktop
```

As saídas ficam em `apps/api/dist/`, `apps/desktop/out/` e `apps/mobile/dist/`; são ignoradas pelo Git. Não há testes de funcionalidades, pois nenhuma funcionalidade foi implementada.

## Estrutura de pastas

```text
vitalis/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── app.ts
│   │       └── server.ts
│   ├── desktop/
│   │   ├── electron.vite.config.ts
│   │   └── src/
│   │       ├── main/
│   │       │   └── index.ts
│   │       └── renderer/
│   │           ├── index.html
│   │           └── src/
│   │               ├── main.tsx
│   │               └── styles.css
│   └── mobile/
│       ├── App.tsx
│       ├── app.json
│       └── index.ts
├── database/
│   └── README.md
├── docs/
│   └── contexto.md
├── .env.example
├── .gitignore
├── .gitattributes
├── .editorconfig
├── .npmrc
├── .nvmrc
├── compose.yaml
├── package.json
├── package-lock.json
└── tsconfig.base.json
```

| Pasta | Responsabilidade |
| --- | --- |
| `apps/` | Aplicações executáveis e independentes, registradas como workspaces. |
| `apps/api/` | Configuração e dependências da API Express. |
| `apps/api/src/` | `app.ts` configura o Express; `server.ts` abre o servidor HTTP. Futuras rotas e regras ficarão nesta aplicação. |
| `apps/desktop/` | Configurações de build e TypeScript do Electron e do React. |
| `apps/desktop/src/main/` | Processo principal do Electron, responsável pela janela e pelo ciclo de vida da aplicação. |
| `apps/desktop/src/renderer/` | Documento HTML e interface executados no processo de renderização, isolado do Node.js. |
| `apps/desktop/src/renderer/src/` | Ponto de montagem React e estilos da tela inicial mínima. |
| `apps/mobile/` | Aplicação Expo: `index.ts` registra a raiz; `App.tsx` é a tela mínima; `app.json` define os metadados. |
| `database/` | Reserva documentada para modelagem, migrações e convenções PostgreSQL, ainda sem esquema. |
| `docs/` | Contexto do produto e decisões técnicas iniciais. |

Na raiz, `package.json` centraliza os comandos; `package-lock.json` fixa a árvore instalada; `tsconfig.base.json` compartilha verificações estritas. Cada aplicação mantém a resolução de módulos e os tipos adequados ao seu ambiente. O `.editorconfig` padroniza edição; `.gitattributes` padroniza finais de linha; `.gitignore` exclui segredos, caches e builds.

Pastas e pacotes compartilhados serão criados quando houver código realmente reutilizável. O mobile preserva a configuração padrão do Metro para monorepositórios Expo, sem ajustes manuais de resolução.

## Git

Repositório local com branch inicial `main`, sem remoto configurado. Não há alterações de configuração global do Git. Para inspecionar o estado:

```bash
git status
git log --oneline
```

Um remoto pode ser adicionado posteriormente, quando o endereço do repositório da equipe estiver definido.

## Observações da validação inicial

- Tipos das três aplicações, builds da API e do desktop e exportação mobile Android/iOS verificados.
- API verificada por HTTP em porta temporária, a partir do TypeScript e do JavaScript compilado; ambas responderam `404`, pois ainda não existem rotas.
- Desktop compilado executado no Electron: tela React renderizada, `contextIsolation` e sandbox ativos e Node.js indisponível no renderer.
- A consulta online do Expo expirou neste ambiente. A checagem de dependências passou em modo offline, usando os metadados incluídos no SDK; repita `npm run check:mobile` com acesso aos serviços Expo para consultar também as recomendações remotas.
- Docker não está instalado no ambiente usado nesta etapa. O YAML do Compose foi analisado, mas a inicialização e o healthcheck reais do PostgreSQL ainda precisam ser executados com `npm run db:up` e `npm run db:check`.
- A auditoria npm apontou **15 alertas de severidade alta**, propagados a partir das dependências transitivas `braces@3.0.3` e `node-forge@1.4.0` no ecossistema Expo/Metro. Essas eram as últimas versões publicadas na consulta inicial; a correção permanece pendente de atualização dessas dependências. O resultado da auditoria é separado das verificações de tipos e builds.

## Referências técnicas

- [Expo: monorepositórios](https://docs.expo.dev/guides/monorepos/)
- [Expo: TypeScript](https://docs.expo.dev/guides/typescript/)
- [electron-vite: desenvolvimento e builds](https://electron-vite.org/guide/)
- [Electron: isolamento de processos](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [PostgreSQL: imagem Docker oficial](https://hub.docker.com/_/postgres)
