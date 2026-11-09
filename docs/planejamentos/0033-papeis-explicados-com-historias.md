# Planejamento 0033: Papéis explicados com histórias ("o que eu vou poder fazer?")

- **Status:** Concluído
- **Data:** 2026-11-08
- **Solicitado por:** Weslen
- **Relacionado:** ADR 0010 (papéis fixos e hierarquia), planejamento 0023, skill `design-system`
- **Commits:** ainda não commitado

## Solicitação de origem

> aqui nesta tela, vamos ocultar as permissoes e papeis mas vamos explicar os papeis... algo como o que eu vou poder fazer? conceito de story teling

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente (captura do diálogo "Convidar usuário")
- **Esclarecimentos:**
  - O que fazer com a tela "Papéis e permissões"? → **Manter só com as histórias** (sem a lista técnica de permissões).
  - Como escolher o papel no convite? → **Cartões com a história** (no lugar do select).
  - Mostrar o que a pessoa não vai poder fazer? → **Pode e não pode.**
  - A história se adapta aos módulos ativos? → **Sim, só o que existe nesta barbearia.**

## Objetivo

Quem convida ou troca o papel de alguém entende, em linguagem do dia a dia, o que aquela pessoa vai fazer na barbearia e o que fica de fora. As chaves técnicas de permissão saem da interface.

**Fora do escopo:**

- papéis personalizados (continuam os 4 fixos, ADR 0010);
- mudar permissões ou hierarquia;
- o fluxo de convite por e-mail com aceite (S5 do planejamento 0025).

## Mini-spec

- **Domínio (`@barbertime/dominio`, fonte única, com testes):**
  - cada permissão do catálogo ganha uma frase de ação, no presente e do ponto de vista da pessoa (ex.: `caixa.operar` → "Abre o caixa e recebe as comandas");
  - cada papel ganha um resumo de uma linha (ex.: Recepção → "Recebe os clientes, cuida da agenda e cobra no balcão");
  - cada papel ganha também uma lista curta de limites (até 4), escolhida a dedo entre o que o papel de cima pode e ele não;
  - `historiaDoPapel(chave, modulosAtivos)` devolve `{ nome, resumo, pode: [...], naoPode: [...] }`:
    - `pode` vem das permissões efetivas do papel, então bate com o que a pessoa vai ver;
    - permissão de módulo inativo não aparece, nem em `pode` nem em `naoPode`.
- **Convite e troca de papel (`UsuarioDialogo`):**
  - o select "Papel" dá lugar a cartões de escolha (`DsEscolha` grande), com nome e resumo, só com os papéis abaixo de quem convida;
  - abaixo dos cartões, a história do papel escolhido, com o título "Como vai ser o dia da [primeiro nome] como [papel]" (sem nome: "o dia de quem for [papel]");
  - a história lista "Vai poder" (✔) e "Não vai poder" (✘).
- **Tela de papéis (`PapeisView`):**
  - um cartão por papel, com o resumo e as listas "pode" e "não pode";
  - sem chaves técnicas nem nomes de permissão;
  - o item do menu passa a se chamar "Papéis".
- **Design system:**
  - a lista "pode / não pode" vira um componente pequeno do app (`HistoriaDoPapel.vue`), montado com `DsIcone` (`check` e `fechar`) e tokens;
  - se aparecer uma terceira vez, sobe para o design system.

## Critérios de aceite

- **Domínio:**
  - `historiaDoPapel` testado: Recepção com e sem o módulo Pacotes;
  - Barbeiro com limites;
  - Dono sem limites;
  - toda permissão do catálogo tem frase (teste que falha se faltar).
- **Telas:**
  - o convite mostra os cartões permitidos pela hierarquia;
  - escolher um cartão mostra a história e envia o `papelId` certo.
- `pnpm verificar` e `pnpm verificar:layout` verdes, com as capturas do diálogo e da tela de papéis revisadas.

## Etapas

- [x] 1. Domínio: frases, resumos, limites e `historiaDoPapel`, com testes.
- [x] 2. `HistoriaDoPapel.vue` e `UsuarioDialogo` com cartões e história, com testes de tela.
- [x] 3. `PapeisView` com as histórias; item do menu "Papéis".
- [x] 4. Spec de layout do diálogo de convite; verificar, revisar a segurança e fazer o commit.

## Registro de mudanças

- 2026-11-08: criado depois da entrevista (4 perguntas).
- 2026-11-08: mini-spec aprovado ("isso mesmo").
- 2026-11-08: implementado.
  - **Domínio (`historias.js`):**
    - `ACOES_DAS_PERMISSOES`, com frases no infinitivo que servem para "Vai poder" e "Não vai poder";
    - `historiaDoPapel` e `resumoDoPapel`;
    - quem vê a agenda de todos não repete "a própria agenda".
  - **Convite e troca de papel:**
    - cartões `DsEscolha` grandes, só com os papéis permitidos pela hierarquia;
    - a história fica num componente do app, `HistoriaDoPapel.vue`;
    - o diálogo passou para a largura `md`.
  - **Tela de papéis:**
    - mostra as histórias no lugar de "Ver permissões";
    - o `PapelDialogo.vue`, com a lista técnica, foi removido;
    - o menu passou a dizer "Papéis".
  - **Testes:**
    - 5 de domínio;
    - de tela: hierarquia, história e `papelId` enviado;
    - spec de layout do convite (72 verdes no `verificar:layout`).
