# Privacidade e proteção de dados no protótipo

Esta etapa aplica controles técnicos à agenda compartilhada. O sistema continua destinado a **dados fictícios**. Esses controles não representam certificação ou declaração de conformidade integral com a LGPD. A operação com pessoas reais depende também de decisões jurídicas, administrativas e operacionais.

A referência legal é a [LGPD consolidada](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), especialmente os princípios do art. 6º, a transparência do art. 9º, o tratamento de dados sensíveis do art. 11, os direitos do art. 18 e a segurança desde a concepção do art. 46. As orientações de controle de acesso, senhas, atualização e proteção de informações foram consultadas no [guia de segurança da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte).

## Decisões desta implementação

| Tema | Controle aplicado |
| --- | --- |
| Finalidade e minimização | Conta fictícia e reserva de horário. Não foram criadas colunas de CPF, nascimento, tipo sanguíneo do doador ou respostas de saúde. |
| Autenticação | Um login por aplicativo. Cadastro público somente de doador, com nome, e-mail e senha; administradores preparados pelo seed. Resposta genérica para credenciais incorretas, limite de tentativas e sessões de até 30 minutos. |
| Separação de papéis no cadastro | O corpo da requisição aceita somente nome, e-mail e senha. O banco define o papel `donor`; a credencial da API não pode inserir `role` ou `unit_id`. |
| Senhas | scrypt com salt aleatório por conta, N=32768, r=8, p=3, saída de 64 bytes; comparação com tempo constante. O desenho segue uma configuração publicada pela [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). |
| Sessões | Tokens aleatórios de 256 bits. O banco guarda apenas o resumo SHA-256. Logout revoga a sessão; exclusão da conta revoga todas. |
| Armazenamento no cliente | Credenciais, tokens e agenda autenticada não entram em AsyncStorage, localStorage ou sessionStorage. Permanecem em memória. |
| Autorização | Identidade e unidade vêm da sessão. O doador consulta somente suas reservas; o administrador consulta e cancela somente reservas da própria unidade. Não é aceito um doador arbitrário no corpo da criação. |
| Banco | API com usuário sem superusuário, criação de banco ou criação de papel. Migrações e seed usam outra credencial. Consultas parametrizadas e restrições no banco. |
| Integridade da agenda | Transação, bloqueio de doador/horário, controle de capacidade, chave de repetição e unicidade por doador/dia. |
| Comunicação | Avisos publicados exigem administrador autenticado. A unidade é determinada pelo servidor. Apenas conteúdo público é retornado no feed; destinatários não são armazenados nele. |
| Exposição | Respostas sem cache; erros genéricos sem SQL, stack ou credenciais; origens web limitadas e sem cookies de sessão. CORS complementa, mas não substitui, autorização. |
| Auditoria | Identificador do ator, ação e instante para cadastro, login, criação e cancelamento. Não grava senha, token bruto, IP, respostas clínicas ou corpo das requisições. IDs vinculáveis continuam sendo dados pessoais, não anonimização. |
| Direitos no protótipo | Acesso aos próprios dados, correção de nome, exportação e exclusão da conta de teste. Não há promessa de portabilidade regulatória completa. |
| Transparência | Explicações no cadastro, agendamento, Conta → Privacidade e endpoint `/privacy`, com finalidade, categorias, retenção e limitações. |

A reserva em uma plataforma de doação pode revelar informações sensíveis pelo contexto. Omitir campos clínicos reduz a coleta, mas não elimina a necessidade de avaliar esse risco.

O aplicativo oferece uma **pré-triagem digital orientativa**, com poucas perguntas de saúde e preparação, além de um agendamento separado de visita para doação. Não decide aptidão. As respostas e o resultado ficam somente no componente do questionário e são descartados ao sair, refazer, recarregar ou encerrar a sessão. Não são enviados à API, registrados em auditoria, exportados na conta ou gravados no PostgreSQL/armazenamento do aparelho. O questionário não é uma autorização para reservar um horário. Cidade, preferências e tipo sanguíneo ilustrativo, quando escolhidos, ficam somente na memória da sessão do mobile e não são enviados ao cadastrar ou agendar.

O acesso `hemocentro@vitalis.demo` / `VitalisDemo2026!` é uma credencial deliberadamente pública para demonstração, solicitada pela equipe. Qualquer pessoa que a conheça pode consultar a unidade fictícia. Esse acesso precisa ser substituído por contas individuais gerenciadas antes de qualquer piloto com pessoas reais.

