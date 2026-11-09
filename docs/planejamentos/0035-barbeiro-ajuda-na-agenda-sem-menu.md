# Planejamento 0035: Barbeiro ajuda na agenda, sem menu

- **Status:** Concluído
- **Data:** 2026-11-09
- **Solicitado por:** Weslen
- **Relacionado:** ADRs 0009, 0010, 0011 e 0014; planejamentos 0013 (sessão e permissões), 0019 e 0020 (agenda), 0023 (papéis fixos), 0030 (menu lateral)
- **Commits:** ainda não commitado

## Solicitação de origem

> para o login do barbeiro podemos assumir que a visão dele será somente esta eele não poderá abrir o menu sanduiche porque não precisa ver os modulos (aqui temos uma adaptação na regra do papel / permissao dele)

(acompanhada de uma captura da Agenda logada como "Marcos Barbeiro")

- **Quando:** 2026-11-09 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Como esconder o menu do Barbeiro: regra geral (quem só tem uma tela) ou fixa no papel? → **Fixo no papel Barbeiro.**
  - Quais colunas da agenda ele vê? → "ele pode ver todas e manipular todas mas pode editar caso ele tenha agendado para alguem senao não pode editar nem excluir e ele pode realizar bloqueios a ideia que ele tenha função de ajudar no atendimento tbm"
  - Botões "Bloquear horário" e "Novo agendamento"? → "respondido anteriormente" (pode agendar e bloquear).
  - Ações nos agendamentos da coluna dele? → **Marcar atendido/faltou.**
  - Atendido/Faltou em quais agendamentos? → **Coluna dele + os que ele criou.**
  - Confirmar e Cancelar? → **Só nos que ele criou.**
  - Bloqueios? → **Bloqueia em qualquer coluna; remove só os que ele criou.**
  - Clientes no agendamento? → **Buscar e cadastrar.**

### Solicitações relacionadas

> todos os planos estão aprovados (2026-11-09)

> crie um atalho nesta tela com um mais de novo agendamento já carregando a caixa de dialogo com o barbeiro relacionado mas mantenha o novo para agendamento
>
> use o mesmo para o bloqueio, adicione o icone do + e cancelar como na ação da agenda (2026-11-09)

## Objetivo

O Barbeiro usa só a Agenda, sem menu sanduíche. Vê todas as colunas e ajuda a recepção (agenda e bloqueia em qualquer coluna), mas só confirma/cancela o que criou e só marca Atendido/Faltou na própria coluna ou no que criou.

**Fora do escopo:** tela de edição de agendamento (não existe hoje), Balcão/Caixa para o Barbeiro, a rota Módulos visível sem permissão para todos os papéis e a tela em branco relatada ao sair (investigação separada).

## Decisões e restrições

- **Marca fixa no papel** (`semMenu: true` em `PAPEIS_PADRAO`), por escolha do Weslen. O app esconde o sanduíche e o guarda leva o Barbeiro para `/agenda` em qualquer rota que não seja `/agenda` ou `/perfil`.
- **Permissão nova `agenda.ajudar`** ("Ajudar na agenda"): agendar e bloquear em qualquer coluna, com as restrições de autoria abaixo. Quem tem `agenda.gerenciar` continua sem restrição. Barbeiro passa a ter `agenda.ver`, `agenda.ajudar`, `clientes.ver` e `clientes.editar`; `agenda.ver_propria` sai do papel, mas fica no catálogo.
- **Autoria:** coluna `criado_por` (usuário) em `atendimentos` e `bloqueios`, preenchida pela API. Registros antigos e da página pública ficam sem autor (o Barbeiro não mexe neles).
- **Regra no domínio** (`podeAgirNoAgendamento`), usada pela API (que decide, ADR 0010) e pelo front (só esconde botões).

| Ação | Barbeiro (`agenda.ajudar`) |
|---|---|
| Novo agendamento | qualquer coluna |
| Bloquear horário | qualquer coluna |
| Confirmar / Cancelar agendamento | só os que criou |
| Atendido / Faltou | coluna dele ou os que criou (Atendido segue exigindo check-in) |
| Remover bloqueio | só os que criou |

- UI pelo design system: sem mudança no contrato; o `DsLayout` já esconde sanduíche e gaveta quando `itensMenu` vem vazio.

## Etapas

- [x] 1. Domínio: permissão `agenda.ajudar`, papel Barbeiro (`semMenu`, permissões novas) e `podeAgirNoAgendamento`, com testes.
- [x] 2. Migração `criado_por` em `atendimentos` e `bloqueios`.
- [x] 3. API: criar agendamento e bloqueio com `agenda.ajudar`, gravando `criado_por`; troca de estado conferida pela regra do domínio. Testes de integração (403/200 por linha da tabela) em `agendaBarbeiro.spec.js`.
- [x] 4. Front: App manda menu vazio (o `DsLayout` já some com o sanduíche nesse caso, coberto pelo contrato) e guarda de rotas.
- [x] 5. Front: botões da Agenda e ações do Detalhe pela regra do domínio.
- [x] 7. Atalhos na coluna da agenda: ícones de bloqueio e + no cabeçalho de cada barbeiro abrem os diálogos com ele já escolhido; os botões do topo continuam sem barbeiro. Teste em `agendaAtalhos.spec.js`.
- [x] 6. Verificar: `pnpm verificar:tudo`, `pnpm verificar:layout` e spec de layout da agenda do Barbeiro.

## Critérios de pronto

- Barbeiro entra e vê a Agenda com todas as colunas, sem sanduíche; outra URL volta para `/agenda` (exceto `/perfil`).
- Barbeiro agenda e bloqueia em qualquer coluna; cancela/confirma só o que criou; Atendido/Faltou só na coluna dele ou no que criou. Fora disso a API responde 403 e o botão não aparece.
- Dono, Gerente e Recepção sem mudança.
- `pnpm verificar:tudo` e `pnpm verificar:layout` verdes.

## Riscos e pendências

- Com `clientes.ver`, a API de clientes fica aberta ao Barbeiro (a busca por telefone depende dela); o front bloqueia a tela `/clientes`.
- No celular o nome do usuário (link do Perfil) fica oculto no cabeçalho, então o Barbeiro não chega ao Perfil por ali (comportamento anterior, vale para todos os papéis).
- "Abrir comanda" no detalhe passou a exigir `caixa.operar` (antes aparecia e levava a uma tela sem acesso).
- `agenda.ver_propria` segue no catálogo e na API, mas nenhum papel fixo a usa mais.
- O stage atual contém o trabalho do planejamento 0034 ainda não commitado; o commit deste plano deve ser separado.

## Registro de mudanças

- 2026-11-09 — Plano criado e aprovado pelo Weslen ("todos os planos estão aprovados").
- 2026-11-09 — Implementado. Desvios: `semMenu` não vai na sessão da API (o front calcula com `papelSemMenu(papel.chave)` do domínio) e o `DsLayout` não precisou de propriedade nova. O teste N10 (`correcoes.spec.js`) passou a afirmar a regra nova: o Barbeiro lê o bloqueio do colega, mas não o remove. Verificado: `pnpm verificar`, `api:integracao` (112) e `verificar:layout` (78 ok, 9 pulados por módulo inativo). Falta revisão (`/code-review`), `security-review` e commit.
- 2026-11-09 — Etapa 7 (atalhos na coluna), a pedido do Weslen. O cabeçalho da coluna quebra a linha em tela estreita para o nome não encolher (pego pelo `verificar:layout`).
