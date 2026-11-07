# Central de preferências

Toda opção que o usuário possa escolher e que deva ser lembrada (tema, paleta, idioma, densidade, visão padrão do calendário etc.) é uma **preferência** e segue esta regra. Decisão em `docs/adr/0006-preferencias-na-sessao-sincronizadas-com-banco.md`.

## Regras

1. **Local único por app.** Em cada app, preferências são escolhidas somente na tela "Preferências" (rota `/preferencias`). Não criar seletores de preferência soltos em outras telas, exceto atalhos que gravem pela mesma central (ex.: botão de modo escuro no cabeçalho).
2. **Catálogo fechado.** Cada preferência é registrada no catálogo do backend com: `chave`, valor padrão e lista de valores válidos. O backend rejeita chave ou valor fora do catálogo (400). O front usa o mesmo catálogo de chaves, sem inventar chaves em outro lugar.
3. **Persistência em duas camadas.** Aplicar na hora, gravar no cache local (`localStorage`) e sincronizar via `PUT /api/preferencias/:chave`. O banco é a fonte da verdade na carga (ADR 0006).
4. **Acesso por composable.** Telas leem e alteram preferências por `usePreferencias()` (no app). Nunca ler ou escrever `localStorage` ou a API de preferências diretamente nas telas.
5. **Design system.** A lib de UI só aplica efeitos visuais (ex.: `useTema`) e não conhece a API. Um novo controle de escolha vira componente `Ds*`, conforme a skill `design-system`.
6. **Valor padrão sempre definido.** O app precisa funcionar sem nenhuma preferência gravada.
7. **Textos em pt-BR** nos rótulos e nas opções.

## Ao adicionar uma preferência

1. Incluir no catálogo do backend (chave, padrão, valores válidos).
2. Incluir no catálogo do front e na tela "Preferências".
3. Fazer o efeito acontecer via composable ou token (sem valor fixo nos componentes).
4. Cobrir com teste: valor inválido rejeitado, padrão aplicado, persistência.
5. Se a preferência for por usuário (multiusuário), abrir novo ADR antes.
