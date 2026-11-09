# Planejamento 0028: BarberTime Business Center (administração da plataforma)

- **Status:** Concluído
- **Data:** 2026-11-08
- **Solicitado por:** Weslen
- **Relacionado:** ADRs 0001, 0010, 0011, 0014 e 0018 (novo); planejamentos 0023, 0024 (C1) e 0025 (S4)
- **Commits:** 912aaf5 (Business Center) e a semente de movimento

## Solicitação de origem

> a sala de administração do barber time já existe?

> entao vamos implementar a sala de administração do Barbertime para gerir as barbearias modulos nosso mvp ainda não preve cobrança então temos que nos preocupar com a administração de ativação de modulos, mas também pode criar cards como se fosse um dashboard sobre a barbearia movimentos, clientes, ticket medio, top 5 produtos e serviços caixa atual uma visão do mes a ideia é poder acompanhar um stauts do cliente a barbearia

> ficou boa pode avançar use o nome BarberTime Bussiness center

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente (entrevista `grill-me`)
- **Esclarecimentos:**
  - Onde fica → **App separado** (`apps/business-center`), reaproveitando `@barbertime/ui`.
  - Como os operadores entram → **Conta própria de operador**: tabela separada, criada só por script, sessão própria e curta.
  - Como o painel lê os dados → **Pela RLS, uma barbearia por vez**, em transação só de leitura e com auditoria. Nenhum papel de banco ignora a RLS.
  - Ações → **ativar e desativar módulos, suspender a barbearia e transferir o Dono**. **Sem dados pessoais de clientes:** o painel mostra só números agregados.
  - 2FA → **TOTP obrigatório já** para operadores, com sessão de 8h.
  - Cartões do painel → **conjunto proposto**:
    - mês atual contra o anterior: faturamento, atendimentos, ticket médio, clientes (total, novos e atendidos), agendamentos (marcados, faltas e cancelados);
    - top 5 serviços e top 5 produtos;
    - caixa atual;
    - faturamento por dia;
    - usuários por papel e módulos.
  - Status na lista → **saúde por atividade**:
    - **Nova:** criada há menos de 14 dias.
    - **Ativa:** teve comanda paga nos últimos 7 dias.
    - **Parada:** sem comanda paga nesse período.
    - **Suspensa.**
  - Suspender e transferir o Dono → **regras propostas**:
    - motivo obrigatório nas duas ações;
    - a barbearia suspensa não entra, as sessões caem e a página pública sai do ar;
    - a transferência vai só para um usuário vinculado e ativo, e o Dono antigo vira Gerente;
    - toda ação fica auditada.
  - Nome → "BarberTime Bussiness center", escrito no app como **BarberTime Business Center**.

## Objetivo

Dar à equipe BarberTime um painel para acompanhar a saúde de cada barbearia cliente e administrar três coisas:

- a ativação de módulos (o MVP não tem cobrança, então a confirmação é manual);
- a suspensão da barbearia;
- a transferência do Dono.

Nada disso dá acesso a dados pessoais de clientes finais.

**Fora do escopo:**

- cobrança, planos e limites;
- dados pessoais de clientes;
- relatório que compare barbearias numa consulta só;
- níveis diferentes de operador;
- tela para criar operador;
- recuperação de 2FA perdido (outro operador recria a conta pelo script).

## Decisões e restrições

- **ADR 0018:**
  - app separado;
  - identidade de operador separada da de usuário, com TOTP obrigatório;
  - leitura pela RLS, uma barbearia por vez;
  - nenhum dado pessoal de cliente;
  - auditoria.
- **App:** `apps/business-center`, com Vue 3 e Vuetify atrás dos componentes `Ds*` (skill `design-system`). Roda na porta 4300, com proxy `/api` para a 3333.
- **API:** a mesma, sob o prefixo `/api/plataforma`.
  - Cookie próprio, `bt_operador`.
  - Limites próprios, seguindo o ADR 0014: schema em todo corpo e limite por IP e por e-mail no login.
  - O cookie de usuário não vale na plataforma, e o de operador não vale nas rotas das barbearias.
- **TOTP (RFC 6238):** SHA-1, 6 dígitos, passo de 30s, tolerância de ±1 passo. Implementado com o `crypto` do Node no domínio, sem dependência nova.
  - O segredo é guardado no banco, já que a API precisa dele para verificar o código.
  - O mesmo código não é aceito duas vezes (guarda o último passo usado).
- **Leitura:**
  - **Painel:** `comBarbearia(id)` existente, em transação `read only`.
  - **Lista:** usa a função `app.resumo_barbearias()`, `security definer`, dona `postgres`, executável só pelo `barbertime_app`. Ela devolve só agregados: faturamento do mês, última comanda paga e pedidos de módulo pendentes.
- **Suspensão:** colunas `barbearias.suspensa_em` e `motivo_suspensao`. O contexto autenticado e a página pública recusam barbearia suspensa, e as sessões dela são apagadas.
- **Transferência do Dono:** o Dono antigo passa para o papel `gerente` e o alvo para `dono`, na mesma transação. O alvo precisa ter vínculo ativo na barbearia.
- **Auditoria:** tabela `app.auditoria_plataforma` com operador, ação, barbearia, motivo, `dados jsonb` e data. Só aceita inserção: sem `update` nem `delete` para o `barbertime_app`. Abrir o painel de uma barbearia também gera registro.
- **Mês:** fuso `America/Sao_Paulo`. As datas de comanda vêm de `caixas.data`.

