# Contexto do Vitalis

Referência: artigo acadêmico **Artigo Final - Vitalis 5T (1).pdf**, fornecido pelo usuário, especialmente as seções 1, 3 e 4. O arquivo original permanece fora do repositório.

O Vitalis pretende aproximar doadores de sangue e hemocentros, melhorar a comunicação sobre necessidades de tipos sanguíneos e apoiar a continuidade das doações.

O artigo apresenta como possibilidades de evolução:

- Cadastro de doadores e histórico de doações, com vínculo entre doador e doação.
- Gestão de estoque e movimentação de bolsas de sangue pelos hemocentros.
- Pré-triagem digital e orientações ao doador.
- Agendamentos e notificações direcionadas, incluindo e-mail e WhatsApp.
- Proteção dos dados pessoais e sensíveis no desenho da solução.

Esses pontos registram o contexto do produto. O desktop agora tem simulações locais de estoque, movimentações, cadastros, doações vinculadas, agenda e comunicação, com dados fictícios. Critérios clínicos, requisitos legais e integrações precisarão ser especificados e validados antes da implementação operacional.

## Decisão técnica desta etapa

O artigo descreve React, Java/Spring Boot e MySQL. A solicitação atual define a base deste repositório: React Native com Expo para mobile, React com Electron para desktop, Node.js com Express para API e PostgreSQL, com TypeScript nas aplicações.

O mobile é destinado ao futuro relacionamento com doadores; o desktop, à futura operação dos hemocentros. Ambos deverão consumir a API; a API será a responsável pelo acesso ao PostgreSQL. Nesta fase, a API compartilha avisos públicos e agendamentos pelo PostgreSQL. A agenda usa contas fictícias, sessões e autorização por titular/unidade; estoque e cadastros anteriores permanecem locais.

As tecnologias e integrações citadas no artigo servem como referência de contexto, sem substituir a stack solicitada ou ampliar o escopo desta etapa.

## Protótipo administrador

A equipe decidiu começar pela operação administrativa desktop, usando um hemocentro fictício porque não há acesso aos bancos de sangue dos hemocentros. O acesso inicial do desktop agora autentica na API com uma conta fictícia predefinida. A agenda e os avisos usam PostgreSQL; os fluxos administrativos de estoque, movimentações e cadastros anteriores continuam locais após o login. Consulte [prototipo-desktop.md](prototipo-desktop.md) para o escopo e as limitações desta fase.

## Referência visual fornecida pela equipe

O arquivo [Vitalis • Experiência do Doador](https://www.figma.com/design/WZSzlF5Gxj2g1Ir7EbAysk/Vitalis-%E2%80%A2-Experi%C3%AAncia-do-Doador) foi indicado como base visual do software e fonte da logo oficial. Após a integração atingir o limite de consultas, a equipe forneceu o PDF exportado com 43 páginas e a imagem da logo.

Foram selecionadas as 20 telas de administrador/hemocentro, preservadas em [design/vitalis-admin-referencia.pdf](design/vitalis-admin-referencia.pdf). O desktop segue os layouts dessas páginas; as telas da área do doador foram excluídas deste escopo. A marca provisória foi substituída pela imagem original da logo embutida no PDF, correspondente à logo enviada pela equipe. O [mapa das referências](design/README.md) relaciona cada tela à página do documento original.

## Protótipo mobile

A equipe forneceu o PDF **Vitalis • Experiência do Doador-mobile.pdf**, com 23 telas. O aplicativo segue essa referência e a logo oficial, com cinco abas, textos escaláveis, controles grandes e rótulos de acessibilidade. A API disponibiliza os avisos de escassez gerados automaticamente pelo estoque para consulta no app aberto. O usuário pode se cadastrar e entrar com e-mail/senha, agendar pela página inicial e acompanhar a solicitação recebida automaticamente pelo desktop. A pré-triagem do aplicativo é um questionário curto e orientativo para o usuário ter uma ideia inicial antes de sair de casa. Ela não substitui a triagem completa do hemocentro nem confirma aptidão. O agendamento separado é de uma visita para doação; as respostas digitais não são enviadas ao hemocentro. Conta e reservas ficam no PostgreSQL; preferências ficam na memória da sessão; ao autorizar push, cidade, tipo opcional e filtros são mantidos no servidor para entrega. Consulte [prototipo-mobile.md](prototipo-mobile.md) para os fluxos, execução e limites; push nativo foi preparado, com credenciais e validação física pendentes; e-mail/WhatsApp continuam fora do protótipo.

## Agenda e proteção de dados

A integração com PostgreSQL acrescenta unidades, contas fictícias, sessões, horários, reservas e avisos persistidos. A API aplica autorização, transações, minimização e operações sobre os próprios dados. Não são enviados CPF, tipo sanguíneo do doador ou respostas de saúde para a agenda. O fluxo e as limitações estão em [agendamentos-compartilhados.md](agendamentos-compartilhados.md), e as decisões relacionadas à LGPD estão em [privacidade.md](privacidade.md). A base ainda exige validação jurídica e operacional antes de dados reais.

A autenticação é única em cada aplicativo. O cadastro público é somente de doador. O hemocentro Centro possui uma conta pública de apresentação preparada pelo seed, sem cadastro na interface. O mobile não carrega nem grava o armazenamento antigo de perfil e visitas.
