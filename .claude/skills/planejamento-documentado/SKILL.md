---
name: planejamento-documentado
description: Todo planejamento vira documentação versionada em docs/planejamentos/, sempre com a referência à solicitação que o originou (citação literal, data e quem pediu). Use SEMPRE que for planejar antes de implementar — plano de feature, refatoração, migração, nova lib/app, mudança de arquitetura, "vamos adicionar…", "planeje…", "como faríamos…", modo de plano, ou quando o usuário aprovar um plano ("o plano está correto, pode implementar"). Também ao retomar, ajustar ou concluir um plano existente. Vale mesmo que o usuário não peça documentação.
---

# Planejamento documentado

Um plano que existe só na conversa se perde. Aqui, **todo planejamento vira um documento em `docs/planejamentos/`** e **aponta para a solicitação que o gerou**, para que qualquer pessoa entenda *por que* aquele plano existe e *o que foi pedido*, sem ler o histórico do chat.

Complementa os ADRs (`docs/adr/`): o **ADR** registra uma *decisão arquitetural duradoura*; o **planejamento** registra *o trabalho a fazer (e feito) para atender a um pedido*. Um planejamento pode gerar ou referenciar ADRs, mas não os substitui.

## Quando criar

Crie (ou atualize) o documento **antes de começar a implementar** sempre que houver planejamento: plano de feature, nova lib/app, refatoração, migração, mudança de arquitetura, ou qualquer pedido cuja execução você precise dividir em etapas. Não é preciso para correções triviais de uma linha ou perguntas.

- Plano novo → novo arquivo.
- Pedido que **continua ou ajusta** um plano existente (ex.: "adicione também X", "integre os dois") → **atualize o mesmo documento**: acrescente a solicitação em *Solicitações relacionadas* e as etapas novas. Só abra outro se o objetivo for distinto.

## Onde e como nomear

`docs/planejamentos/NNNN-slug-curto.md`, com `NNNN` sequencial de 4 dígitos (olhe o maior já existente) e slug em minúsculas sem acento. Mantenha também o índice `docs/planejamentos/README.md` (uma linha por documento: número, título, status, data).

## A referência à solicitação (obrigatória)

A seção **Solicitação de origem** é o coração do documento. Nela:

1. **Citação literal** do pedido do usuário, em bloco de citação, sem reescrever nem "corrigir" (preserve erros de digitação). Se o pedido veio em várias mensagens, cite cada uma na ordem.
2. **Data** (AAAA-MM-DD) e **autor** (o nome do usuário, `git config user.name`, ou "usuário").
3. **Contexto de captura**: de onde veio (conversa com o assistente, issue, e-mail etc.), com link/número quando houver. Para conversa, escreva "Conversa com o assistente" e, se existir, o identificador da sessão.
4. **Respostas a perguntas de esclarecimento** feitas ao usuário (pergunta → resposta), pois elas definem o escopo.

Não parafraseie no lugar da citação. A interpretação vai em *Objetivo*, separada, para que se veja o que foi pedido versus o que se entendeu.

## Modelo

```markdown
# Planejamento NNNN: <título curto>

- **Status:** Rascunho | Aprovado | Em andamento | Concluído | Abandonado
- **Data:** AAAA-MM-DD
- **Solicitado por:** <nome>
- **Relacionado:** ADR 00XX, planejamento 00YY (se houver)
- **Commits:** <hashes ou "ainda não commitado">

## Solicitação de origem

> <citação literal do pedido>

- **Quando:** AAAA-MM-DD · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - <pergunta> → <resposta do usuário>

### Solicitações relacionadas

> <pedido posterior que ajustou ou ampliou este plano> (AAAA-MM-DD)

## Objetivo
O que se entendeu que precisa ser entregue, em 2–4 linhas. Deixe claro o que está **fora do escopo**.

## Decisões e restrições
Regras do projeto que condicionam o plano (ADRs, skills, rules) e decisões tomadas, cada uma com o motivo.

## Etapas
- [ ] 1. …
- [ ] 2. …
(Marque ao concluir. Etapa que mudou durante a execução: ajuste o texto, não apague o histórico — registre em *Registro de mudanças*.)

## Critérios de pronto
Como saber que acabou (testes, build, comportamento observável).

## Riscos e pendências
O que pode dar errado ou ficou em aberto, com responsável se souber.

## Registro de mudanças
- AAAA-MM-DD — o que mudou no plano e por quê.
```

## Fluxo

1. **Ao receber o pedido que exige planejamento**, antes de codar: copie a citação literal, registre os esclarecimentos que fizer, redija o documento e adicione ao índice. Informe o caminho ao usuário.
2. **Se faltar decisão do usuário**, pergunte antes de fechar o plano e anote as respostas em *Esclarecimentos*.
3. **Ao ser aprovado** ("pode implementar"), mude o status para *Aprovado*/*Em andamento* e cite a aprovação em *Registro de mudanças*.
4. **Durante a execução**, marque etapas e registre desvios.
5. **Ao concluir**, status *Concluído*, preencha *Commits* quando houver e atualize o índice. Se o trabalho incluiu uma decisão arquitetural durável, abra o ADR e linke em *Relacionado*.
6. **Plano no modo de plano** (apresentado para aprovação): o texto apresentado e o documento devem dizer o mesmo; salve o documento ao sair do modo de plano.

## Cuidados

- Não coloque segredos, tokens ou dados pessoais de terceiros no documento; a citação deve ser do pedido, não de dados sensíveis colados nele (omita com `[omitido]`).
- Escreva em pt-BR, como o restante da documentação do projeto.
- O documento é para quem chega depois: direto, sem narrar a conversa.
- Nunca invente a solicitação: se não houver pedido identificável, pergunte ao usuário ou escreva "Solicitação não registrada" e peça a citação.
