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
  - papel em uso não pode ser excluído;
  - **ninguém concede o que não tem** (2026-11-08, planejamento 0022). Isso vale para:
    - **quem administra usuários**, que não dá papel com permissão que ele não tenha e não altera, remove nem troca a senha de quem tem permissão que ele não tenha;
    - **quem gerencia papéis**, que não cria nem edita papel, inclusive o próprio, com permissão que ele não tenha, e não mexe em papel maior que o seu.

    A comparação é com as permissões do papel (`permissoesAlemDasSuas`, no domínio). Sem essa regra, um papel personalizado com `usuarios.gerenciar` viraria Dono ou assumiria a conta do Dono. O achado veio da revisão de segurança.

## Consequências

- Uma funcionalidade nova declara as suas permissões no catálogo e decide quais papéis padrão as recebem (com migração para as barbearias existentes).
- Permissões por registro (ex.: "só os próprios agendamentos") são tratadas na regra da rota, sem caber no catálogo.
