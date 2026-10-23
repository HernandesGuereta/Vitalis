# Pré-triagem digital orientativa

A pré-triagem do Vitalis ajuda o usuário a identificar cuidados e dúvidas antes de sair de casa. Não é um agendamento de pré-triagem, uma triagem clínica completa, um diagnóstico ou uma autorização para doar. A equipe do hemocentro continua responsável pela entrevista, verificações e decisão final.

## Experiência no aplicativo

Na página inicial, **Fazer pré-triagem** abre uma introdução e oito perguntas, apresentadas uma por vez. Há uma pergunta adicional para usuários de 16–17 anos ou 60–69 anos. Cada pergunta oferece a opção de não saber ou preferir não responder. É possível voltar, alterar respostas, refazer ou sair apagando as respostas. O progresso é anunciado para leitores de tela; os controles usam os mesmos tamanhos e estilos acessíveis do restante do aplicativo.

Os temas são faixa de idade, faixa de peso, sintomas recentes, preparação, álcool, cuidados/tratamentos, gestação/pós-parto/amamentação e última doação. Não são solicitados datas de nascimento, peso exato, nomes de medicamentos, diagnósticos ou detalhes íntimos. A combinação de descanso/alimentação pede Sim somente quando ambas as condições são verdadeiras.

## Orientações possíveis

| Situação | Orientação |
| --- | --- |
| Falta resposta ou valor inválido | Não conclui a avaliação |
| Idade abaixo do mínimo, peso abaixo do mínimo, sintomas, preparação insuficiente ou álcool recente | Melhor adiar por enquanto, com explicação dos pontos identificados |
| Respostas incertas, tratamentos/cuidados, gestação/pós-parto, doação recente ou requisitos de idade que precisam ser conferidos | Conversar com o hemocentro antes de se deslocar |
| Nenhum desses pontos nas poucas perguntas | Nenhum alerta inicial nas respostas; isso não confirma aptidão |

Os motivos para adiar têm prioridade, mas as dúvidas adicionais também aparecem. Há menos de 90 dias da última doação gera orientação individual, sem concluir automaticamente que a pessoa não pode doar. A aplicação não coleta sexo para calcular intervalos. O histórico anual, outras condições e os demais critérios não são avaliados por este questionário.

Jovens de 16–17 anos recebem orientação para conferir autorização/documentos mesmo quando informam ter autorização. Pessoas a partir de 70 anos são encaminhadas à avaliação específica, considerando a possibilidade de doação de repetição; não recebem uma exclusão automática por idade. Informações sobre pós-parto e procedimentos também exigem orientação individual, sem cálculo de prazos pelo aplicativo. Não é sugerida suspensão de tratamento.

O agendamento continua como **Agendar doação**, separado do questionário. Uma reserva não é liberação clínica. O desktop recebe a reserva, sem respostas ou resultado da pré-triagem.

## Privacidade

As respostas e o resultado existem apenas no estado do componente `ScreeningScreen`. Não são enviados à API, associados à conta, registrados em logs ou persistidos em AsyncStorage, localStorage, sessionStorage ou PostgreSQL. Sair da tela, navegar para outra área, refazer, recarregar ou encerrar a sessão descarta esse estado. Não há indicador de aptidão salvo no perfil ou exigido pelo servidor ao reservar.

## Fontes e validação

Referências consultadas em **22/10/2026**:

- [Ministério da Saúde — doação de sangue](https://www.gov.br/saude/pt-br/composicao/saes/doacao-de-sangue/doacao-de-sangue/): critérios básicos, preparação e avaliação de doadores regulares a partir dos 70 anos.
- [Hemoba — doação de sangue](https://www.ba.gov.br/hemoba/doacao-de-sangue): orientações de preparação e situações que exigem espera/avaliação.
- [Secretaria da Saúde de Goiás — atualização dos critérios em outubro de 2026](https://goias.gov.br/entram-em-vigor-novas-regras-para-doacao-de-sangue/): evidencia mudanças recentes nos critérios. O protótipo encaminha procedimentos à avaliação individual, sem fixar prazos antigos para tatuagens, piercings ou endoscopia.

A transformação dessas referências em um questionário reduzido é uma decisão de produto para o protótipo; não é um instrumento clínico validado. Antes de uso com pessoas reais, conteúdo, critérios, comunicação do resultado e atualização periódica precisam ser revisados por profissionais de hemoterapia.

Os testes de regras cobrem ausência/invalidade de respostas, todas as respostas incertas, prioridade dos cuidados, medicação, situações de gestação, doação recente e faixas etárias condicionais. O teste gráfico verifica navegação, alteração de idade, orientação sem alertas, orientação para adiar, descarte, largura de 320 pontos, ausência de escrita na API durante o questionário e continuidade do agendamento até o desktop.
