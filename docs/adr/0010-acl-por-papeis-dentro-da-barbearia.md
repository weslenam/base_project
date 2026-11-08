# ADR 0010: Controle de acesso por hierarquia fixa de papéis dentro da barbearia

- **Status:** Aceito; revisado em 2026-11-08 (planejamento 0023)
- **Data:** 2026-11-07
- **Relacionado:** ADRs 0001, 0009 e 0014; planejamentos 0013, 0022 e 0023

## Contexto

Dono, gerente, recepção e barbeiro precisam ver e fazer coisas diferentes.

A primeira versão deixava o Dono criar papéis personalizados marcando permissões. A revisão de segurança do planejamento 0022 mostrou o risco: um papel com `usuarios.gerenciar` conseguia virar Dono ou assumir a conta do Dono. O usuário decidiu por uma **hierarquia fixa e não personalizável**: "eu nao posso alterar papel subindo nem lateral muito menos senhas e isso não é customizavel".

## Decisão

- **Quatro papéis fixos, em níveis:**

  | Nível | Papel    | Permissões                                                                                |
  | ----- | -------- | ----------------------------------------------------------------------------------------- |
  | 1     | Dono     | Todas                                                                                     |
  | 2     | Gerente  | Todas, menos `barbearia.configurar` e `modulos.gerenciar` (gerencia usuários abaixo dele) |
  | 3     | Recepção | Agenda, clientes e caixa (sem fechar o caixa)                                             |
  | 4     | Barbeiro | Só a própria agenda                                                                       |

  Os níveis e as permissões de cada papel vivem em `@barbertime/dominio` (`PAPEIS_PADRAO`, `nivelDoPapel`). A API monta as permissões pela **chave** do papel e pelos módulos ativos; a coluna `papeis.permissoes` não é fonte de verdade.

- **Sem papéis personalizados.** A tela Papéis é só leitura. Os papéis personalizados que existiam foram apagados, e os usuários deles viraram Barbeiro (migração do planejamento 0023).
- **Hierarquia estrita:** só se age sobre quem está **abaixo**, nunca acima nem na lateral (`podeAgirSobre`). A regra vale para convidar, dar papel, trocar papel, desativar e remover, e é checada contra o papel atual do alvo e contra o papel novo. Ninguém altera o próprio acesso.
- **Quem gerencia usuários:** Dono (gerencia Gerente, Recepção e Barbeiro) e Gerente (gerencia Recepção e Barbeiro).
- **Um Dono por barbearia:** o do cadastro. Ninguém dá o papel Dono, porque não há nível acima dele. Transferir a barbearia fica para um planejamento próprio.
- **Senha é só da própria pessoa:**
  - troca em Meu perfil, com a senha atual;
  - quem esqueceu recupera por e-mail, com link de uso único (ADR 0014);
  - não existe rota para trocar a senha de outra pessoa.
- **Catálogo fechado de permissões** no formato `recurso.acao`. Front e API usam o mesmo catálogo. A verificação fica na API (`exigir`), com 403 em pt-BR; o front só esconde.
- **Vínculo:** `usuario × barbearia × papel`. O mesmo usuário pode estar em várias barbearias, com papéis diferentes.

## Consequências

- Uma funcionalidade nova declara as suas permissões no catálogo e decide, no domínio, quais dos quatro papéis as recebem. Não precisa de migração de permissões, porque elas vêm do código.
- Permissões por registro (ex.: "só os próprios agendamentos") são tratadas na regra da rota, sem caber no catálogo.
- Mudar a hierarquia (ex.: um quinto papel) exige rever este ADR.

## Histórico

- **2026-11-07:** papéis padrão mais papéis personalizados com permissões marcadas pelo Dono.
- **2026-11-08 (planejamento 0022):** regra "ninguém concede o que não tem" (`permissoesAlemDasSuas`).
- **2026-11-08 (planejamento 0023):** substituída pela hierarquia fixa. Saem os papéis personalizados, `papeis.gerenciar` e a senha provisória definida pelo Dono.
