# Contexto do Vitalis

Referência: artigo acadêmico **Artigo Final - Vitalis 5T (1).pdf**, fornecido pelo usuário, especialmente as seções 1, 3 e 4. O arquivo original permanece fora do repositório.

O Vitalis pretende aproximar doadores de sangue e hemocentros, melhorar a comunicação sobre necessidades de tipos sanguíneos e apoiar a continuidade das doações.

O artigo apresenta como possibilidades de evolução:

- Cadastro de doadores e histórico de doações, com vínculo entre doador e doação.
- Gestão de estoque e movimentação de bolsas de sangue pelos hemocentros.
- Pré-triagem digital e orientações ao doador.
- Agendamentos e notificações direcionadas, incluindo e-mail e WhatsApp.
- Proteção dos dados pessoais e sensíveis no desenho da solução.

Esses pontos registram o contexto do produto. Nenhuma dessas funcionalidades foi implementada ou teve suas regras definidas nesta etapa. Critérios clínicos, requisitos legais e integrações precisarão ser especificados e validados antes da implementação.

## Decisão técnica desta etapa

O artigo descreve React, Java/Spring Boot e MySQL. A solicitação atual define a base deste repositório: React Native com Expo para mobile, React com Electron para desktop, Node.js com Express para API e PostgreSQL, com TypeScript nas aplicações.

O mobile é destinado ao futuro relacionamento com doadores; o desktop, à futura operação dos hemocentros. Ambos deverão consumir a API; a API será a responsável pelo acesso ao PostgreSQL. Nesta estrutura inicial, os processos são independentes e ainda não se comunicam.

As tecnologias e integrações citadas no artigo servem como referência de contexto, sem substituir a stack solicitada ou ampliar o escopo desta etapa.
