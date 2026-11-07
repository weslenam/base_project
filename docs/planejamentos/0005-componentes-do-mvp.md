# Planejamento 0005: Componentes `Ds*` para o MVP

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamentos 0001 (MVP), 0003 e 0004, ADR 0003, skill `design-system`
- **Commits:** ainda não commitado (branch `feat/componentes-mvp`, a partir de `feat/kit-base-ds`)

## Solicitação de origem

> implemente mais componentes

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Esclarecimentos:** nenhum. O pedido não lista componentes; a escolha abaixo segue o MVP (planejamento 0001), os componentes de referência da identidade visual (`Botao`, `Selo`, `Horarios`, `BlocoAgenda`) e a prioridade da skill para campos com regra brasileira.

## Objetivo

Acrescentar ao kit os componentes que as primeiras telas do MVP vão usar: agenda, página pública de agendamento, cadastro de clientes e caixa.

**Fora do escopo:** a grade completa da agenda (`DsAgenda`, sobre o `VCalendar`), gráficos (`DsGrafico`), datas (`DsInputData`) e telas de negócio. Esses itens ficam para quando as telas pedirem.

## Componentes

| Componente        | Para quê                                                                                                      | Referência                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `DsIcone`         | Ícones de interface por nome de um catálogo fechado em pt-BR (`agenda`, `cliente`, `caixa`...), via `@mdi/js` | guia da identidade, "Logo e iconografia" |
| `DsSelo`          | Status com palavra e marca (confirmado, pendente, assinante, fila, faltou, neutro)                            | `.bt-selo`                               |
| `DsCartao`        | Superfície elevada com título opcional, conteúdo e ações                                                      | `.bt-cartao`                             |
| `DsHorarios`      | Escolha de horário (slots) na página pública, com indisponíveis riscados                                      | `.bt-horarios`                           |
| `DsBlocoAgenda`   | Bloco de agendamento na agenda: cliente, serviço, horário e estado pela borda superior                        | `.bt-bloco`                              |
| `DsInputTelefone` | Celular ou fixo com máscara; o modelo guarda só dígitos                                                       | skill: regra brasileira                  |
| `DsInputCpf`      | CPF com máscara e validação de dígitos; o modelo guarda só dígitos                                            | skill: regra brasileira                  |
| `DsInputMoeda`    | Valor em reais, digitado como centavos; o modelo é número                                                     | skill: regra brasileira                  |

Também entra no `DsLayout` um `icone` opcional por item de menu.

## Decisões e restrições

- **Máscaras e validações em `@barbertime/ui-utils`**, puras e testadas: `somenteDigitos`, `formatarTelefone`, `validarTelefone`, `formatarCpf`, `validarCpf`, `centavosParaReais`. Os componentes só as usam. Não usar o `VMaskInput`, que ainda está em labs no Vuetify 4.3.
- **Selo, cartão, horários e bloco em HTML próprio com tokens**, sem componente do Vuetify: são padrões da marca, e assim o contrato não depende do framework. Ícone e campos usam `VIcon` e `VTextField`.
- **Estado nunca só por cor** (ADR 0003): o selo sempre traz o texto, o bloco traz o estado em texto acessível, e o horário indisponível é riscado e `disabled`.
- **Catálogo fechado de ícones:** um nome fora do catálogo gera aviso e não renderiza nada. Isso mantém o estilo contornado e permite trocar de pacote de ícones sem mexer nas telas.
- Cada componente ganha um teste de contrato em `ui-contrato`, uma entrada na vitrine `/componentes` e uma linha no README.

## Etapas

- [x] 1. `ui-utils`: funções de máscara e validação, com testes.
- [x] 2. `@mdi/js` em `ui-vuetify` e `DsIcone` com o catálogo.
- [x] 3. `DsSelo`, `DsCartao`, `DsHorarios`, `DsBlocoAgenda`.
- [x] 4. `DsInputTelefone`, `DsInputCpf`, `DsInputMoeda`.
- [x] 5. Ícone por item no `DsLayout`.
- [x] 6. Contratos e specs ligados à implementação Vuetify.
- [x] 7. Vitrine, README e `pnpm verificar`.

## Critérios de pronto

- `pnpm verificar` passa, com contrato para cada componente novo.
- A vitrine `/componentes` mostra todos os componentes.

## Riscos e pendências

- A conferência visual depende do usuário, porque o ambiente não tem navegador.
- **Tema escuro na vitrine:** não há seletor. Escolher o tema é uma preferência e precisa da central de preferências (ADR 0006), que ainda não existe; um seletor solto na vitrine violaria a regra. Fica para o planejamento da central.
- O bundle subiu para 480 kB (165 kB gzip) com os ícones e os campos. A divisão por rota continua pendente.

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Concluído. `ui-utils` com 42 testes de máscara e validação; `ui-vuetify` com 78 testes de contrato; lint e build passam.
- 2026-11-07: Critério "temas claro e escuro" retirado: depende da central de preferências (ver Riscos).