## Etapas

- [x] 1. Planejamento (este documento) e ADR 0018.
- [x] 2. Domínio: `seloDeAtividade`, `ticketMedio`, `variacao` e `transicaoPelaPlataforma`. O TOTP ficou na API (`seguranca/totp.js`), com testes.
- [x] 3. Migração:
  - `operadores` e `sessoes_operador`;
  - `auditoria_plataforma`;
  - colunas de suspensão em `barbearias`;
  - função `resumo_barbearias()`;
  - privilégios.
- [x] 4. API: login de operador com TOTP, sessão e saída; script `api:operador`; teste de separação das identidades.
- [x] 5. API:
  - lista e painel;
  - ações de módulos, suspender e reativar, e transferir o Dono;
  - auditoria;
  - bloqueio de barbearia suspensa nas rotas existentes.
  - Testes de integração, com números conhecidos e checagem de que não há dado pessoal na resposta.
- [x] 6. App `apps/business-center`:
  - telas Entrar, Barbearias e Barbearia;
  - painel com cartões, gráfico, módulos, ações e histórico.
  - Testes das telas.
- [x] 7. `pnpm verificar:tudo`, revisão, `security-review` e fechamento (índices, README e commit).

## Critérios de pronto

- **Acesso:**
  - operador sem TOTP válido não entra;
  - usuário de barbearia não acessa `/api/plataforma`;
  - cookie de operador não abre as rotas da barbearia.
- **Painel:** os números batem com a semente do teste.
- **Suspensão:** bloqueia login, sessões e página pública, e reativar libera tudo.
- **Transferência:** deixa exatamente um Dono, e o antigo vira Gerente.
- **Auditoria:** toda ação e toda abertura de painel geram uma linha.
- **Privacidade:** nenhuma resposta da plataforma traz nome, telefone ou CPF de cliente.
- **Verificação:** `pnpm verificar:tudo` verde e revisão de segurança sem achados.

## Riscos e pendências

- **Segredo TOTP:** fica em texto no banco. Quem lê o banco gera códigos, mas ainda precisa da senha. Cifrar com uma chave de ambiente fica para a frente B da meta 0024.
- **S4 do planejamento 0025:** vai trocar a identidade dos usuários de barbearia. Operadores continuam separados, e a S4 decide se também passam pelo GoTrue.
- **Rede:** o Business Center deveria ficar atrás de uma rede restrita em produção (frente B da meta 0024).

## Registro de mudanças

- 2026-11-08: criado após a entrevista. Mini-spec aprovado pelo usuário ("ficou boa pode avançar").
- 2026-11-08: implementado.
  - **Desvio do plano:** o TOTP ficou em `apps/api/src/seguranca/totp.js`, não no domínio, porque o domínio também roda no navegador e o TOTP usa o `crypto` do Node. Os testes usam os vetores da RFC 6238.
  - **Migração `20261108140000_business_center.sql`:**
    - tabelas `operadores`, `sessoes_operador` e `auditoria_plataforma` (sem `update` nem `delete` para a aplicação);
    - colunas de suspensão em `barbearias`;
    - funções `resumo_barbearias()` e `usuario_em_barbearia_suspensa()`, as duas `security definer` e só com agregados;
    - `barbearias_do_usuario()` passa a ignorar as barbearias suspensas.
  - **API:**
    - `/api/plataforma`, com cookie `bt_operador` restrito ao caminho e `SameSite=Strict`;
    - limites `operadorPorIp` e `operadorPorEmail`;
    - o código TOTP é gasto de forma atômica;
    - barbearia suspensa barrada no contexto autenticado, no login e na página pública.
  - **Script e semente:** `api:operador` (criar e desativar). A semente cria `operador@barbertime.dev` com segredo fixo, só fora de produção.
  - **App `apps/business-center`** (porta 4300): telas Entrar, Barbearias e Barbearia.
    - O gráfico diário foi feito com CSS e tokens, sem dependência. O `DsGrafico` (ApexCharts) continua pendente no design system.
    - O app foi copiado da estrutura do `apps/barbertime`, em vez de gerado pelo Nx, para herdar o alias do design system e o lint de fronteira.
  - **`pnpm verificar:tudo` verde:**
    - domínio: 91 testes;
    - API: 18 testes unitários e 96 de integração (9 novos, com números conhecidos e checagem de que não há dado pessoal na resposta);
    - Business Center: 6 testes das telas.
- 2026-11-08: semente de movimento para desenvolvimento (`apps/api/scripts/movimento-exemplo.js`, chamada pelo `api:semear` só fora de produção).
  - Barbearia modelo: 60 dias de caixas, comandas, agendamentos com faltas e cancelamentos, 30 clientes fictícios, caixa de hoje aberto e um pedido do módulo Estoque.
  - Segunda barbearia: uma venda há 10 dias, para exercitar o selo "Parada".
  - Determinística e idempotente: só roda onde ainda não há caixa.
