# Referências do administrador e hemocentro

Fonte: PDF **Vitalis • Experiência do Doador.pdf**, fornecido pela equipe em 22/10/2026, com 43 páginas de 1440 × 1000 pontos. A referência Figma é [Vitalis • Experiência do Doador](https://www.figma.com/design/WZSzlF5Gxj2g1Ir7EbAysk/Vitalis-%E2%80%A2-Experi%C3%AAncia-do-Doador).

O arquivo [vitalis-admin-referencia.pdf](vitalis-admin-referencia.pdf) contém somente as 20 telas administrativas, na ordem do documento original. As páginas foram copiadas integralmente; o PDF original permanece fora do repositório.

| Página extraída | Página original | Tela |
| --- | --- | --- |
| 1 | 7 | Acesso administrativo |
| 2 | 8 | Visão geral |
| 3 | 9 | Estoque de sangue |
| 4 | 13 | Histórico de movimentações |
| 5 | 14 | Registrar entrada |
| 6 | 15 | Registrar saída |
| 7 | 19 | Saída registrada |
| 8 | 20 | Entrada registrada |
| 9 | 21 | Lista de doadores |
| 10 | 25 | Perfil do doador |
| 11 | 26 | Cadastro do doador |
| 12 | 27 | Doações |
| 13 | 31 | Registrar doação |
| 14 | 32 | Agenda da unidade |
| 15 | 33 | Consulta de pré-triagem |
| 16 | 37 | Alertas |
| 17 | 38 | Preparar alerta |
| 18 | 39 | Revisar alerta |
| 19 | 42 | Confirmação de envio simulado |
| 20 | 43 | Configurações da unidade |

## Aplicação no desktop

- Navegação lateral com sete áreas e configurações, cabeçalho da unidade e perfil Renata Costa.
- Fundo `#f8f7f6`, botão principal `#be2442`, superfícies rosadas `#fcecef` e painel de acesso bordô `#43182b`, baseados no material exportado.
- Tabelas de estoque e registros, cartões de indicadores, formulários com resumo lateral e estados de confirmação.
- Logo original de 2172 × 724 pixels, com transparência, extraída da imagem embutida no PDF e salva em `apps/desktop/src/renderer/src/assets/vitalis-logo.png`, sem redesenho.
- O PDF identifica as fontes embutidas como `FigmaGlyphs`. A interface usa Arial/Helvetica locais para funcionar sem fontes remotas.

Os layouts são adaptáveis ao tamanho da janela. Valores de indicadores e tabelas são calculados a partir dos exemplos locais; não são cópias estáticas das contagens do PDF. A interface continua inteiramente fictícia, conforme [o guia do protótipo](../prototipo-desktop.md).

## Referência mobile

O PDF **Vitalis • Experiência do Doador-mobile.pdf** fornecido pela equipe contém 23 telas de 390 × 844 pontos: acesso e cadastro (1–6), início e alertas (7–9), unidades (10–11), pré-triagem (12–14), reserva (15–17), doações (18), conta e preferências (19–22) e guia (23). O aplicativo segue a referência visual com adaptações para legibilidade e para o fluxo solicitado: login único, cadastro de doador e agendamento da pré-triagem presencial pela página inicial. A mesma logo oficial foi copiada para `apps/mobile/assets/vitalis-logo.png`. Consulte [o guia mobile](../prototipo-mobile.md).
