# Validação do agendamento de ponta a ponta

Escopo: protótipo Vitalis com mobile, API Express, PostgreSQL e administrador Electron. O agendamento é de uma visita para doação. A pré-triagem digital é independente e não é uma autorização clínica.

## Executar novamente

Com `TEST_DATABASE_URL` apontando para um banco separado, cujo nome contém `test`, e `DATABASE_URL` configurada para `vitalis_app`:

```bash
npm run test:appointments
```

O comando executa a integração real de banco e depois a jornada visual. Requer PostgreSQL ativo, dependências instaladas e ambiente gráfico. Em ambiente sem consulta aos serviços Expo, use `EXPO_OFFLINE=1 npm run test:appointments`.

A credencial de manutenção cria esquemas temporários e prepara/verifica os dados. A API é exercitada com o papel restrito `vitalis_app`, também na jornada gráfica. Os esquemas e perfis Electron são isolados; nenhuma reserva do banco de demonstração é criada ou cancelada. A API de teste usa porta livre e os testes restauram o build desktop para o endereço normal ao terminar.

## Cenários cobertos

| Cenário | Resultado esperado |
| --- | --- |
| Cadastro e login do doador; login administrativo | Sessões reais, com papéis e unidade definidos pelo servidor |
| Falha ao carregar horários | Erro de conexão e opção de atualizar; não é confundida com ausência de horários |
| Trocar unidade após escolher dia/horário | Seleção anterior descartada; somente opções da unidade atual |
| Duplo clique em confirmar | Uma requisição em andamento; uma reserva e um evento de criação |
| Mesma tentativa enviada simultaneamente | Mesmo identificador de reserva, sem consumir vagas extras |
| Resposta perdida após gravar | Nova tentativa usa a mesma chave e recupera a reserva existente |
| Gravação confirmada e consulta seguinte falha | Confirmação preservada; aviso para atualizar a lista |
| Retorno de sucesso ou erro depois de confirmar | Mensagem trazida para a área visível da tela; teste confere os limites visíveis do componente |
| Recebimento pelo hemocentro | Solicitação aparece automaticamente na unidade correta |
| Duas unidades para o mesmo doador/dia | Só uma reserva ativa é aceita, inclusive sob concorrência |
| Última vaga disputada por três doadores | Um sucesso; demais recebem conflito; capacidade nunca excedida |
| Outro doador ocupa a vaga após a tela carregar | Servidor recusa, cliente atualiza e bloqueia o horário esgotado |
| Cancelamento no desktop | Mobile consulta a situação cancelada e a vaga é liberada |
| Cancelamento no mobile | Desktop recebe a mudança automaticamente |
| Resposta perdida ao cancelar | Repetir confirma sucesso; um único evento de cancelamento |
| Cancelamento confirmado e lista indisponível no desktop | Confirmação permanece visível e a ação não volta a ser oferecida |
| Vaga liberada após cancelamento | Pode ser reservada novamente com nova tentativa |
| Reserva passada ou fora da janela | Criação recusada; histórico não oferece cancelamento |
| Reiniciar a API | Reservas, sessões válidas e repetição segura preservadas no PostgreSQL |
| Sessão expirada | Nenhuma escrita permitida; mobile retorna ao login e pode entrar novamente |
| Isolamento por doador/unidade | Cada conta consulta e cancela somente o que lhe pertence |
| Pré-triagem e privacidade | Respostas de saúde não são enviadas; correção, exportação e exclusão continuam funcionando |

## Arquivos principais

- `apps/api/tests/database.test.ts`: autorização, minimização, privacidade, persistência e eventos.
- `apps/api/tests/appointments.test.ts`: concorrência, capacidade, repetição, histórico e sessão.
- `apps/mobile/tests/appointments.cjs`: cenários gráficos de agendamento com falhas de transporte controladas.
- `apps/mobile/tests/ui-smoke.cjs`: cadastro, pré-triagem, agendamento, perfil, avisos e exclusão em um ambiente isolado.

As falhas de transporte são provocadas apenas nas janelas de teste. A API e o PostgreSQL continuam reais, de modo que o teste consegue distinguir perda da resposta de ausência de gravação. O reinício encerra o servidor HTTP de teste e inicia outra instância, mantendo o mesmo banco e endereço.

## Limites

A interface mobile é verificada na prévia web em Electron; os bundles Android/iOS são validados por `npm run validate`. Ainda é necessário executar em aparelhos reais, com redes e recursos de acessibilidade nativos. Os testes não constituem garantia de ausência de falhas em qualquer ambiente, validação clínica, integração com hemocentros reais ou liberação para uso com dados reais.
