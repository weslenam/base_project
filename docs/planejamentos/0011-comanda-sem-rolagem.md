# Planejamento 0011: Comanda sem barra de rolagem

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamentos 0009 e 0010
- **Commits:** ainda não commitado (branch `feat/caixa-comanda`)

## Solicitação de origem

> busque otimizar a tela para nao ficar com barra de rolagem

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente (sobre a comanda do planejamento 0010)
- **Esclarecimentos:** nenhum. O alvo adotado é a tela de um notebook comum de balcão, **1366×768**: o diálogo inteiro precisa caber em cerca de 720px de altura.

## Diagnóstico (estimativa por medidas dos componentes, sem navegador)

| Parte               | Antes  | Causa                                                                                                                |
| ------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Coluna de pagamento | ~750px | coluna estreita (diálogo de 900px): formas de pagamento em 2 linhas, 3 ações de 64px empilhadas, resumo com 5 linhas |
| Cada campo          | +22px  | o Vuetify reserva a área de mensagens mesmo vazia                                                                    |
| Rodapé              | ~70px  | barra inteira só com o botão "Fechar"                                                                                |

## Decisões

- **`DsDialogo`:** nova largura `xl` (1200px) e prop `fechavel`, que põe um "X" ("Fechar") no título. Diálogos de consulta e PDV dispensam o rodapé.
- **Campos (`DsInput`, `DsSelect`, `DsTextarea` e os mascarados):** a área de mensagens só aparece quando há erro ou ajuda (`hide-details="auto"`). O ganho vale para todos os formulários. O `DsFormulario` aumenta o espaço entre campos para compensar.
- **`DsTabela`:** prop `compacta`, com linhas mais baixas para listas curtas.
- **`DsAcao`:** prop `compacta`, com 52px de altura.
- **Comanda:**
  - largura `xl` e `fechavel`, sem rodapé;
  - resumo em duas colunas (serviços e produtos lado a lado);
  - formas de pagamento numa linha só;
  - "Receber" em largura total, e "Salvar aberta" e "Cancelar" lado a lado, compactas;
  - tabela compacta, com rolagem interna só se a lista de itens passar de 40% da altura da tela.
- O detalhe do agendamento também passa a usar `fechavel`, por consistência.

## Etapas

- [x] 1. `DsDialogo` (`xl`, `fechavel`), campos sem área de mensagens vazia, `DsTabela` e `DsAcao` com `compacta`; contratos.
- [x] 2. Comanda e detalhe do agendamento com o novo arranjo.
- [x] 3. `pnpm verificar` passa. A conferência em 1366×768 está pendente com o usuário.

## Critérios de pronto

- **Altura estimada da comanda** (3 itens): cerca de 560px, abaixo dos 720px disponíveis.
- **Sem regressão:** contratos e testes de tela continuam passando.
- **Conferência visual:** fica com o usuário.

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Concluído. Contratos novos: `fechavel` fecha o diálogo e a ajuda continua visível com `hide-details="auto"`. O rótulo "Forma de pagamento" foi retirado (os botões já dizem Dinheiro, Pix…; o grupo mantém o nome acessível), e o cliente avulso passou para o rótulo do campo ("Cliente (vazio = avulso)").
- **Estimativa final da comanda com 3 itens:** título 64 + conteúdo ~470 (a coluna de pagamento é a mais alta: resumo ~120, desconto 56, formas 52, Receber 64, secundárias 52, espaços ~60) + margens 48 ≈ **580px**, contra cerca de 720px disponíveis.
