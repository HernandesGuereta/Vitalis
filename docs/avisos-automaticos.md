# Avisos automáticos de escassez

## Fluxo implementado

1. O hemocentro registra entradas e saídas no desktop. O estoque ainda é fictício e local, conforme o escopo do protótipo.
2. Com sessão válida, o desktop sincroniza as quantidades agregadas dos oito tipos com a API, ao mudar o estoque e em tentativas a cada 5 segundos. Não envia dados de doadores.
3. A API determina a unidade pela sessão, valida o saldo, compara com as metas fixas e atualiza o PostgreSQL em uma transação.
4. Ao entrar em escassez, o sistema gera o texto pronto. A equipe não cria, revisa ou publica mensagens.
5. O aplicativo consulta somente os avisos automáticos ativos e filtra por cidade e tipo exato, conforme as preferências. Exemplos antigos não são misturados ao feed.
6. Se houver aparelho autorizado, uma entrega push é colocada na fila. O servidor processa a fila independentemente de o aplicativo estar aberto.

## Limites fictícios preservados

| Tipo | Meta | Baixo | Crítico |
| --- | ---: | ---: | ---: |
| O+ | 100 | até 50 | até 25 |
| O- | 40 | até 20 | até 10 |
| A+ | 80 | até 40 | até 20 |
| A- | 30 | até 15 | até 7 |
| B+ | 50 | até 25 | até 12 |
| B- | 25 | até 12 | até 6 |
| AB+ | 25 | até 12 | até 6 |
| AB- | 15 | até 7 | até 3 |

Crítico tem prioridade sobre baixo. Os limites são os mesmos do modelo desktop: até 50% e até 25% da meta, considerando quantidades inteiras. São parâmetros demonstrativos, sem validade clínica ou operacional para um hemocentro real.

Exemplo: O+ com 84 bolsas não gera aviso. Uma saída de 34 deixa 50 e gera “Estoque baixo de O+”. Outra saída de 25 deixa 25 e atualiza para crítico. Uma entrada de 26 deixa 51 e encerra o aviso.

## Repetição, reposição e falhas

- Há um aviso ativo por unidade/tipo. Repetir o mesmo saldo ou a mesma tentativa não duplica o aviso.
- A API guarda revisão e identificador da última sincronização; concorrência com revisão antiga retorna conflito. Uma resposta perdida pode repetir o mesmo identificador e corpo.
- No mesmo episódio, cada gravidade é notificada no máximo uma vez por aparelho na fila. Oscilar entre baixo/crítico não cria novas mensagens. Se a piora ocorrer antes do envio, a mensagem pendente de nível inferior é cancelada.
- Na reposição acima de 50%, o aviso sai do feed e as entregas ainda pendentes são canceladas. Uma nova escassez depois da reposição inicia outro episódio.
- Avisos já encaminhados ao provedor não podem ser retirados da tela bloqueada. Uma notificação pode ser recebida depois da reposição; o aplicativo consulta a situação atual ao abrir.
- Sem API, o desktop preserva os dados locais e mostra que a sincronização está pendente. Não declara envio concluído. Ao reconectar, sincroniza o saldo atual, sem reproduzir cada oscilação antiga ocorrida offline.
- Esta sincronização é para uma instalação desktop por unidade. O histórico de movimentações ainda não é um estoque central multioperador. Não usar vários computadores com cópias locais diferentes como fontes da mesma unidade; centralizar as movimentações é uma próxima etapa.
- A detecção depende de um desktop autenticado sincronizando. Não há leitura de bancos reais de hemocentros nem monitoramento de movimentos com o desktop fechado.

## Notificações com o aplicativo fechado

### O que está preparado

`expo-notifications` e `expo-constants` fornecem o registro nativo. Em Conta → Preferências de alertas, a pessoa pode ativar notificações, autorizar o sistema e registrar o aparelho; cidade, tipo opcional e filtros só são armazenados para push após essa autorização. A notificação na tela bloqueada usa texto genérico, sem tipo sanguíneo ou dados de saúde. Ao tocar, abre a área Alertas; se necessário, primeiro exige login.

A fila em `push_deliveries` sobrevive ao reinício da API. O worker envia pelo Expo Push Service, guarda o ticket e consulta recibos após 15 minutos. `receipt_ok` significa confirmação do provedor, não leitura ou garantia de entrega física. Falhas transitórias usam espera crescente; token inválido é removido. Recusa de credenciais fica registrada como falha. Retentativas após resposta de rede perdida podem produzir duplicação no provedor; a fila não promete entrega exatamente uma vez.

