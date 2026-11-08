# ADR 0012: Configurações da barbearia como dados do negócio (catálogo fechado em JSONB)

- **Status:** Aceito
- **Data:** 2026-11-07
- **Relacionado:** ADRs 0006 e 0010; planejamento 0017

## Contexto

O Dono precisa configurar a barbearia: contato, horário de funcionamento e regras do agendamento online. Já existe uma central de **preferências** (ADR 0006), mas ela trata de escolhas de exibição de cada usuário (tema, densidade, visão do calendário). Horário e regras de agendamento são outra coisa: valem para todos e mudam o comportamento do negócio.

## Decisão

- **Configurações da barbearia não são preferências.** Elas ficam numa coluna `barbearias.configuracoes` (`jsonb`). O nome e o endereço público (`slug`) continuam em colunas próprias.
- **Catálogo fechado** em `@barbertime/dominio` (`barbearia.js`), com três peças:
  - `CONFIG_BARBEARIA_PADRAO`: os padrões, com três grupos: `contato`, `funcionamento` (os 7 dias) e `agendamento`.
  - `mesclarConfigBarbearia`: completa o que está gravado com os padrões.
  - `validarConfigBarbearia`: devolve o motivo da recusa em pt-BR, ou null.

  O front valida antes de enviar, para negar na hora. A API valida de novo e responde 400.

- **Quem edita:** só quem tem a permissão `barbearia.configurar`. Por padrão, só o Dono (ADR 0010).
- **Rotas:** `GET` e `PUT /api/barbearia`, sempre para a barbearia da sessão.

## Consequências

- Uma configuração nova entra em três lugares: no padrão, na validação e na tela. Barbearias antigas recebem o padrão pela mescla, sem precisar de migração.
- A agenda e a página pública devem ler horário e regras daqui quando migrarem para a API (planejamento 0013, fase 3).
