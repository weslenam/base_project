# Planejamento 0031: Cartões de indicador e responsividade do painel do Business Center

- **Status:** Concluído
- **Data:** 2026-11-08
- **Solicitado por:** Weslen
- **Relacionado:** planejamento 0028 (Business Center); skill `design-system`
- **Commits:** ainda não commitado

## Solicitação de origem

> ficou muito melhor na minha opiniao, temos que melhorar os cards e a responsividade porque esta quebrando

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente (captura de tela do painel da Barbearia do Zé)
- **O que a captura mostrava:**
  - o valor "R$ 4.442,90" vazava do cartão;
  - os títulos quebravam em duas linhas;
  - os cartões tinham alturas diferentes;
  - o "Caixa atual" ficava sozinho numa segunda linha, com o valor também vazando.

## Objetivo

Criar o componente `DsIndicador` no design system e usá-lo nos indicadores do painel, com uma grade que se adapta da tela larga ao celular.

**Fora do escopo:**

- o gráfico diário (o `DsGrafico` continua pendente);
- as tabelas do painel;
- os cartões do app das barbearias (o `DsIndicador` já fica disponível para eles).

## Decisões

- **`DsIndicador`:**
  - props `rotulo`, `valor`, `detalhe`, `variacao` (`null` = sem base; sem a prop, a linha some) e `comparacao`;
  - rótulo pequeno em maiúsculas;
  - valor no tamanho de título (36px, não o display de 64px), com números tabulares e quebra segura;
  - tendência pintada com os tokens de sucesso e perigo;
  - altura cheia, para todos os cartões da linha ficarem iguais.
- **Grade:**
  - `minmax(min(100%, 13rem), 1fr)` nos indicadores e `minmax(min(100%, 20rem), 1fr)` nas metades;
  - filhos da grade com `min-inline-size: 0`, para nada estourar a largura no celular.

## Etapas

- [x] 1. `DsIndicador` com testes de contrato e exportação.
- [x] 2. Painel do Business Center usando o `DsIndicador` e a grade nova.
- [x] 3. Testes, lint, revisão de segurança e commit.

## Riscos e pendências

- Sem navegador headless no ambiente, a conferência visual em telas largas e no celular ficou com o Weslen.

## Registro de mudanças

- 2026-11-08: criado e concluído.
