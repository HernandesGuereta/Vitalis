# Aplicativo do doador

O mobile usa React Native, Expo SDK 58 e TypeScript. A referência visual é o PDF **Vitalis • Experiência do Doador-mobile.pdf** fornecido pela equipe, com a logo oficial, cartões e cinco áreas de navegação. O fluxo atual adapta essa referência ao cadastro autenticado e à pré-triagem digital orientativa e ao agendamento de doação como ações separadas.

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
3. **Início → Fazer pré-triagem:** responder a oito perguntas básicas, com uma pergunta adicional conforme a faixa de idade. O resultado orienta sobre cuidados e dúvidas, sem confirmar aptidão. As respostas são descartadas ao sair da tela.
4. **Início → Agendar doação:** escolher hemocentro, dia e horário, conferir e confirmar. A API grava a reserva no PostgreSQL e avisa o desktop. O questionário não é condição de autorização nem é enviado com a reserva.
5. **Meus agendamentos / Agenda:** consultar as próprias visitas e cancelar mediante confirmação. A lista é atualizada a cada 5 segundos com o aplicativo ativo; falhas de atualização são informadas. Horários passados aparecem como data encerrada, sem ação de cancelar.
6. **Onde doar:** lista e detalhe de duas unidades fictícias de Ourinhos, com acesso ao agendamento.
7. **Alertas:** avisos automáticos ativos gerados pelo estoque, filtros por cidade/tipo, detalhe e indicação de leitura. Atualização manual, a cada 20 segundos e ao retornar ao aplicativo.
8. **Conta:** corrigir nome no servidor, ajustar preferências ilustrativas na sessão, consultar/exportar os próprios dados e excluir a conta em Privacidade.

A **pré-triagem digital** oferece uma orientação inicial em casa e considera apenas parte dos critérios. O **agendamento de doação** reserva uma visita à unidade fictícia. A equipe realiza a triagem completa e decide sobre a aptidão no atendimento. Não há integração com hemocentros reais nem envio de e-mail/WhatsApp. Push com app fechado está preparado para build próprio, mas requer credenciais e teste físico; consulte [o guia](avisos-automaticos.md).

## Sincronização e armazenamento

| Informação | Comportamento |
| --- | --- |
| Nome, e-mail e derivação da senha | Conta no PostgreSQL; o cliente nunca recebe o hash da senha |
| Solicitação de agendamento | Mobile → API → PostgreSQL → desktop da unidade |
| Cancelamento | Titular ou equipe da unidade; situação consultada pelos dois aplicativos |
| Aviso automático | Saldo do desktop → detecção na API → feed/push autorizado |
| Cidade, tipo sanguíneo ilustrativo e preferências | Locais; com ativação explícita de push, usados no servidor para selecionar notificações |
| Leituras de avisos | Na memória da sessão |
| Respostas e resultado da pré-triagem | Somente na memória do componente; descartados ao sair, refazer, recarregar ou encerrar a sessão; não enviados à API |
| Tokens e lista autenticada | Somente memória; sem AsyncStorage, localStorage ou sessionStorage |

Recarregar/reabrir exige novo login. As preferências ilustrativas também são reiniciadas. O fluxo atual não usa o módulo antigo `data/storage.ts` nem importa visitas antigas. Instalações anteriores podem manter a chave antiga `vitalis.mobile.demo.v1`; ela não é lida pelo aplicativo atual.

Os avisos ficam no PostgreSQL e o feed retorna até 200 avisos automáticos ativos. A API evita duplicatas no mesmo episódio e encerra o aviso após reposição. O aplicativo mantém a última consulta apenas em memória enquanto aberto. Os filtros comparam cidade/UF e tipo exato; não há cálculo de compatibilidade clínica, geolocalização ou raio.

## Acessibilidade

Botões principais têm pelo menos 54 pontos de altura; seletores, 50; cabeçalho e Voltar, 48. Textos principais usam 16–17 pontos e acompanham a fonte do sistema. Telas rolam e respeitam áreas seguras. Abaixo de 360 pontos ou com fonte acima de 130%, as abas se organizam em duas linhas. Ícones têm rótulos para leitores de tela, escolhas expõem seleção e erros são anunciados.

O teste gráfico cobre largura de 320 pontos na prévia web, inclusive nas perguntas da pré-triagem. Ainda é necessário validar com pessoas, VoiceOver/TalkBack, fontes ampliadas e teclados em aparelhos Android/iOS reais.

## Organização

| Caminho | Responsabilidade |
| --- | --- |
| `apps/mobile/App.tsx` | Navegação protegida, cabeçalho, abas e atualização de avisos |
| `src/SharedAgenda.tsx` | Sessão única, reserva, consulta, cancelamento e privacidade |
| `src/screens/ScreeningScreen.tsx` | Introdução, perguntas acessíveis, progresso e orientação inicial |
| `src/data/screening.ts` | Perguntas condicionais e avaliação orientativa local |
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
npm run test:appointments
```

O teste gráfico exige `TEST_DATABASE_URL` e ambiente gráfico. Usa o Electron existente para a prévia web e o administrador, com perfil e esquema temporários e uma API própria em porta livre. Verifica cadastro, login único, pré-triagem digital com resultados e descarte de respostas sem requisições de escrita, botão de agendamento, recebimento automático no desktop, cancelamento, persistência no servidor, correção/exportação, avisos automáticos de escassez e exclusão. Os bundles Android/iOS são verificados separadamente; isso não substitui executar em um aparelho real.

Consulte [agendamentos-compartilhados.md](agendamentos-compartilhados.md) e [privacidade.md](privacidade.md) para preparação, autorização, segurança e limitações.

O detalhamento das regras e das fontes oficiais está em [pre-triagem-digital.md](pre-triagem-digital.md).

A [validação de agendamentos](validacao-agendamentos.md) também cobre duplo clique, disputa de vaga, resposta perdida após gravar/cancelar, falha de consulta após confirmação, reinício do servidor e expiração de sessão. Os seletores e botões expõem os estados de seleção/bloqueio também na prévia web.

## Expo Go informa versão incompatível

O projeto usa SDK 58. O Expo Go do celular precisa indicar suporte ao mesmo SDK. Após atualizar dependências, encerre o Metro anterior com Ctrl+C e execute `npm run dev --workspace @vitalis/mobile -- --clear` na raiz. Leia o novo QR code. No iPhone físico, não é possível instalar uma versão antiga do Expo Go da App Store; mantenha o SDK do projeto alinhado ao aplicativo.

A API é uma conexão separada: use o IP do computador em **Configurar conexão**, com ambos os aparelhos na mesma rede. Consulte o [guia de conexão](agendamentos-compartilhados.md#celular-físico-e-https).

A migração para SDK 58 também alinha React/React DOM do desktop à versão 19.3 para evitar cópias conflitantes no monorepositório. O React Native passa a 0.88. O tipo da referência de rolagem usa `ComponentRef<typeof ScrollView>`, compatível com o novo componente. Guia seguido: [atualização oficial do Expo](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).
