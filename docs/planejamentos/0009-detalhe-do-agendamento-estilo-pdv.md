# Planejamento 0009: Detalhe do agendamento no estilo PDV

- **Status:** Em andamento
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** planejamentos 0006 e 0008, skill `design-system`
- **Commits:** ainda não commitado (branch `feat/caixa-comanda`)

## Solicitação de origem

> a tela do agendamento esta bem ruim penso que poderiamos deixar as informações de um lado e as opções de execução em outra os botoes de ação como um PDV

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente, com captura de tela do diálogo "Agendamento"
- **O que a captura mostrava:** diálogo estreito (largura `sm`), informações empilhadas, e quatro botões numa linha só que estourava a largura, cortando "Cancelar" e "Marcar falta".

## Objetivo

Reorganizar o detalhe do agendamento em duas colunas, com as informações à esquerda e um painel de ações à direita. As ações viram botões grandes, como num PDV: fáceis de acertar no balcão, com ícone, título e uma linha explicando o efeito.

**Fora do escopo:** mudar as regras de cada ação (confirmação, advertência e negação continuam como no planejamento 0006).

## Decisões e restrições

- **Novo componente `DsAcao`** (botão de ação estilo PDV): `icone`, `titulo`, `descricao`, `variante` (`primario` | `secundario` | `perigo`) e `desabilitado`, com altura mínima de 64px. Tem contrato próprio e fica disponível para o caixa e outras telas.
- **Layout do detalhe:** diálogo `lg`. À esquerda ficam cliente (em destaque), horário em fonte grande, serviço, barbeiro, telefone, situação e as **observações do cliente**, que hoje não aparecem e são úteis no balcão. À direita fica o painel de ações. Abaixo de 40rem, as duas colunas empilham.
- **Ações por estado:**
  - pendente: Confirmar presença e Cancelar agendamento
  - confirmado: Marcar atendido, Abrir comanda, Marcar falta e Cancelar agendamento
  - atendido: Abrir comanda
  - bloqueado: Remover bloqueio
  - faltou ou cancelado: só o aviso "Nenhuma ação disponível"
- **Correção geral no `DsDialogo`:** a barra de ações passa a quebrar linha em vez de estourar a largura.

## Etapas

- [ ] 1. `DsAcao` na lib, com contrato, vitrine e README.
- [ ] 2. `DsDialogo`: ações quebram linha.
- [ ] 3. `api.agendamentos.obter` devolve as observações do cliente.
- [ ] 4. `DetalheAgendamento` em duas colunas com o painel de ações.
- [ ] 5. Ajustar os testes de tela e rodar `pnpm verificar`.

## Critérios de pronto

- Nenhuma ação cortada em qualquer largura; no celular, as colunas empilham.
- Os fluxos existentes (advertência ao cancelar confirmado, abrir comanda) continuam passando nos testes.

## Registro de mudanças

- 2026-11-07: Plano criado.
