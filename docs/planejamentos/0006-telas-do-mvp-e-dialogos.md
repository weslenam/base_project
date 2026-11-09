# Planejamento 0006: Telas do MVP e diálogos de confirmação, advertência e negação

- **Status:** Concluído
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamentos 0001 (MVP) e 0005, ADRs 0001, 0003 e 0008, skill `design-system`
- **Commits:** 44fe968 (branch `feat/componentes-mvp`)

## Solicitação de origem

> precisamos de mais telas e janelas de dialogo de confirmacao negacao e advertencia

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Quais telas? → **Agenda do dia, Clientes, Serviços e equipe, Agendamento público.**
  - De onde vêm os dados, sem API de negócio nem banco? → **Dados de exemplo no front**, numa camada com a mesma interface que a API terá.

## Objetivo

1. Criar diálogos padronizados de **confirmação** (pergunta sim/não), **advertência** (alerta antes de seguir, com opção de voltar) e **negação** (ação recusada, com explicação e um único botão).
2. Implementar as quatro telas do MVP sobre uma camada de dados em memória que depois troca por HTTP sem mexer nas telas.

**Fora do escopo:** API de negócio, banco e migrações, autenticação e multi-tenant real, caixa e comanda, comissões, relatórios, lembretes e a central de preferências.

## Decisões e restrições

- **`useDialogo()` na lib de UI** com `confirmar`, `advertir` e `negar`, todos devolvendo Promise. O `useConfirmacao()` continua existindo como atalho de `confirmar`. Cada tipo tem ícone, título padrão e cor próprios, com estado nunca só por cor (ADR 0003):

  | Tipo        | Ícone      | Cor                                       | Título padrão    | Botões               | Resultado          |
  | ----------- | ---------- | ----------------------------------------- | ---------------- | -------------------- | ------------------ |
  | confirmação | `info`     | `aco` (`perigo` se a ação for destrutiva) | Confirmação      | Cancelar / Confirmar | `true`/`false`     |
  | advertência | `alerta`   | `cobre`                                   | Atenção          | Voltar / Continuar   | `true`/`false`     |
  | negação     | `bloqueio` | `perigo`                                  | Não foi possível | Entendi              | sempre `undefined` |

  O âmbar não é usado em advertência: pelo guia da identidade, ele é exclusivo da fila e da hora atual. Pelo mesmo motivo, a notificação `aviso` passa a usar o cobre.

- **Componentes novos que as telas exigem:** `DsPagina` (cabeçalho de tela com título e ações), `DsFormulario` (valida tudo e só emite `enviar` se estiver válido), `DsTextarea`, e os tipos `data` e `hora` no `DsInput`.
- **Regras de agenda em lib `libs/dominio` (`scope:shared`)**, puras e testadas: conversão de horário, sobreposição e horários livres. A futura API vai reutilizar a mesma lib, então a regra não fica presa no front.
- **Camada de dados do app (`apps/barbertime/src/dados/`):** `api.js` com funções assíncronas (`api.clientes.listar()`, `api.agendamentos.criar()`...) sobre um armazenamento em memória com dados de exemplo. Erros de negócio saem como `ErroDeNegocio` com mensagem pronta para o diálogo de negação. Os dados voltam ao exemplo a cada recarga.
- **Agendamento público** em `/agendar/:slug`, sem o menu interno (rota com `meta.publica`). A marca da barbearia vem primeiro e o BarberTime assina no rodapé (ADR 0003). A navegação é feita com uma mão, no celular.
- A rota `/` redireciona para `/agenda`.

## Etapas

- [x] 1. `useDialogo` (confirmar, advertir, negar) no `DsApp`, com contrato.
- [x] 2. `DsPagina`, `DsFormulario`, `DsTextarea` e tipos `data`/`hora` no `DsInput`, com contratos.
- [x] 3. `libs/dominio`: horários, sobreposição, horários livres e dias, com testes.
- [x] 4. Camada de dados em memória (`dados/`), com testes das regras (conflito, exclusão em uso).
- [x] 5. Tela **Agenda do dia**: navegação de dias, colunas por barbeiro, novo agendamento, detalhes com confirmar, marcar falta e cancelar.
- [x] 6. Tela **Clientes**: busca, lista, cadastro e edição com histórico, exclusão.
- [x] 7. Tela **Serviços e equipe**: cadastros com exclusão negada quando há agendamento futuro.
- [x] 8. Tela **Agendamento público**: serviço, barbeiro, dia, horário, dados e confirmação.
- [x] 9. Menu, rotas, vitrine dos diálogos, README e `pnpm verificar`.

## Critérios de pronto

- `pnpm verificar` passa, com contratos para os componentes novos e testes de domínio, dados e telas.
- As telas abrem pelo menu, e cada ação destrutiva passa por confirmação, advertência ou negação.
- Marcar um horário ocupado mostra o diálogo de negação.

## Riscos e pendências

- Os dados em memória somem ao recarregar a página. É intencional até a API existir.
- A conferência visual depende do usuário.
- **Fila global dos diálogos:** um diálogo sem resposta ficava pendurado quando o `DsApp` saía da tela, e travava a fila. Agora a desmontagem do `DsApp` descarta os pendentes, que respondem como "cancelar". Isso foi coberto por contrato.
- **Estados do bloco de agenda:** o `DsBlocoAgenda` ganhou `atendido` e `faltou`, porque as telas precisam mostrar o dia já atendido.
- A troca dos dados em memória pela API depende do ADR de ORM, migrações e autenticação (fase 0).

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Concluído. Testes: 96 de contrato na lib, 13 de domínio, 46 de utilitários e 24 no app (16 de dados e 8 de fluxo de tela). Lint e build sem avisos. As rotas viraram imports sob demanda (cada tela tem de 5 a 12 kB).
- 2026-11-07: Durante a execução entraram `api.servicos.contarFuturos` (advertência ao mudar a duração), o bloqueio de horário na agenda e a vitrine dos três diálogos.
- 2026-11-07: A tela "Serviços e equipe" foi separada em Equipe, Serviços e Produtos no planejamento 0007.
