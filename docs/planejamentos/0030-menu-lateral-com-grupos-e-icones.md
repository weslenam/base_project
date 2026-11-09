# Planejamento 0030: Menu lateral com grupos, ícones e recuo

- **Status:** Concluído
- **Data:** 2026-11-08
- **Solicitado por:** Weslen
- **Relacionado:** ADR 0003 (identidade visual e tokens), ADR 0007 (Vuetify atrás dos `Ds*`), skill `design-system`
- **Commits:** ainda não commitado

## Solicitação de origem

> temos oportnidade de melhoria
> precisamos melhorar esse menu lateral porque eu estou sentindo falta de uma divisão para titulos talvez tambem adicionar icones e fazer algum tipo de identação quando for filho daquele titulo

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente (captura de tela da tela Pacotes)
- **Esclarecimentos:**
  - Os grupos ficam sempre abertos ou recolhem? → **Sempre abertos.**
  - Os itens do topo (Balcão, Agenda, Caixa, Clientes) ganham título? → **Sim, grupo "Operação".**

## Objetivo

Deixar o menu lateral mais fácil de ler:

- cada grupo com título, ícone e uma linha divisória antes dele;
- os itens do grupo com recuo e com o próprio ícone (o `DsLayout` já recebia o ícone, mas não o desenhava).

Vale para o app das barbearias e para o Business Center, que usam o mesmo `DsLayout`.

**Fora do escopo:**

- grupos que recolhem;
- menu em modo trilho (só ícones);
- reordenar ou renomear as telas;
- mudar permissões.

## Mini-spec

- **Contrato do `DsLayout`:**
  - os itens continuam `[{ titulo, rota, icone?, grupo? }]`;
  - nova prop opcional `grupos: [{ titulo, icone? }]`, que dá o ícone de cada grupo pelo título;
  - grupo sem entrada na prop aparece só com o título;
  - itens sem `grupo` continuam aceitos (sem título e sem recuo), para não quebrar quem usa.
- **Visual (só tokens):**
  - linha divisória antes de cada grupo, menos o primeiro;
  - título do grupo com ícone, no estilo de rótulo que já existe;
  - itens filhos com ícone e recuo de `--esp-4`;
  - item ativo continua em cobre.
- **App das barbearias:**
  - Balcão, Agenda, Caixa e Clientes vão para o grupo "Operação";
  - ícones dos grupos: Operação `fila`, Cadastros `componentes`, Estoque `estoque`, Administração `configuracoes`;
  - ícones que se repetiam ou não diziam nada passam a ser próprios: Fidelidade `fidelidade`, Estoque `estoque`, Compras `compras`, Fornecedores `fornecedor` e Papéis e permissões `permissoes`;
  - os ícones novos entram no catálogo do `DsIcone` (MDI).
- **Acessibilidade:**
  - ícones decorativos (o texto continua sendo o rótulo);
  - o título do grupo é cabeçalho de lista.

## Critérios de aceite

- Testes de contrato do `DsLayout`:
  - título único por grupo;
  - divisória entre grupos;
  - ícone do item e do grupo desenhados;
  - itens do grupo com a classe de recuo.
- Telas sem mudança de comportamento: o menu continua filtrado por papel e módulo.
- `pnpm verificar` verde.

## Etapas

- [x] 1. Ícones novos no catálogo (`fidelidade`, `estoque`, `compras`, `fornecedor`).
- [x] 2. `DsLayout`: prop `grupos`, divisória, ícones e recuo, mais os testes de contrato.
- [x] 3. App das barbearias: grupo "Operação", ícones dos grupos e dos itens.
- [x] 4. Business Center: conferir o menu (um item só, sem grupo).
- [x] 5. Verificar, revisar a segurança e fazer o commit.

## Registro de mudanças

- 2026-11-08: criado depois da entrevista (2 perguntas).
- 2026-11-08: mini-spec aprovado ("pode fazer sim").
- 2026-11-08: implementado.
  - **`DsLayout`:**
    - monta seções de itens seguidos do mesmo grupo;
    - `VDivider` entre as seções;
    - título com `DsIcone`;
    - filhos com `data-ds-grupo` e recuo (título em `--esp-2`, filhos em `--esp-6`).
  - **Ícones novos:** `fidelidade`, `estoque`, `compras` e `fornecedor`.
    - Também `permissoes` (escudo), porque "Papéis e permissões" usava o ícone de bloqueio.
  - **Business Center:** sem mudança. O item único sem grupo continua sem título.
  - **Verificação:** dois testes de contrato novos e `pnpm verificar` verde.