Desativar remove o cadastro e a fila da conta em todos os aparelhos. Sair voluntariamente também revoga o cadastro push da conta. Excluir a conta remove inscrições e entregas associadas. Exportar os dados inclui preferências e data da autorização, sem expor o token do aparelho.

### O que falta para receber push real

**Ainda não houve envio real nem teste de entrega em aparelho.** A equipe informou não possuir Apple Developer. No iPhone físico, um build assinado com push exige essa conta e credenciais APNs. Expo Go e a prévia web não são o ambiente de validação desta integração; exibem uma explicação ao tentar ativar.

1. Vincular o projeto ao Expo/EAS. Definir `EXPO_PUBLIC_EAS_PROJECT_ID` no ambiente do build; `apps/mobile/app.config.ts` usa esse ID público. Nunca colocar credenciais Apple/FCM ou token de acesso Expo em variável `EXPO_PUBLIC_*`.
2. Configurar identificadores próprios do app e credenciais APNs (iOS) ou FCM v1 (Android) pelo processo oficial. `apps/mobile/eas.json` contém perfil `preview` para distribuição interna, com APK Android. Nenhum projeto externo ou build pago foi criado automaticamente.
3. Criar o build próprio. No Android, o teste não depende de Apple Developer; ainda exige projeto/credenciais FCM. No iPhone, aguardar Apple Developer e o provisionamento do aparelho.
4. Instalar o build, entrar na conta e ativar notificações nas preferências. Em Expo Go/navegador não é informado um falso sucesso.
5. Ativar a segurança de acesso do Expo Push Service e colocar o token **somente no servidor** em `EXPO_PUSH_ACCESS_TOKEN`. Definir `PUSH_ENABLED=true` e reiniciar a API. Sem essas configurações, a fila não é enviada e a interface informa que o envio não foi ativado.
6. Manter API e internet disponíveis. Para abrir o conteúdo fora do Wi-Fi de teste, disponibilizar uma API HTTPS acessível ao aparelho e configurá-la no build/acesso. Um endereço LAN do Mac não funciona fora dessa rede.
7. Testar em aparelho: conceder/negar/revogar permissão, fechar o app, cruzar os limiares no desktop, verificar a notificação e tocar para abrir, além de testar filtros, reposição, saída e exclusão.

Consulte a [configuração oficial de push do Expo](https://docs.expo.dev/push-notifications/push-notifications-setup/) e o [envio e recibos](https://docs.expo.dev/push-notifications/sending-notifications/). Não há garantia de entrega quando o sistema operacional bloqueia notificações, o aparelho está sem conexão ou o app foi encerrado à força sob restrições do sistema.

## Banco, rotas e execução

Antes de usar a versão nova, executar na raiz:

```bash
npm run db:migrate
npm run db:role
```

A migração `003_automatic_stock_alerts.sql` cria estado agregado, inscrições e fila, e acrescenta campos aos avisos. Publicações manuais antigas são preservadas no banco como histórico, sem aparecer como escassez ativa. `POST /demo/alerts` administrativo retorna 410; doadores não podem publicar nem alterar estoque.

| Rota | Acesso e finalidade |
| --- | --- |
| GET /v1/stock | Revisão e saldo da própria unidade |
| POST /v1/stock/sync | Administrador; saldo agregado, revisão e tentativa idempotente |
| GET /v1/stock/alerts | Avisos ativos da própria unidade |
| GET /demo/alerts | Feed público, sem tokens nem destinatários |
| POST /v1/push/subscriptions | Doador; aparelho e preferências mediante autorização |
| GET/PATCH /v1/push/preferences | Próprias preferências autorizadas |
| DELETE /v1/push/subscriptions | Revogação de todos os aparelhos da própria conta |

`PUSH_ENABLED=false` é o padrão. Sem push configurado, os avisos no aplicativo continuam funcionando.

## Verificação

`npm run test:db` inclui cenários com PostgreSQL real e usuário restrito: limites, autorização por unidade, saldos inválidos, repetição concorrente, revisão obsoleta, piora, oscilação, reposição, novo episódio, reinício e fila push. O transporte de push é simulado nesses testes: não são feitas chamadas a aparelhos ou provedores reais.

`npm run test:mobile:ui` verifica movimentação no desktop → aviso baixo → crítico → encerramento no mobile, além de agendamentos, pré-triagem, privacidade e indicação de que o navegador não oferece push nativo. O teste desktop verifica a remoção da ação manual. Bundles nativos e Expo Doctor verificam a configuração; não substituem a validação física pendente.
