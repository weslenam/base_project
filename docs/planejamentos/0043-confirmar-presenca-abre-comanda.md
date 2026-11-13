# Planejamento 0043: Confirmar presença já abre a comanda

- **Status:** Concluído
- **Data:** 2026-11-12
- **Solicitado por:** Weslen
- **Relacionado:** planejamento 0039 (barbeiro sem abrir caixa), planejamento 0009 (detalhe do agendamento)
- **Commits:** c7b19b8

## Solicitação de origem

> temos que altearar o comportamento do confirmar porque pra mim não adianta confirmar mas deixar em aberto o pagamento

- **Quando:** 2026-11-12 · **Origem:** Conversa com o assistente

### Esclarecimentos (grill-me)

- Quando confirmar a presença, o que deveria acontecer? → **Abrir comanda direto** (um passo só, sem botão extra)
- Quem costuma executar esse fluxo? → **Ambos** (recepção e barbeiro, dependendo do dia)
- Se a comanda já existe quando o cliente chega? → **Abrir a existente**

## Objetivo

Transformar "Confirmar presença" em ação atômica: muda o estado do agendamento para `confirmado` **e** abre (ou navega para) a comanda em uma única interação. Elimina o gap onde o agendamento fica `confirmado` sem pagamento iniciado.

**Fora do escopo:** botões "Faltou", "Cancelar", "Atendido". Fluxo do Balcão. Contrato da API (nenhuma rota nova).

## Decisões e restrições

| Situação | Comportamento |
|---|---|
| Sem comanda + tem `caixa.operar` | Muda estado → cria comanda (`POST /comandas`) → abre `ComandaDialogo` |
| Comanda já existe + tem `caixa.operar` | Muda estado → abre a comanda existente (`verComanda`) |
| Sem permissão `caixa.operar` | Muda estado → fecha o diálogo (comportamento atual, sem mudança) |

- Só `DetalheAgendamento.vue` muda — sem alteração de API, domínio ou contratos.
- A função `mudar('confirmado')` já existe; o ajuste é o que acontece depois dela resolver.
- `podeComanda = pode('caixa.operar')` — barbeiro tem essa permissão por padrão.

## Etapas

- [x] 1. Ler `DetalheAgendamento.vue` na íntegra para localizar `mudar()` e `confirmarPresenca()`
- [x] 2. Ajustar o bloco `confirmado` em `mudar()`: após resolver, se `podeComanda`, chamar `abrirComanda()` ou `verComanda()` conforme `agendamento.comandaId`
- [x] 3. Remover o botão "Abrir comanda" / "Ver comanda" do estado `confirmado` (ação vira automática) — manter apenas no estado `atendido` para caso de reabertura
- [x] 4. `pnpm verificar` — sem banco envolvido, só front
- [x] 5. Testes atualizados e passando (153/153)
- [x] 6. Security review + commit em `chore/0043-confirmar-presenca-abre-comanda`

## Critérios de pronto

- Tocar "Confirmar presença" abre a comanda na mesma interação (sem tela intermediária parada).
- Usuário sem `caixa.operar` confirma normalmente e o diálogo fecha.
- Comanda já existente é aberta, não criada novamente.
- `pnpm verificar` verde.

## Riscos e pendências

- Recepção sem `caixa.operar`: comportamento atual mantido (fecha diálogo). Se a Recepção precisar disparar o pagamento mesmo sem operar o caixa, requer nova permissão — fora do escopo agora.

## Registro de mudanças

- 2026-11-12 — Planejamento criado; aprovado pelo Weslen para implementar no dia seguinte.
- 2026-11-13 — Implementado e concluído. Achado extra: `criadoPor` precisou ser adicionado a `AgendamentoNoBanco` e propagado no mock para que `podeAgirNaAgenda` com `agenda.ajudar` funcionasse corretamente nos testes do Barbeiro.
