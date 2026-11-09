# Planejamento 0026: Correções da revisão do PR #3 e do backend

- **Status:** Concluído
- **Data:** 2026-11-08
- **Solicitado por:** Weslen
- **Relacionado:** PR #3; planejamento 0025 (achados N3 a N11); ADRs 0010, 0013 e 0014; planejamentos 0020 e 0023
- **Commits:** 579a71a (correções); fechamento do documento no commit seguinte

## Solicitação de origem

> sim faça mas faca a code review do PR

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente. Resposta ao pedido de push e abertura do PR. A code review rodou e os 10 achados entraram como checklist na descrição do PR #3.
- **Esclarecimentos:**
  - Depois de aplicar as decisões sobre skills e agentes, o que fazer em seguida? → "Commit + corrigir o PR #3".
  - Além dos 10 do PR, o que entra desta rodada? → "10 do PR + N3 a N11". N1, N2 e N13 ficam para a migração (planejamento 0025), porque o Auth e o convite vão mudar.
  - Como deve ficar a exclusão de cliente (N4)? → "Anonimizar": apaga nome, telefone e CPF e mantém comandas e atendimentos com "Cliente removido".
  - Entrevista do Supabase agora ou depois? → "Depois das correções".

## Objetivo

Corrigir na branch do PR #3 os 10 achados da code review e os achados N3 a N11 do planejamento 0025, cada um com teste novo, sem mudar o comportamento que já funciona.

**Fora do escopo:** N1, N2, N12 a N16 (ficam no 0025) e a migração para o Supabase.

## Decisões e restrições

- **Mudanças cirúrgicas** (skill `mudancas-cirurgicas`): regras de negócio no `@barbertime/dominio` quando forem puras, e SQL na API.
- **ADR 0014:** entrada malformada recebe 400, nunca 500.
- **Preço da comanda vem sempre do catálogo.** A tela não deixa editar preço, e o item de pacote com R$ 0 já é recusado pela API ("Pacotes ainda não estão disponíveis"). Por isso o servidor ignora `preco` e `nome` vindos do cliente. Efeito colateral aceito: se o preço do catálogo mudar com a comanda aberta, a comanda passa a usar o preço novo ao ser salva de novo.
- **Ação "atendido" na agenda** segue o ciclo do domínio: só sai de `em_atendimento` (atendimento iniciado) ou de `chegou`. De `agendado` é negado, porque o caminho é o check-in, que abre a comanda.
- **Cancelar da agenda** também cancela a comanda aberta do check-in, como o `desistir` do balcão.
- **Anonimização (N4):** a exclusão vira `update` dos dados pessoais. A FK `atendimentos.cliente_id` passa de `cascade` para `restrict`, numa migração nova.
- **Trava nas transições (N7):** `select ... for update` no atendimento e na comanda antes de decidir.

## Etapas

**Achados do PR #3**

- [x] 1. Cancelar da agenda a partir de `chegou` cancela a comanda aberta.
- [x] 2. `salvarComanda` confere se o `atendimentoId` existe nesta barbearia (sob RLS).
- [x] 3. Ação "atendido" respeita o ciclo do domínio e não pula o check-in.
- [x] 4. `normalizarItens`: preço e nome do catálogo, sem itens excluídos, desconto inválido (`NaN`) vira 400.
- [x] 5. Hook `exigir-security-review.sh` nega `git commit -a`, `--all`, `--include`, `--only` e commit com caminhos.
- [x] 6. `/auth/esqueci`: a gravação do token e o envio saem do caminho da resposta, que passa a ter o mesmo tempo nos dois casos.
- [x] 7. `ACOES[estado]` só com chave própria (`Object.hasOwn`), e chave inválida dá 400.
- [x] 8. Agendamento público devolve o primeiro nome digitado, não o do cadastro.
- [x] 9. Sessão renova a expiração só quando falta menos da metade do prazo.
- [x] 10. Balcão: contagem de vendas limitada a uma janela recente.

**Achados N3 a N11 (planejamento 0025)**

- [x] 11. N3: data e hora com formato validado no schema e no domínio (`paraMinutos` recusa `NaN`). Horário público fora da grade é negado.
- [x] 12. N4: excluir cliente anonimiza; FK com `restrict`.
- [x] 13. N5: comanda que ficou aberta num caixa de outro dia passa para o caixa de hoje ao ser salva ou recebida.
- [x] 14. N6: receber comanda de agendamento confirmado leva o atendimento a `pago`.
- [x] 15. N7: transições de atendimento e comanda com `for update`.
- [x] 16. N8: iniciar agendamento com outro barbeiro confere a agenda desse barbeiro.
- [x] 17. N9: equipe permite ligar o barbeiro à conta de um usuário da mesma barbearia.
- [x] 18. N10: leitura de bloqueio respeita "só os próprios".
- [x] 19. N11: barbeiro de cada item da comanda validado nesta barbearia.

**Fechamento**

- [x] 20. `pnpm verificar:tudo` verde.
- [x] 21. `/code-review` e `security-review` sem achados abertos; marcar os itens no PR #3.

## Critérios de pronto

- Pelo menos um teste novo (domínio ou integração) para cada etapa de 1 a 19. A etapa 5 (hook) foi conferida com comandos de exemplo, porque não há suíte de testes para os hooks.
- `pnpm verificar:tudo` sem falha.
- Checklist do PR #3 marcado.

## Riscos e pendências

- **Migração da FK (N4):** num banco com dados, a troca de `cascade` para `restrict` não apaga nada. Em ambiente de desenvolvimento, `semear` precisa continuar funcionando.
- **N9 mexe em tela** (equipe): exige a skill `design-system`.
- **Supabase:** algumas correções (6 e 9) podem ser refeitas na F3 do 0025. Foram mantidas pelo baixo custo.

## Registro de mudanças

- 2026-11-08: documento criado com o escopo das respostas acima.
- 2026-11-08: ajustes depois do `/code-review` do diff:
  - **N5:** a primeira versão recusava a comanda de outro caixa. Isso a deixava presa, porque o caixa antigo não é acessível. Agora a comanda passa para o caixa de hoje.
  - **N8:** a checagem passou a considerar também os bloqueios.
  - **Comanda:** só pode ser ligada a atendimento em andamento (nem encerrado nem pago).
  - **Migração 0006:**
    - ganhou o índice único `barbeiros_usuario_unico`, para que uma conta fique em no máximo um barbeiro;
    - o `down` passou a recusar a volta quando há clientes anonimizados.
  - **Testes do "esqueci a senha":** passaram a esperar o e-mail chegar, sem tempo fixo.
  - **Grade:** a constante `PASSO_DA_GRADE` é compartilhada por `horariosLivres` e `naGrade`.
- 2026-11-08: `pnpm verificar:tudo` verde: 70 testes de integração (16 novos em `correcoes.spec.js`), mais o teste de domínio de `naGrade`. O hook de `commit -a` foi conferido com 11 comandos de exemplo.
- 2026-11-08: `/code-review` e `security-review` sem achados abertos. Push feito com a aprovação do Weslen ("pode fazer sim"). Checklist do PR #3 marcado.
