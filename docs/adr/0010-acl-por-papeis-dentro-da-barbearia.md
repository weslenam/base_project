# ADR 0010: Controle de acesso por papéis dentro da barbearia

- **Status:** Aceito
- **Data:** 2026-11-07
- **Relacionado:** ADRs 0001 e 0009; planejamento 0013

## Contexto

Dono, gerente, recepção e barbeiro precisam ver e fazer coisas diferentes, e cada barbearia organiza a equipe do seu jeito.

## Decisão

- **Catálogo fechado de permissões** em `@barbertime/dominio`, no formato `recurso.acao` (ex.: `caixa.fechar`, `clientes.excluir`). Front e API usam o mesmo catálogo.
- **Papéis por barbearia.** Ao criar a barbearia, nascem quatro papéis padrão:
  - **Dono:** todas as permissões; não pode ser editado nem excluído.
  - **Gerente:** tudo, menos administração de usuários e módulos.
  - **Recepção:** agenda, clientes e caixa (sem fechar o caixa).
  - **Barbeiro:** só a própria agenda.
- **Papéis personalizados:** o dono, ou quem tiver `papeis.gerenciar`, cria papéis marcando permissões do catálogo. Permissão fora do catálogo é recusada.
- **Vínculo:** `usuario × barbearia × papel`. O mesmo usuário pode estar em várias barbearias.
- **Verificação na API**, com `exigir('permissao')` em cada rota. A resposta é 403 com mensagem em pt-BR. O front só esconde o que não é permitido; quem decide é a API.
- **Proteções:**
  - a barbearia sempre tem ao menos um Dono ativo;
  - ninguém altera o próprio papel;
  - papel em uso não pode ser excluído.

## Consequências

- Uma funcionalidade nova declara as suas permissões no catálogo e decide quais papéis padrão as recebem (com migração para as barbearias existentes).
- Permissões por registro (ex.: "só os próprios agendamentos") são tratadas na regra da rota, sem caber no catálogo.
