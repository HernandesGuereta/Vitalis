# Revisão da experiência Vitalis — 22/10/2026

Branch: `fix/revisao-experiencia-usuario`. Escopo: interfaces e mensagens; sem mudanças no banco, endpoints, regras de agendamento, critérios da pré-triagem ou dependências.

## Referências e método

Comparação do código e das capturas do protótipo com as 20 telas administrativas de `design/vitalis-admin-referencia.pdf` e as 23 páginas do PDF mobile fornecido em Downloads. As páginas mobile foram renderizadas com PDFKit; os estados reais foram capturados em Electron com perfil e banco de testes isolados. O arquivo vivo do Figma não foi consultado nesta revisão; os PDFs são a referência verificável, e alterações posteriores do Figma não foram comparadas.

A análise cobre acesso, cadastro, recuperação, início, unidades, pré-triagem, reserva, agenda, alertas, conta, perfil, preferências, privacidade e guia no mobile; acesso, visão geral, estoque, movimentações, doadores, doações, agenda, alertas e configurações no desktop. A identidade já se aproximava das referências: logo oficial, fundo claro, cartões brancos/rosados, bordô e navegação persistente.

## Problemas encontrados e tratamento

| Gravidade | Problema | Melhoria |
| --- | --- | --- |
| Alta | Retorno silencioso ao login quando a sessão expira | Mensagem persistente no login de ambos os clientes, limpa no novo acesso; saída voluntária continua sem aviso de expiração. |
| Alta | Agenda e resumo administrativo aparentavam estar vazios antes da primeira resposta ou quando a consulta falhava | Carregamento explícito; ausência de registros somente após consulta bem-sucedida; erro separado dos dados anteriores. |
| Média | Desktop com largura mínima de 900 px e textos menores em janela compacta | Layout reorganizado abaixo de 760 px, formulários em uma coluna, navegação em grade e tabelas com rolagem interna. |
| Média | Ações pequenas e navegação por teclado sem foco no novo conteúdo | Ações de tabela e ícones com mínimo de 44 px; foco no título após navegar; tabelas alcançáveis por Tab, com nome acessível e contorno de foco. |
| Média | Contraste fraco de limites dos campos e vermelho de pequenos textos | Campos com limite mais escuro; pequenos textos vermelhos usam o tom principal existente; texto secundário escurecido. |
| Média | Botão Agendar na agenda levava ao início | Acesso direto à seleção da unidade e horário. |
| Média | Unidade anunciava amanhã/9h–10h sem consultar a agenda | Orientação para consultar a disponibilidade na tela de agendamento. |
| Média | Erros de autenticação fora da área visível | Erro no início do formulário com rolagem ao topo; rótulos e preenchimento preservados. |
| Média | Falhas HTTP e respostas inválidas confundidas com perda de rede | Mensagens separadas para rede, servidor temporariamente indisponível, sessão e formato inesperado. |
| Média | Logo e sino sobrepostos no mobile a 320 px com zoom de 150% | Cabeçalho reorganizado em linhas, com teste de não sobreposição. |
| Baixa | Resumo de solicitações encostado nos indicadores e na ação | Espaçamento próprio entre título, conteúdo, botão e o próximo bloco. |
| Baixa | Confirmações sem anúncio acessível uniforme | Avisos desktop com `role=status`; mobile com região de anúncio educado; erros mantêm anúncio urgente. |
| Baixa | Recuperação de acesso parecia disponível e cópia de dados não explicava a interação | Limitação de recuperação indicada no link; instrução de seleção/cópia junto aos dados consultados. |

Os fluxos demonstrativos existentes já sinalizam simulação: alertas de exemplo, envio simulado, unidades fictícias, preferências locais e recuperação sem envio. Não foram criados controles sem ação. O bloqueio de controles durante operações foi mantido e estendido às alternativas de cancelamento administrativo.

## Acessibilidade e conferência visual

Logo oficial e arquivos de imagem preservados. Mantidos bordô, rosa e cor primária; o vermelho de texto foi harmonizado com a cor primária existente. Contrastes calculados por luminância sRGB: desktop branco/primária 5,97:1; primária/rosa 5,22:1; texto secundário/fundo 5,42:1; borda de campo/branco 3,50:1; branco/primária mobile 6,18:1. Esses números verificam os pares indicados, não constituem certificação integral de acessibilidade.

Mobile mantém fontes escaláveis do React Native, botões de pelo menos 54 px, opções de 50 px e navegação com rótulos. Desktop ganhou ações de 44 px, foco visível e tabelas acessíveis por teclado. Em zoom alto, o cabeçalho e as abas mobile ocupam mais altura; o conteúdo permanece rolável.

## Verificações

- `npm run typecheck`: aprovado.
- `EXPO_OFFLINE=1 npm run validate`: aprovado; inclui 23 testes de modelo/segurança, builds e exportações Android/iOS. A conferência de compatibilidade Expo usa metadados locais em modo offline.
- `EXPO_OFFLINE=1 npm run test:mobile:ui`: aprovado com PostgreSQL e API reais em ambiente isolado, incluindo pré-triagem sem envio de respostas, agendamentos, falhas de rede, resposta perdida, cancelamentos, publicação, privacidade, exclusão, sessão expirada, navegação direta e layout estreito/zoom.
- `npm run test:ui --workspace @vitalis/desktop`: aprovado; cenários administrativos, foco no título, tabelas focáveis e layout em janela de 640 px com zoom de 150%. O teste foi ajustado para fechar conexões HTTP de atualização ao limpar o ambiente isolado.
- `git diff --check`: sem problemas de espaços.

Capturas de validação disponíveis durante esta sessão em `/tmp/vitalis-ux-after-mobile/` e `/tmp/vitalis-ux-after-desktop/`; não integram o repositório.

## Diferenças preservadas em relação aos PDFs/Figma

- Arial/Helvetica e fontes nativas continuam substituindo as fontes exportadas como FigmaGlyphs. Não há garantia de equivalência pixel a pixel.
- Mobile usa avatar genérico, cadastro único reduzido, pré-triagem curta separada da reserva, aba Agenda e privacidade adicional. São adaptações às decisões do projeto e à minimização de dados.
- Reserva é confirmada na própria tela; o PDF usa etapas separadas de revisão/confirmação. Não foi alterado o fluxo funcional existente.
- Agenda administrativa usa dados da API e mantém exemplos locais identificados; indicadores e datas variam. Não se copiam contagens estáticas do PDF.
- Tipografia, bordas, alvos e redistribuição em janelas estreitas privilegiam legibilidade e acesso, produzindo espaçamentos diferentes da referência fixa de 1440 × 1000 e 390 × 844.
- Recuperação por e-mail, foto personalizada, push, WhatsApp e histórico clínico integrado continuam fora do protótipo. As limitações permanecem sinalizadas.

## Validação humana ainda necessária

Testes gráficos executados no Electron/React Native Web; exportações nativas aprovadas, mas não houve teste em aparelho físico, VoiceOver/TalkBack ou diferentes escalas nativas de fonte. Recomenda-se uma rodada com doadores jovens, adultos e idosos, teclado virtual e leitores de tela antes de considerar a experiência validada para todos os públicos. Não se declara conformidade integral com WCAG a partir desta revisão.
