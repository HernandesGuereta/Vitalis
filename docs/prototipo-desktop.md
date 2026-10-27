# Protótipo do administrador desktop

**Atualização:** o login inicial autentica na API e Agendamentos recebe automaticamente as solicitações do mobile pelo PostgreSQL. A agenda local anterior fica em uma seção recolhida. Consulte [agendamentos-compartilhados.md](agendamentos-compartilhados.md).

O administrador usa o design das 20 telas administrativas do PDF fornecido pela equipe e a logo original. A [referência extraída](design/vitalis-admin-referencia.pdf) e o [mapa das páginas](design/README.md) ficam em `docs/design/`. As telas da área do doador não fazem parte desta implementação.

## Executar

Na raiz do monorepositório, após instalar as dependências:

```bash
npm run dev:desktop
```

Clique em **Entrar no hemocentro**. O e-mail `hemocentro@vitalis.demo` e a senha pública de teste `VitalisDemo2026!` já vêm preenchidos. A API valida o login e a unidade da conta. Não há cadastro público de hemocentros nem segundo login para a agenda.

Inicie PostgreSQL e API antes de entrar, conforme [o guia da agenda](agendamentos-compartilhados.md). Estoque, doadores e campanhas anteriores continuam demonstrativos após o login. Para executar o build local:

```bash
npm run build --workspace @vitalis/desktop
npm run start:desktop
```

## Telas e fluxos

| Área | Ações demonstrativas |
| --- | --- |
| Visão geral | Solicitações de agendamento de doação recebidas do aplicativo, com acesso à agenda. Indicadores derivados dos registros locais, destaque do estoque crítico, próximo atendimento e movimentações recentes. |
| Estoque de sangue | Tabela dos oito tipos sanguíneos, níveis ilustrativos e filtros; cada ação Movimentar abre o formulário com o tipo selecionado. |
| Movimentações | Histórico pesquisável, entradas/saídas e confirmação do registro. A quantidade deve ser inteira e positiva; saídas acima do saldo são rejeitadas. Origem/destino, observação e validade informada podem acompanhar o registro. |
| Doadores | Busca, filtro sanguíneo, perfil, histórico, cadastro e edição de nomes, identificação fictícia, contato, cidade e canais autorizados. |
| Doações | Lista e registro vinculado obrigatoriamente a um doador. O atendimento agendado na mesma data é marcado como concluído. O registro não acrescenta bolsas automaticamente: entrada de estoque é uma etapa separada. |
| Agendamentos | Reservas do PostgreSQL, nome do usuário, dia/horário, unidade e cancelamento com confirmação. Atualização por evento autenticado e consulta a cada 5 segundos. Agenda local antiga recolhida separadamente. |
| Alertas | Avisos automáticos de escassez, gerados pela API a partir do estoque agregado sincronizado. Não há criação, revisão ou publicação manual. |
| Configurações | Edição local dos dados da unidade, saída da sessão e restauração dos dados de exemplo com confirmação. |

Os formulários da demonstração anterior usam dados locais; a nova agenda autenticada usa PostgreSQL. A ação Publicar no aplicativo compartilha somente avisos públicos pela API de demonstração, conforme o fluxo descrito abaixo. Não há conexão com unidades reais, envio de e-mail/WhatsApp ou avaliação clínica.

## Dados e persistência

- Os dados iniciais incluem 221 bolsas, oito movimentações, dez doadores, cinco registros de doação, três agendamentos e três campanhas. Datas recentes são geradas em relação à criação da demonstração.
- Os indicadores usam esses registros reais do protótipo; por isso as contagens podem diferir dos exemplos estáticos do PDF.
- A chave `vitalis.desktop.demo.v1` guarda o histórico de estoque. Ela foi preservada para manter as movimentações da primeira versão.
- A chave `vitalis.desktop.office.v1` guarda doadores, doações, agenda, campanhas e configurações. A sessão autenticada fica somente em memória, sem senha ou token no armazenamento local; recarregar/reabrir exige novo login.
- Os dados persistem no mesmo perfil/origem do Electron. Desenvolvimento e build podem ter armazenamentos separados. Esses exemplos locais não são sincronizados entre computadores; a agenda do PostgreSQL é consultada pela API.
- Dados locais inválidos geram aviso e uma nova demonstração da parte afetada. Falhas de gravação são informadas e deixam as alterações apenas em memória.
- Em **Configurações → Restaurar demonstração**, a confirmação substitui as duas chaves pelos exemplos iniciais; cancelar mantém os registros.

## Simulação de comunicação e atendimento

O aplicativo filtra os avisos automáticos por cidade e tipo exato. Push usa as preferências autorizadas do aparelho, sem compatibilidade clínica. Veja [o fluxo automático](avisos-automaticos.md).

O envio exige ao menos um destinatário e apenas altera o estado local da campanha. A pré-triagem mostra respostas fixas explicitamente fictícias para os perfis de exemplo com questionário respondido. As respostas não determinam aptidão.

## Limites do estoque

As faixas **Crítico** (até 25% da referência), **Baixo** (até 50%) e **Estável** (acima de 50%) são convenções de demonstração. Não representam protocolos de hemocentros ou recomendações clínicas.

O estoque usa quantidades agregadas. A validade, quando informada, é apenas metadado da movimentação; não existe rastreio individual de bolsas, lotes, hemocomponentes, disponibilidade por validade ou regras de descarte. O sistema operacional deverá tratar esses requisitos na API e no PostgreSQL.

## Verificar

```bash
npm run typecheck --workspace @vitalis/desktop
npm run test:desktop
npm run build --workspace @vitalis/desktop
npm run test:ui --workspace @vitalis/desktop
```

Há 11 testes dos modelos, usando `node:test`. O teste de interface abre o Electron com perfil temporário e verifica acesso, logo, estoque, filtros, entrada/saída, saldo insuficiente, cadastro/edição/perfil/triagem, doação vinculada, atendimento, avisos automáticos, configurações, persistência, restauração e saída. Ele precisa de ambiente gráfico e `TEST_DATABASE_URL`; usa API em porta livre, esquema e perfil temporários, sem alterar a demonstração do usuário.

Para salvar capturas durante esse teste no macOS/Linux:

```bash
VITALIS_TEST_SCREENSHOTS_DIR=/tmp/vitalis-capturas npm run test:ui --workspace @vitalis/desktop
```

## Compartilhar avisos com o mobile

A sincronização do saldo gera os avisos automaticamente. Falhas ficam visíveis e são tentadas novamente; a equipe não escreve mensagens. As limitações de fonte local, limiares e ativação de push estão em [avisos-automaticos.md](avisos-automaticos.md).

A pré-triagem digital do mobile é apenas orientativa e suas respostas não chegam ao desktop. A agenda recebe a reserva de visita para doação, sem respostas clínicas ou declaração de aptidão. A pré-triagem dos perfis administrativos antigos continua sendo uma simulação local, separada desse questionário.
