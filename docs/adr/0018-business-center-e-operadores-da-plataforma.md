# ADR 0018: Business Center e operadores da plataforma

- **Status:** Aceito
- **Data:** 2026-11-08
- **Relacionado:** ADRs 0001, 0010, 0011 e 0014; planejamento 0028

## Contexto

A equipe BarberTime precisa de três coisas:

- acompanhar a saúde de cada barbearia cliente;
- confirmar a contratação de módulos adicionais (o MVP não tem cobrança, ADR 0011);
- suspender barbearias e trocar o Dono, pendência do planejamento 0023.

Essas ações cruzam o isolamento entre barbearias (ADR 0001). Por isso a conta que as faz é um alvo de alto valor.

## Decisão

- **App separado:** `apps/business-center` (BarberTime Business Center). Nenhum código de operador vai para o app das barbearias.
- **Identidade separada:**
  - Os operadores ficam na tabela `operadores` e não são usuários de barbearia.
  - São criados só por script, nunca pela tela.
  - Sessão própria, `sessoes_operador`, com cookie `bt_operador` de 8h.
  - A API não aceita uma identidade no lugar da outra.
- **2FA obrigatório:** entrar exige senha e código TOTP (RFC 6238). O mesmo código não vale duas vezes.
- **Leitura pela RLS:**
  - O painel de uma barbearia é lido no contexto dela (`app.barbearia_id`), em transação só de leitura.
  - A lista usa uma função `security definer` que devolve só agregados.
  - Nenhum papel de banco ignora a RLS. Isso substitui a ideia de "papel que ignora RLS" do ADR 0001.
- **Sem dados pessoais de clientes:** o Business Center mostra contagens, valores e rankings de serviços e produtos.
- **Auditoria:** toda ação de operador e toda abertura de painel vão para `auditoria_plataforma`, que só aceita inserção.
- **Ações no MVP:**
  - ativar e desativar módulos;
  - suspender e reativar barbearia, com motivo;
  - transferir o Dono para um usuário vinculado e ativo, com o Dono antigo virando Gerente.

## Consequências

- Uma ação nova de operador entra em `/api/plataforma` e grava auditoria.
- Comparar barbearias numa consulta só exigiria agregados novos na função `security definer`, nunca leitura crua.
- O segredo TOTP fica no banco sem cifra por ora (pendência na meta 0024, frente B).
