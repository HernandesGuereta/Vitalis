# Aplicativo do doador

O mobile usa React Native, Expo SDK 57 e TypeScript. A referência visual é o PDF **Vitalis • Experiência do Doador-mobile.pdf** fornecido pela equipe, com a logo oficial, cartões e cinco áreas de navegação. O fluxo atual adapta essa referência ao cadastro autenticado e ao agendamento da pré-triagem presencial.

## Executar

Prepare o PostgreSQL conforme [o guia da agenda](agendamentos-compartilhados.md). Em terminais separados na raiz:

```bash
npm run dev:api
npm run dev:mobile:web
```

Para Expo Go compatível, use `npm run dev:mobile`. Em um celular físico, configure o endereço da API em **Configurar conexão**, na tela de login/cadastro. `localhost` no celular aponta para o celular; use IP/domínio do servidor e confira [as opções de rede e HTTPS](agendamentos-compartilhados.md#celular-físico-e-https).

## Fluxo atual

1. **Criar minha conta:** nome e e-mail fictícios, senha e confirmação. O cadastro é exclusivamente de doador e inicia a sessão. Senhas têm de 12 a 128 caracteres.
2. **Entrar:** autenticação única por e-mail/senha. Recuperação de senha por e-mail ainda não está disponível; a interface informa isso.
3. **Início → Agendar pré-triagem:** escolher hemocentro, dia e horário, conferir e confirmar. A API grava a reserva no PostgreSQL e avisa o desktop da unidade. Não há questionário de saúde digital obrigatório.
4. **Meus agendamentos / Agenda:** consultar as próprias visitas e cancelar mediante confirmação. A lista é atualizada a cada 5 segundos com o aplicativo ativo.
5. **Onde doar:** lista e detalhe de duas unidades fictícias de Ourinhos, com acesso ao agendamento.
6. **Alertas:** avisos públicos do desktop e exemplos identificados, filtros por cidade/tipo, detalhe e indicação de leitura. Atualização manual, a cada 20 segundos e ao retornar ao aplicativo.
7. **Conta:** corrigir nome no servidor, ajustar preferências ilustrativas na sessão, consultar/exportar os próprios dados e excluir a conta em Privacidade.

O agendamento é para comparecer ao hemocentro para **pré-triagem presencial**. A equipe avalia a aptidão no atendimento. Não há integração com hemocentros reais, push com app fechado ou envio de e-mail/WhatsApp.

## Sincronização e armazenamento

| Informação | Comportamento |
| --- | --- |
| Nome, e-mail e derivação da senha | Conta no PostgreSQL; o cliente nunca recebe o hash da senha |
| Solicitação de agendamento | Mobile → API → PostgreSQL → desktop da unidade |
| Cancelamento | Titular ou equipe da unidade; situação consultada pelos dois aplicativos |
| Aviso público publicado | Desktop autenticado → API → feed do mobile |
| Cidade, tipo sanguíneo ilustrativo, preferências e leituras | Somente na memória da sessão; não enviados ao cadastrar ou agendar |
| Tokens e lista autenticada | Somente memória; sem AsyncStorage, localStorage ou sessionStorage |

Recarregar/reabrir exige novo login. As preferências ilustrativas também são reiniciadas. O fluxo atual não usa o módulo antigo `data/storage.ts` nem importa visitas antigas. Instalações anteriores podem manter a chave antiga `vitalis.mobile.demo.v1`; ela não é lida pelo aplicativo atual.

Os avisos ficam no PostgreSQL e o feed retorna os 200 mais recentes. Repetir a publicação com o mesmo ID atualiza o aviso sem duplicar. O aplicativo mantém a última consulta apenas em memória enquanto aberto. Os filtros comparam cidade/UF e tipo exato; não há cálculo de compatibilidade clínica, geolocalização ou raio.

## Acessibilidade

Botões principais têm pelo menos 54 pontos de altura; seletores, 50; cabeçalho e Voltar, 48. Textos principais usam 16–17 pontos e acompanham a fonte do sistema. Telas rolam e respeitam áreas seguras. Abaixo de 360 pontos ou com fonte acima de 130%, as abas se organizam em duas linhas. Ícones têm rótulos para leitores de tela, escolhas expõem seleção e erros são anunciados.

O teste gráfico cobre largura de 320 pontos e texto ampliado a 160% na prévia web. Ainda é necessário validar com pessoas, VoiceOver/TalkBack e teclados em aparelhos Android/iOS reais.

## Organização

| Caminho | Responsabilidade |
| --- | --- |
| `apps/mobile/App.tsx` | Navegação protegida, cabeçalho, abas e atualização de avisos |
| `src/SharedAgenda.tsx` | Sessão única, reserva, consulta, cancelamento e privacidade |
| `src/navigation.ts` | Telas e associação às cinco abas |
| `src/AppContext.tsx` | Preferências e ações disponíveis às telas |
| `src/components/` | Botões, campos, cartões e ícones SVG locais |
| `src/screens/MainScreens.tsx` | Início, alertas, unidades, conta e guia |
| `src/screens/AccountScreens.tsx` | Login, cadastro somente de usuário, perfil e preferências |
| `src/data/sharedApi.ts` | Cliente autenticado e identificadores de tentativa |
| `src/data/api.ts` | Consulta de avisos públicos |
| `src/data/model.ts` | Exemplos locais e filtros |
| `assets/` | Logo oficial |
| `tests/` | Regras e integração gráfica com API, PostgreSQL e desktop isolados |

## Verificar

```bash
npm run typecheck
npm run test:mobile
npm run test:api
npm run check:mobile
npm run export:mobile
npm run test:mobile:ui
```

O teste gráfico exige `TEST_DATABASE_URL` e ambiente gráfico. Usa o Electron existente para a prévia web e o administrador, com perfil e esquema temporários e uma API própria em porta livre. Verifica cadastro, login único, botão na página inicial, recebimento automático no desktop, cancelamento, persistência no servidor, correção/exportação, publicação autenticada e exclusão. Os bundles Android/iOS são verificados separadamente; isso não substitui executar em um aparelho real.

Consulte [agendamentos-compartilhados.md](agendamentos-compartilhados.md) e [privacidade.md](privacidade.md) para preparação, autorização, segurança e limitações.