## Transporte e segredos

O PostgreSQL do Compose está vinculado a loopback. O cliente não recebe suas credenciais. `DATABASE_ADMIN_URL` é exclusiva de manutenção, e `DATABASE_URL` usa `vitalis_app`. Variáveis do `.env` são ignoradas pelo Git; nesta máquina o arquivo tem permissão 0600. Variáveis `VITE_*` são públicas no bundle e nunca devem conter segredos.

A API oferece HTTPS direto com certificado e chave configurados. O certificado precisa ser confiável pelos clientes. O desktop permite a origem exata de `VITE_API_URL`; o mobile valida o endereço e usa a verificação de certificados da plataforma.

HTTP de desenvolvimento é aceito em loopback. A exposição HTTP à rede requer uma opção explícita e permanece restrita à demonstração fictícia. Isso não fornece confidencialidade em trânsito. Não foi configurada criptografia de disco/volume ou de backups nesta etapa, e não há garantia de proteção em um aparelho/computador comprometido.

## Retenção e exclusão

A conta de teste permanece até a exclusão. Reservas com data de atendimento passada há mais de 30 dias e eventos/avisos com mais de 30 dias são removidos por `npm run db:cleanup`. Sessões perdem validade aos 30 minutos; seus registros expirados são removidos em logins seguintes ou pela limpeza. Essa política é uma convenção do protótipo, não um prazo legal para prontuários ou dados de hemoterapia.

A limpeza é manual; uma implantação contínua precisa agendá-la e monitorá-la. A exclusão da conta de doador remove imediatamente suas reservas e sessões do banco ativo. Os eventos anteriores ficam sem vínculo com a conta até a limpeza. Não existe cópia de agenda autenticada persistida pelos clientes.

Os exemplos administrativos antigos continuam locais e identificados como demonstração. Eles não foram migrados para a base compartilhada. Podem conter campos fictícios de saúde; não devem receber dados reais. O mobile deixou de carregar/gravar o armazenamento antigo de perfil e visitas; instalações anteriores podem ainda ter essa chave antiga no dispositivo. Nenhum mecanismo de eliminação de backups foi implementado, porque ainda não há rotina de backup configurada. O seed pode recriar contas fictícias apagadas quando for reexecutado.

## Antes de testar com dados reais

É necessário definir o controlador e seus contatos, os operadores envolvidos, a hipótese legal adequada para cada finalidade, o tratamento de dados sensíveis e as regras de elegibilidade/idade. Não foi presumido consentimento genérico como autorização para todos os tratamentos.

Também permanecem: aviso de privacidade operacional revisado, política de retenção validada para a atividade, revisão de riscos e necessidade de RIPD, processos de atendimento de direitos, correção dos demais dados, recuperação de acesso, gestão de equipe e revogação, resposta a incidentes, proteção de volumes e backups, HTTPS confiável, atualização de dependências e revisão de segurança. O volume Docker atual é persistente, mas não substitui backup testado.

A documentação serve como registro das escolhas técnicas. A confirmação das bases legais e obrigações da operação deve ser feita com os responsáveis pelo produto e pela privacidade antes de um piloto real.

## Evidências de teste

Os testes com PostgreSQL verificam isolamento por doador/unidade, recusa de publicação por doador, concorrência de vagas, duplicidade, cancelamento, persistência após reiniciar a aplicação, correção, exportação, exclusão e revogação. A API é exercitada também pelo usuário restrito do banco. Os testes de senha verificam salts diferentes, senha incorreta e hashes inválidos.

O teste gráfico verifica o questionário e seus resultados, ausência de requisições de escrita durante a pré-triagem, ausência de respostas no armazenamento local, descarte ao sair, cadastro, login único, botão de agendamento na página inicial, recebimento automático no desktop sem atualizar manualmente, cancelamento, novo login após recarregar e exclusão da conta. Também verifica correção/exportação sem credenciais ou nome autenticado no armazenamento local. Testes não demonstram conformidade integral nem substituem auditoria ou validação em aparelhos reais.

As fontes, critérios e limitações do questionário estão em [pre-triagem-digital.md](pre-triagem-digital.md). A extensão deste protótipo para uma triagem clínica real exigirá validação pela equipe de saúde e revisão específica de governança dos dados de saúde.
