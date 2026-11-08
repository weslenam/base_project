# Planejamento 0025: Migração para o Supabase local e revisão do backend

- **Status:** Rascunho, aguardando entrevista (grill-me)
- **Data:** 2026-11-08
- **Solicitado por:** Weslen
- **Relacionado:** ADRs 0001, 0002, 0006, 0009, 0010, 0011, 0013 e 0014; planejamentos 0013, 0019, 0020, 0022, 0023 e 0024
- **Commits:** ainda não commitado

## Solicitação de origem

> use outro agente para planejar uma migração total do projeto para o supabase local e revisar o backend... e estenda a revisão para verificar se estão sendo utilizado o desgin sistem em cima de quasar ou vuetify

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente (pedido repassado a um subagente).
- **Esclarecimentos:** nenhum ainda. As decisões em aberto estão na seção "Questões em aberto para a entrevista (grill-me)".
- **Divisão do pedido:** a verificação do design system (Quasar ou Vuetify) ficou com outro agente e não está neste documento. Aqui ficam o plano de migração e a revisão do backend.

## Objetivo

1. Levantar como o backend funciona hoje: banco, migrações, RLS, sessão, rotas, limites, e-mail, testes e scripts.
2. Planejar a troca da infraestrutura local (Postgres e Mailpit do `docker-compose`, sessão própria) pelo stack do Supabase CLI (`supabase start`), em fases que possam ser revertidas.
3. Revisar o backend (correção, segurança, desempenho e aderência aos ADRs), sem repetir os 10 achados do PR #3.

**Fora do escopo:** implementar qualquer fase; o Supabase hospedado (produção), que fica para a frente B do planejamento 0024; e a revisão do design system.

## Decisões e restrições

- **Fluxo obrigatório** (`.claude/rules/fluxo-de-trabalho.md`): nenhuma fase começa sem a entrevista e a aprovação deste plano. Cada fase passa por `pnpm verificar:tudo`, `/code-review` e `security-review` antes do commit.
- **Regras de negócio continuam em `@barbertime/dominio`** (CLAUDE.md, ADR 0010). A migração não pode espalhar regra por políticas SQL ou pelo front.
- **RLS por barbearia continua obrigatório** (ADRs 0001 e 0009). Muda só a forma de informar a barbearia ao banco.
- **ADR 0014 continua valendo** para toda rota que ficar na API Node: parâmetros tipados, schema e limite próprio.
- **Ainda não existe produção nem dado real** (planejamento 0024, frente B). A migração não precisa converter dados de clientes nem hashes de senha: basta recriar o banco e rodar a semente. Isso barateia muito o rollback.
- **Itens sobre o Supabase marcados com [confirmar]** vêm de conhecimento geral do Supabase CLI e precisam ser checados na versão instalada (`supabase --version`, `supabase/config.toml` gerado) antes de virar tarefa. O CLI ainda não está instalado nesta máquina.

---

## 1. Estado atual do backend

### 1.1 Banco e infraestrutura

- `docker-compose.yml` sobe `postgres:17-alpine`, `redis:7-alpine` (ainda não usado pela API) e `axllent/mailpit:v1.27` (SMTP 1025 e web 8025). O perfil `apps` sobe também a API e o front em containers.
- `docker/postgres/init.sql` cria o papel `barbertime_app` (`NOSUPERUSER NOBYPASSRLS`) e dá privilégios padrão no schema `public`. O superusuário `postgres` é dono das tabelas e só roda migrações.
- `.env.example` traz `DATABASE_URL` (app), `DATABASE_URL_MIGRACAO` (superusuário), `SMTP_URL`, `APP_URL`, `TRUST_PROXY` e `PAGINA_PUBLICA`.

### 1.2 Migrações

- `node-pg-migrate` 9, em JS, na pasta `apps/api/migracoes/` (6 arquivos, de `1762500000000_administracao.js` a `1762500000005_hierarquia-e-redefinicao-de-senha.js`). Aplicadas por `apps/api/src/infra/migrar.js`, com a tabela `pgmigrations`.
- O target `api:semear` (`apps/api/scripts/semear.js`) migra e cria a "Barbearia do Zé", um usuário por papel e uma operação de exemplo. É idempotente.

### 1.3 RLS e contexto da barbearia

- `apps/api/src/infra/banco.js:14` (`comBarbearia`): abre uma transação e roda `set_config('app.barbearia_id', $1, true)`.
- As políticas usam `barbearia_id = nullif(current_setting('app.barbearia_id', true), '')::bigint`, com `enable` e `force row level security`. Elas cobrem `papeis`, `vinculos`, `barbearia_modulos`, `servicos`, `produtos`, `barbeiros`, `clientes`, `atendimentos`, `bloqueios`, `caixas` e `comandas`.
- As tabelas globais `usuarios`, `sessoes`, `barbearias` e `redefinicoes_senha` **não têm RLS**. O papel `barbertime_app` tem `select/insert/update/delete` em todas elas.
- Duas funções `SECURITY DEFINER` (a `usuario_so_na_barbearia` foi removida na 0005). A que resta é `barbearias_do_usuario(bigint)`, usada no login e na troca de barbearia.

### 1.4 Autenticação e sessão (`apps/api/src/seguranca`)

- `sessao.js`: sessão opaca. É um token de 32 bytes no cookie `bt_sessao` (`HttpOnly`, `SameSite=Lax`, `Secure` em produção), guardado como sha256 em `sessoes`, com 30 dias renovados a cada requisição (UPDATE por request, achado conhecido).
- `senha.js`: scrypt (N=16384), comparação em tempo constante e hash falso para e-mail inexistente.
- `autenticacao.js`: o hook `onRequest` lê a sessão. `carregarContexto` busca o papel pelo vínculo (com RLS) e os módulos ativos, e monta as permissões a partir de `permissoesDoPapel(chave)` do domínio. Ele expõe os decoradores `autenticado`, `exigir`, `exigirAlguma`, `exigirModulo` e `naBarbearia`.
- `limites.js`: `@fastify/rate-limit`, com um limite global de 300/min por IP e limites por rota com chaves combinadas (IP, e-mail, slug, telefone). O armazenamento fica em memória.
- `entrada.js`: corpo de até 64 KB, parâmetros de rota tipados automaticamente e guarda de forma (profundidade, textos, listas).
- `app.js` registra `@fastify/helmet`, sem CORS.

### 1.5 Rotas (`apps/api/src/app/rotas`, sob `/api`)

| Arquivo                       | Rotas                                                                                            | Acesso                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `autenticacao.js`             | entrar, sair, eu, trocar barbearia, perfil, trocar senha e cadastro público (`POST /barbearias`) | público com limite, ou sessão                                         |
| `senha.js`                    | `POST /auth/esqueci` e `POST /auth/redefinir`                                                    | público com limite                                                    |
| `usuarios.js`, `papeis.js`    | convite, troca de papel, desativação e remoção; listagem de papéis                               | `usuarios.gerenciar` mais hierarquia (`podeAgirSobre`)                |
| `modulos.js`, `pagamentos.js` | módulos (ADR 0011) e cobrança simulada                                                           | `modulos.gerenciar` / `pagamentos.operar`                             |
| `barbearia.js`                | configurações e token público                                                                    | `barbearia.configurar`                                                |
| `cadastros.js`                | serviços, produtos e barbeiros (exclusão lógica)                                                 | logado para ler, `catalogo.gerenciar`/`equipe.gerenciar` para alterar |
| `clientes.js`                 | busca, ficha, histórico e exclusão (física)                                                      | `clientes.*`, `agenda.gerenciar` ou `caixa.operar`                    |
| `agenda.js`                   | dia, horários livres, detalhe, criar, bloquear e ações de estado                                 | `agenda.ver`/`agenda.ver_propria`/`agenda.gerenciar`                  |
| `caixa.js`                    | caixa do dia, comandas, receber, cancelar, comanda do atendimento, resumo do cliente             | `caixa.operar`/`caixa.fechar`                                         |
| `balcao.js`                   | painel do balcão, encaixe, avulso, check-in, iniciar, finalizar, desistir, no-show, pausa        | `agenda.gerenciar` ou `caixa.operar`                                  |
| `publico.js`                  | página, horários, reconhecimento por telefone e agendar                                          | sem sessão, com trava geral `PAGINA_PUBLICA`, 404 uniforme e limites  |

Serviços: `servicos/agenda.js` (agendamento, horários e conflito), `servicos/caixa.js` (caixa e comandas) e `servicos/barbearias.js` (cadastro self-service). Os módulos Fidelidade e Pacotes ainda vivem só em memória no front (`apps/barbertime/src/dados/apiHttp.js`, comentário "`base` cobre o que ainda não migrou").

### 1.6 E-mail

`infra/correio.js` usa nodemailer em `SMTP_URL` (Mailpit no dev). Só o "esqueci a senha" envia e-mail, e o envio é disparado sem `await`. Os testes injetam um correio falso (`opts.correio`).

### 1.7 Testes e scripts

- Unitários: `app.spec.js` e `seguranca/seguranca.spec.js`, rodados no `nx test`.
- Integração: `vitest.integracao.config.js` com o `globalSetup` `src/integracao/preparar.js`, que **derruba e recria o banco `barbertime_teste`** com o superusuário e aplica as migrações. Os specs são `administracao`, `balcao`, `configuracoes`, `negocio` e `seguranca`, e testam isolamento por RLS com `comoAplicacao`/`comoSuperusuario`.
- `pnpm verificar` = `nx run-many -t lint,test,build`. `pnpm verificar:tudo` = isso mais `nx run api:integracao`. `pnpm banco` = `docker compose up -d --wait postgres redis mailpit && nx run api:semear`.
- **Não há CI** (`.github/workflows` não existe; frente A do planejamento 0024).
- O front fala com a API pelo proxy do Vite (`/api` vai para `API_URL`), na mesma origem, com cookie.

---

## 2. Plano de migração para o Supabase local

### 2.1 O que o `supabase start` entrega [confirmar portas e nomes na versão instalada]

- Postgres da imagem `supabase/postgres` (porta 54322; a versão maior depende do CLI, 15 ou 17) [confirmar].
- API Gateway (Kong) em 54321, com PostgREST (`/rest/v1`), Auth/GoTrue (`/auth/v1`), Storage (`/storage/v1`) e Realtime.
- Studio em 54323.
- Captura de e-mail em 54324. As versões novas do CLI trocaram o Inbucket pelo Mailpit [confirmar].
- Papéis prontos: `anon`, `authenticated` e `service_role`. Chaves: `anon`/`service_role` (JWT) ou o formato novo `publishable`/`secret` [confirmar qual a versão gera].
- Migrações em `supabase/migrations/<timestamp>_<nome>.sql` (`supabase migration new`). `supabase db reset` recria o banco, aplica as migrações e roda a semente (`supabase/seed.sql`, ou os caminhos em `[db.seed]` no `config.toml`). `supabase test db` roda testes pgTAP em `supabase/tests/`.
- O Redis não faz parte do stack. Ele continua no `docker-compose`, se for mantido (B8 do planejamento 0024).

### 2.2 Recomendação de arquitetura

**Manter a API Node (Fastify) como a única porta de dados do app.** Do Supabase local, adotar o Postgres, as migrações SQL do CLI, o Auth (GoTrue) com a captura de e-mail e o Studio. **Não expor o PostgREST ao front** nesta migração.

| Critério                                         | API Node continua (recomendado)             | Front direto no PostgREST/supabase-js                                                            |
| ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Regras do `@barbertime/dominio`                  | Continuam no servidor, com teste de unidade | Teriam de ir para funções SQL ou triggers (duplicando o domínio) ou para o front (burlável)      |
| Fluxos de várias etapas (balcão, caixa, comanda) | Transação única, como hoje                  | Precisam de RPCs `security definer` grandes, uma por fluxo                                       |
| Hierarquia de papéis (ADR 0010)                  | `exigir` + `podeAgirSobre`, já testados     | Viraria política RLS por coluna e por papel: mais difícil de testar e de auditar                 |
| Limites e ADR 0014                               | `@fastify/rate-limit` por rota              | O PostgREST não tem limite por rota. Seria preciso gateway próprio ou Edge Function              |
| Página pública (404 uniforme, primeiro nome)     | Fica como está                              | O `anon` precisaria de RPCs muito restritas. A varredura de telefone fica mais difícil de conter |
| Velocidade de telas simples (listas)             | Uma rota por lista                          | Menos código no back para leitura                                                                |
| Tempo real (fila do balcão)                      | Precisaria de SSE ou WebSocket próprio      | Realtime pronto                                                                                  |

Leitura direta pelo PostgREST e Realtime podem entrar depois, como fase opcional (F5), só para leitura e só em tabelas com políticas testadas.

### 2.3 Banco e migrações

- `supabase init` cria `supabase/config.toml`, a pasta `supabase/migrations/` e a semente.
- **Baseline:** gerar `supabase/migrations/<ts>_baseline.sql` a partir do schema atual já migrado (`pg_dump --schema-only` do banco do compose, ou `supabase db diff` [confirmar]). Depois, limpar donos, `pgmigrations` e os blocos `do $$ ... barbertime_app` e revisar à mão. Como não há produção, as 6 migrações JS são arquivadas, e o histórico fica no git.
- **Papel da aplicação:** criar `barbertime_app` numa migração (`NOLOGIN` ou sem senha) e definir a senha fora do git, num script local ou em `ALTER ROLE ... PASSWORD` lido de variável. Isso substitui o `docker/postgres/init.sql`. A API conecta direto na 54322 com esse papel, nunca como `postgres` nem como `service_role`. Conferir se o `postgres` do Supabase tem `BYPASSRLS` e quem é dono das tabelas criadas pelo CLI [confirmar].
- **Schema exposto:** tirar as tabelas do alcance do PostgREST. Há duas formas:
  - (a) mover para um schema `app` não listado em `[api] schemas`;
  - (b) manter em `public` e revogar `anon`/`authenticated` de tudo, incluindo os privilégios padrão.

  Recomendo (a): é deny-by-default, e o `public` fica livre para RPCs públicas no futuro. Conferir os privilégios padrão que o Supabase dá a `anon`/`authenticated` em `public` [confirmar].

- **Tipos:** `bigserial`, `numeric`, `jsonb` e os checks atuais funcionam iguais. `gen_random_uuid()` já existe.

### 2.4 RLS: do `app.barbearia_id` para o contexto do JWT

- Criar a função `app.barbearia_atual()` (`stable`), que lê, nesta ordem:
  1. `current_setting('request.jwt.claims', true)::jsonb ->> 'barbearia_id'`, quando houver JWT;
  2. o `app.barbearia_id` atual, como compatibilidade durante a transição.
- Todas as políticas passam a ser `using (barbearia_id = app.barbearia_atual())`. Uma migração troca as 11 políticas de uma vez.
- **A API Node continua definindo o contexto por transação:**
  - ela valida o JWT;
  - faz `set local role barbertime_app`;
  - `set_config('request.jwt.claims', <claims validadas + barbearia escolhida>, true)`.

  Assim, as mesmas políticas servem à API e, se um dia houver acesso direto (F5), ao PostgREST.

- **Barbearia ativa:** como o usuário pode estar em várias barbearias, a barbearia **não vai como claim fixa no token**. A API recebe a barbearia escolhida (cookie ou cabeçalho `X-Barbearia`), confere em `vinculos` (como `barbearias_do_usuario` faz hoje) e só então a coloca no contexto. A alternativa é um Custom Access Token Hook que injete a barbearia ativa [confirmar a configuração `[auth.hook.custom_access_token]`], mas ele exige renovar o token a cada troca de barbearia.
- **Tabelas globais:**
  - `usuarios` passa a ser o perfil, com `auth_id uuid unique references auth.users`;
  - `sessoes` e `redefinicoes_senha` somem se o Auth for o do Supabase;
  - `barbearias` ganha RLS (leitura só da própria, pela função), e a página pública lê por uma função `security definer` restrita ao slug.
- **Testes de isolamento:** manter os specs de integração e somar pgTAP (`supabase test db`) para as políticas, incluindo um teste que prova que `anon`/`authenticated` não leem nada pelo PostgREST.

### 2.5 Autenticação: GoTrue no lugar da sessão própria

**Recomendação: usar o Supabase Auth para identidade e manter papéis e permissões nas tabelas próprias e no domínio.** Não há usuário real para migrar, então os hashes scrypt não precisam ser convertidos.

- **Login e sessão:** o access token é um JWT curto (padrão de 1h [confirmar `jwt_expiry`]) com refresh token rotativo. Isso resolve o UPDATE a cada requisição e a sessão de 30 dias (planejamento 0024, C).
  - **Ponto de atenção:** o supabase-js guarda os tokens em `localStorage` por padrão. Hoje o token está num cookie `HttpOnly`, então isso é um retrocesso contra XSS.
  - **Opção BFF (recomendada):** a API Node faz o login no GoTrue, guarda o refresh token num cookie `HttpOnly` e entrega só o necessário ao front. O front continua sem ver token, e o ADR 0009 mantém o espírito.
- **Validação do JWT na API:** pelo JWKS do GoTrue (chaves assimétricas) ou pelo segredo HS256 legado [confirmar o modo da versão]. Isso substitui o hook `onRequest` de `sessao.js`.
- **Papéis e ACL hierárquica:** não mudam. `vinculos × papeis` continua sendo a fonte, e `carregarContexto` passa a buscar pelo `auth_id`. As claims do JWT **não** levam permissões: o papel muda na hora quando o Dono rebaixa alguém, sem esperar o token expirar.
- **Esqueci a senha:** sai `rotas/senha.js`.
  - O front (ou a API, no BFF) chama `resetPasswordForEmail` com `redirectTo` para `/redefinir-senha`, e a troca é feita com `updateUser({ password })`.
  - O e-mail local cai no Mailpit/Inbucket do stack (54324).
  - O modelo do e-mail vai em pt-BR no `config.toml` (`[auth.email.template.recovery]` [confirmar]).
  - Os limites ficam em `[auth.rate_limit]` [confirmar], mas o limite por e-mail do ADR 0014 precisa ser revisto com ele.
  - Conferir se o endpoint `/recover` responde igual para e-mail existente e inexistente, inclusive no tempo [confirmar].
- **Trocar a própria senha:** `updateUser`, com `secure_password_change` [confirmar]. Para derrubar as outras sessões, `signOut({ scope: 'others' })`.
- **Convite de usuário:** em vez de o Dono definir a senha inicial, usar `auth.admin.inviteUserByEmail` a partir da API, com a `service_role`/secret só no servidor. Isso resolve o achado N1 da revisão.
- **Cadastro self-service:** `signUp` com confirmação de e-mail, mais a criação da barbearia na API depois da confirmação. Ver se o GoTrue esconde e-mail já cadastrado [confirmar].
- **Ganhos de brinde:** MFA TOTP pronto (C1 do planejamento 0024) e OAuth (Google) no futuro.

**Se o Weslen preferir manter a autenticação própria**, a migração se limita a banco, migrações e e-mail (F1, F2 e F6), e as seções 2.4 e 2.5 encolhem para "trocar `app.barbearia_id` pela função `app.barbearia_atual()`".

### 2.6 Storage

Não há upload hoje (o grafo e a busca por `FormData`/`multipart` não acharam nada). Quando houver logo da barbearia ou foto, um bucket do Storage com políticas por `barbearia_id` no caminho. Fora do escopo; entra como nota no ADR.

### 2.7 Página pública

Continua na API Node, com a trava `PAGINA_PUBLICA`, o 404 uniforme, os limites por IP, slug e telefone e a resposta mínima (ADR 0013). A `anon key` **não** é usada para ler tabela direto. Se a F5 acontecer, a página pública só usaria RPCs `security definer` e limites num gateway, o que hoje não compensa.

### 2.8 Semente

`supabase/seed.sql`, ou um script Node chamado depois do `supabase db reset`. Os usuários do seed precisam ser criados no `auth.users`:

- pela Admin API num script Node (recomendado: usa a mesma regra do convite);
- ou por SQL direto em `auth.users`/`auth.identities`, que é frágil entre versões [confirmar].

`api:semear` vira `supabase db reset && node scripts/semear.js`.

### 2.9 Testes

- **Integração:** o `preparar.js` hoje recria um banco com `drop database`. No Supabase, há duas opções:
  - (a) `supabase db reset` antes da suíte, no mesmo banco local, mais simples, porém apaga os dados de dev;
  - (b) criar `barbertime_teste` com o papel `postgres` e aplicar `supabase migration up --db-url` [confirmar a flag].

  Recomendo (b) para não perder os dados de desenvolvimento.

- **Auth nos testes:** criar usuários pela Admin API e logar pelo GoTrue local. O correio falso dá lugar à API HTTP do Mailpit (`/api/v1/messages`) [confirmar], ou o teste lê o link pela Admin API (`generateLink` [confirmar]).
- **pgTAP** para as políticas e um teste de que `anon` não lê nada.

### 2.10 CI

Ainda não existe. A frente A do planejamento 0024 deve nascer já com o Supabase:

- `supabase/setup-cli` no GitHub Actions;
- `supabase start` com os serviços dispensáveis desligados (`-x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,studio` [confirmar nomes]);
- `supabase db reset`;
- `pnpm verificar:tudo`.

O tempo de subida no CI é maior que o de um Postgres de serviço. Isso é aceitável, mas precisa ser medido.

### 2.11 Docker e scripts

- O `docker-compose.yml` perde `postgres` e `mailpit`, fica com o `redis` e com o perfil `apps`.
  - A API em container passa a apontar para o host (`host.docker.internal:54322`) ou para a rede do Supabase (`supabase_network_<projeto>` [confirmar]).
- `docker/postgres/init.sql` sai.
- `pnpm banco` vira `supabase start && supabase db reset && nx run api:semear`.
- Nx: targets `supabase:start`, `supabase:reset` e `supabase:test`, por `nx:run-commands`, para seguir a regra de rodar tudo pelo Nx.
- Atualizar o ADR 0002 (WSL 2 + Docker continuam: o CLI usa o Docker).

### 2.12 Variáveis de ambiente

| Sai                                       | Entra                                                                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_*`, `APP_DB_PASSWORD` (compose) | `APP_DB_PASSWORD` continua (senha do `barbertime_app` no Supabase)                                                                                                                |
| `DATABASE_URL_MIGRACAO`                   | (o CLI aplica as migrações)                                                                                                                                                       |
| `DATABASE_URL` (5432)                     | `DATABASE_URL=postgres://barbertime_app:...@127.0.0.1:54322/postgres`                                                                                                             |
| `SMTP_URL`, `MAILPIT_*`                   | (o e-mail de Auth sai pelo GoTrue; outro e-mail, como lembretes, usa o SMTP do Mailpit do stack [confirmar porta])                                                                |
| —                                         | `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_ANON_KEY` (ou publishable), `SUPABASE_SERVICE_ROLE_KEY` (ou secret, **só na API**), `SUPABASE_JWKS_URL` ou `SUPABASE_JWT_SECRET` |
| —                                         | Só se o front usar o supabase-js: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`                                                                                                   |

`APP_URL`, `TRUST_PROXY` e `PAGINA_PUBLICA` continuam. Na partida em produção, a API deve recusar a `service_role` em variável `VITE_*` e senhas padrão (B5 do planejamento 0024).

### 2.13 Fases

Cada fase tem o próprio commit e passa por verificar, revisar e segurança.

- [ ] **F0. Entrevista e ADRs.** Rodar a skill `grill-me` com as questões abaixo, registrar as respostas em _Esclarecimentos_, escrever os ADRs (seção 2.15) e mudar o status para Aprovado.
  - _Pronto:_ decisões registradas.
  - _Rollback:_ n/a.
- [ ] **F1. Stack local e baseline.**
  - Instalar o CLI, `supabase init`, ajustar o `config.toml` (portas, `[api] schemas`, serviços desligados).
  - Escrever a migração baseline, o papel `barbertime_app` e a semente.
  - A API continua com a sessão própria e o `app.barbearia_id`, apontando para a 54322.
  - O `preparar.js` passa a usar o Supabase.
  - _Pronto:_ `pnpm verificar:tudo` verde contra o Supabase local; login, balcão e caixa funcionando no navegador; o Studio mostra as tabelas.
  - _Rollback:_ o `docker-compose` com o Postgres continua no repositório até a F6; basta voltar o `.env`.
- [ ] **F2. Isolamento endurecido.**
  - Schema `app` (ou revogação em `public`), função `app.barbearia_atual()` e políticas reescritas.
  - RLS em `barbearias`, e revogar o acesso do `barbertime_app` a tabelas de que ele não precisa.
  - pgTAP de isolamento e de "anon não lê nada".
  - Corrigir junto os achados N3 e N4, que tocam schema e validação.
  - _Pronto:_ pgTAP e integração verdes; `curl` com a anon key em `/rest/v1/<tabela>` devolve 404 ou vazio.
  - _Rollback:_ reverter a migração (dev: `supabase db reset` no commit anterior).
- [ ] **F3. Autenticação pelo GoTrue** (se aprovada).
  - `usuarios.auth_id`, validação do JWT na API, BFF com cookie `HttpOnly`, convite por e-mail, esqueci e redefinir pelo GoTrue, modelos de e-mail em pt-BR e semente pela Admin API.
  - Saem `sessao.js`, `senha.js`, `rotas/senha.js` e as tabelas `sessoes` e `redefinicoes_senha`.
  - O front troca as telas de login, esqueci e redefinir só na camada de dados (`dados/http.js`, `apiHttp.js`); as telas Ds\* não mudam.
  - _Pronto:_ os specs de `seguranca` e `administracao` reescritos e verdes; o e-mail de recuperação chega no Mailpit local; trocar a senha derruba as outras sessões; rebaixar um papel vale na requisição seguinte.
  - _Rollback:_ manter a sessão própria atrás de uma flag (`AUTH=propria|supabase`) até a F6.
- [ ] **F4. Fidelidade e Pacotes no banco** (hoje em memória no front), já no modelo novo. Pode ir para um planejamento próprio (0015/0019 parte 3).
- [ ] **F5 (opcional, depende da entrevista).** Leitura direta pelo supabase-js e Realtime na fila do balcão.
  - Só leitura, com políticas próprias para `authenticated` e testes pgTAP.
  - Escrita continua na API.
- [ ] **F6. Limpeza.**
  - Remover o `postgres`/`mailpit` do compose, o `docker/postgres/init.sql`, o `node-pg-migrate`, `apps/api/migracoes/`, `infra/migrar.js` e `infra/correio.js` (se não houver outro e-mail) e a flag de auth.
  - Atualizar o README, os ADRs e a skill de segurança.
  - _Pronto:_ `pnpm verificar:tudo` verde só com `supabase start`.
  - _Rollback:_ `git revert`.

### 2.14 Riscos

- **Exposição acidental pelo PostgREST:** toda tabela em `public` fica acessível pela anon key se faltarem RLS ou o revoke. Hoje quatro tabelas globais não têm RLS (`usuarios`, `sessoes`, `barbearias`, `redefinicoes_senha`). _Mitigação:_ schema não exposto (F2) e teste automatizado com a anon key.
- **`service_role` vazada para o front:** ela ignora o RLS. _Mitigação:_ só na API, e a partida recusa `VITE_*SERVICE*`.
- **Token em `localStorage`** (supabase-js padrão), contra o cookie `HttpOnly` de hoje. _Mitigação:_ BFF.
- **Lock-in e versão do CLI:** portas, nomes de chaves e o Inbucket trocado pelo Mailpit mudam entre versões. _Mitigação:_ fixar a versão do CLI no `package.json` (`supabase` como devDependency [confirmar o pacote npm]) e anotar a versão no ADR.
- **Peso do stack no WSL 2:** muitos containers. _Mitigação:_ desligar Realtime, Storage, Edge e Analytics no `config.toml` enquanto não forem usados.
- **Divergência local e hospedado:** o Supabase hospedado tem papéis e limites diferentes. _Mitigação:_ o ADR de produção (0024 B1) decide se a produção também será Supabase.
- **Limite por e-mail do ADR 0014 duplicado ou contraditório com o do GoTrue.** _Mitigação:_ revisar o ADR 0014 na F3.

### 2.15 ADRs novos ou a substituir

- **ADR 0015 (novo):** "Supabase local como plataforma de banco, migrações e e-mail". Substitui partes do 0002 (serviços do compose) e do 0009 (`node-pg-migrate`, papel criado por `init.sql`).
- **ADR 0016 (novo, se a F3 for aprovada):** "Identidade pelo Supabase Auth com BFF na API". Substitui as seções "Sessão opaca" e "Senhas com scrypt" do 0009 e o item "Recuperação de senha" do 0014.
- **ADR 0001 e 0009 (revisar):** o contexto da barbearia passa a vir de `app.barbearia_atual()` (claims do JWT, com o GUC como compatibilidade).
- **ADR 0010 (revisar):** o convite passa a ser por e-mail; some a senha inicial definida por quem convida.
- **ADR 0014 (revisar):** limites de Auth no GoTrue mais os da API; CORS continua fechado (o BFF mantém a mesma origem).
- **ADR 0006:** continua, mas **não está implementado** (não há `usePreferencias` nem `/api/preferencias` no código). A tabela de preferências já nasceria no schema novo.
- **ADR 0013:** sem mudança de decisão; registrar que a página pública não usa a anon key.

---

## 3. Revisão do backend

Escopo: `apps/api/src`, `apps/api/migracoes` e as funções do domínio que a API chama. Ficaram de fora os 10 achados já conhecidos do PR #3. Severidade: **Alta** quebra isolamento ou dá acesso indevido; **Média** corrompe dados ou contraria um ADR; **Baixa** é robustez ou higiene.

### Achados novos

**N1. Alta. Senha inicial definida por quem convida dá acesso a outras barbearias.** `apps/api/src/app/rotas/usuarios.js:52-100`

- **Problema:** o convite cria a conta global com a senha escolhida pelo Dono ou Gerente (`gerarHashDeSenha(senha)` na linha 82). Se o e-mail já existir, a mesma rota apenas vincula a conta (linhas 72-95). A conta é global e pode estar em várias barbearias.
- **Cenário:**
  1. O Dono da barbearia A convida `ana@x.com` com a senha `P`.
  2. Meses depois, a barbearia B convida a mesma Ana, que é vinculada sem senha nova.
  3. Se Ana nunca trocou `P`, o Dono de A entra como Ana com `barbeariaId` = B (`autenticacao.js:90-91`) e opera B com o papel dela.
- **ADR:** contraria o espírito do ADR 0010 revisado ("senha é só da própria pessoa").
- **Correção:** convite por link de uso único, que é o mesmo mecanismo do esqueci e o `inviteUserByEmail` na F3.

**N2. Média. Enumeração de contas, e qualquer um pode se colar na conta de outra pessoa.** `apps/api/src/app/rotas/usuarios.js:72-95` e `apps/api/src/servicos/barbearias.js:38-46`

- **Problema:** qualquer pessoa pode virar Dono pelo cadastro público.
- **Cenário:**
  1. A pessoa cria uma barbearia.
  2. Chama `POST /api/usuarios` com `{ email, papelId: <barbeiro> }` e sem senha. A resposta 201 indica conta existente; o 400 "A senha precisa ter..." indica que não existe.
  3. A rota não tem limite próprio (ADR 0014 pede limite em rota que trata credenciais).
- **Efeito colateral:** a vítima passa a ter a barbearia do atacante na lista. Como `barbearias_do_usuario` ordena por nome e o login abre a primeira (`autenticacao.js:91`), uma barbearia chamada "AAA" vira a barbearia padrão da vítima no próximo login.
- **Outro vetor:** o cadastro também revela a conta ("Já existe uma conta com este e-mail"), limitado a 5 por hora por IP.
- **Correção:** o convite exige aceite (link), a resposta é igual nos dois casos e a rota ganha limite próprio.

**N3. Média. Data e hora sem validação de formato viram 500 ou dado corrompido.**

- **Arquivos:**
  - `apps/api/src/servicos/agenda.js:165-172` (`criarAgendamento`);
  - `apps/api/src/app/rotas/agenda.js:53`, `:85-90` e `:168-174`;
  - `libs/dominio/src/agenda.js:20` (`paraMinutos` devolve `NaN`).
- **Data inválida vira 500:** `POST /api/agendamentos` com `data: "2026-13-45"` passa por `data < agora().data` (comparação de texto) e estoura no Postgres com 500. `GET /api/agendamentos?data=abc` e `/horarios?data=abc` também dão 500. O ADR 0014 diz "entrada malformada recebe 400, não 500".
- **Hora inválida grava lixo:** `inicio: "0a:00"` dá `paraMinutos` = `NaN`. As comparações com `NaN` são todas falsas, então o expediente e o conflito passam (`validarHorario`, linhas 122-133). O `fim` vira `"NaN:NaN"`, e o check de texto `inicio < fim` aceita (`'0' < 'N'`). Resultado: um agendamento com horário lixo, que nunca conflita e quebra a ordenação da agenda.
- **No bloqueio:** `inicio: "9:00"` com `fim: "10:00"` passa no `paraMinutos` e cai no check de texto com 500.
- **Na página pública:** aceita horário fora da grade (ex.: `"08:1"`), porque `validarJanela` compara texto (`publico.js:192-194`).
- **Correção:** regex `HORA`/`DATA` no schema (`pattern`) ou no domínio, e recusar `NaN` em `paraMinutos`.

**N4. Média. Excluir um cliente apaga o histórico de atendimentos pagos.** `apps/api/src/app/rotas/clientes.js:150` com `apps/api/migracoes/1762500000003_negocio-agenda.js:68`

- **Problema:** a exclusão é física, e `atendimentos.cliente_id` tem `on delete cascade`. As comandas ficam com `cliente_id` e `atendimento_id` nulos (`set null`).
- **Cenário:**
  1. A Gerente exclui um cliente com 20 atendimentos `pago`.
  2. Os 20 somem: a agenda passada e as contagens do barbeiro mudam, e o vínculo comanda-atendimento se perde.
- **ADR:** o próprio `cadastros.js` usa exclusão lógica justamente para preservar o histórico.
- **Correção:** exclusão lógica ou anonimização (LGPD), e `on delete restrict`.

**N5. Média. Comanda de dia anterior é recebida no caixa errado, e o caixa antigo nunca fecha.** `apps/api/src/servicos/caixa.js:213-221` e `:174-190`

- **Problema:** `receberComanda` e `salvarComanda` (edição) exigem o caixa **de hoje** aberto, mas não conferem `cm.caixaId === caixa.id`.
- **Cenário:**
  1. O caixa do dia D não foi fechado e ficou uma comanda aberta.
  2. No dia D+1, o operador abre o caixa e recebe essa comanda.
  3. Ela vira `paga` com `caixa_id` = D. O dinheiro não entra no `dinheiroEsperado` de D+1, e o fechamento acusa sobra.
  4. O caixa D fica `aberto` para sempre, porque `fecharCaixa` só enxerga o de hoje (`caixaDoDia`).
- **Correção:** recusar comanda de outro caixa, ou movê-la para o caixa atual, e ter um fluxo para fechar o caixa pendente.

**N6. Média. Comanda paga de agendamento confirmado deixa o atendimento em `agendado`.** `apps/api/src/app/rotas/caixa.js:95-114` com `apps/api/src/servicos/caixa.js:223-230`

- **Problema:** a rota permite abrir comanda de agendamento `agendado` confirmado. `receberComanda` só promove para `pago` os atendimentos em `chegou/na_fila/em_atendimento/finalizado`.
- **Cenário:** cliente confirmado paga antes do horário. A comanda fica `paga` e o atendimento continua `agendado`. Ele ocupa o horário, aparece em "atrasados" no balcão e pode ser marcado "faltou" (`agenda.js` `ACOES.faltou`). O cliente fica com pagamento e falta ao mesmo tempo.
- **Diferença do achado conhecido:** este não é o caso "cancelar de chegou".
- **Correção:** receber promove também de `agendado`, ou a comanda só abre a partir de `chegou`.

**N7. Média. Transições sem trava permitem estados contraditórios.**

- **Arquivos:**
  - `apps/api/src/app/rotas/balcao.js:245-252` (`transitar`);
  - `apps/api/src/servicos/caixa.js:213-243` (receber e cancelar);
  - `apps/api/src/app/rotas/agenda.js:216-238`.
- **Problema:** todas leem o estado e depois fazem `update ... where id = $1`, sem `for update` nem `and estado = <lido>`.
- **Cenário:** dois operadores no balcão, um clica "Receber" e o outro "Cancelar" na mesma comanda ao mesmo tempo. Os dois leem `aberta` e os dois gravam. Pode terminar com a comanda `cancelada` e o atendimento `pago`. O mesmo vale para "desistiu" contra "iniciar".
- **Correção:** `select ... for update` no atendimento e na comanda, ou um `update` condicional que confira `rowCount`.

**N8. Média. Iniciar um agendamento com outro barbeiro não confere a agenda dele.** `apps/api/src/app/rotas/balcao.js:271-319`

- **Problema:** para `origem = 'agendamento'`, o `barbeiroId` do corpo troca o barbeiro do atendimento. O código só confere se ele está em pausa ou atendendo agora; a checagem de "atropelar" (linhas 284-313) só roda para avulso.
- **Cenário:** o agendamento das 10:00 com João é iniciado com Pedro, que tem outro agendado às 10:15. A agenda de Pedro passa a ter dois atendimentos sobrepostos, sem aviso.
- **Correção:** aplicar a mesma checagem de reservados, ou `validarHorario`, para qualquer origem.

**N9. Média. Barbeiro convidado pela tela nunca vê a própria agenda.**

- **Arquivos:** `apps/api/src/app/rotas/cadastros.js:207-240` e `usuarios.js` (nenhuma rota grava `barbeiros.usuario_id`).
- **Problema:** `agenda.ver_propria` filtra por `b.usuario_id = <eu>` (`agenda.js:59`), mas só a semente (`scripts/semear.js:98`) liga barbeiro e usuário.
- **Cenário:** o Dono convida um usuário com papel Barbeiro. Ele entra e vê a agenda vazia para sempre.
- **ADR:** o ADR 0010 promete "Barbeiro: só a própria agenda".
- **Correção:** campo "conta do barbeiro" na equipe, validado contra `vinculos` da mesma barbearia.

**N10. Baixa. Barbeiro lê bloqueios de outros barbeiros.** `apps/api/src/app/rotas/agenda.js:113`

`GET /api/agendamentos/-<id>` devolve o bloqueio antes da checagem `soOsProprios` (linhas 115-122). O motivo pode ser algo como "consulta médica", e um barbeiro lê o bloqueio de qualquer colega iterando ids negativos.

**N11. Baixa. Barbeiro do item da comanda não é validado.** `apps/api/src/servicos/caixa.js:143`

`barbeiroId: i.barbeiroId ?? ...` grava no JSON da comanda qualquer número, até de barbeiro de outra barbearia ou inexistente. A comanda é a "base da comissão futura" (comentário da linha 120): quando as comissões forem calculadas, o valor vai para um barbeiro arbitrário. O achado conhecido sobre `normalizarItens` cobre preço, `NaN` e excluídos, não o barbeiro do item.

**N12. Baixa. Corridas de unicidade viram 500 em vez de 409.**

- **Arquivos:**
  - `apps/api/src/app/rotas/clientes.js:89-131` (telefone);
  - `servicos/agenda.js:137-152` (`clientePorTelefone`, chamado por balcão e público);
  - `rotas/barbearia.js:58-70` (slug);
  - `servicos/barbearias.js:33-53` (slug e e-mail).
- **Problema:** todas checam com `select` e depois inserem.
- **Cenário:** dois agendamentos públicos simultâneos do mesmo telefone novo. Um deles leva 500 em vez de reaproveitar o cliente.
- **Correção:** `insert ... on conflict do nothing returning`, ou traduzir o `23505` para 409 no `setErrorHandler`.

**N13. Baixa. Tabelas globais sem RLS e com privilégio total para o papel da aplicação.** `apps/api/migracoes/1762500000000_administracao.js:88-95` e `1762500000005_hierarquia-e-redefinicao-de-senha.js:75`

`barbertime_app` pode ler e alterar `usuarios`, `sessoes`, `barbearias` e `redefinicoes_senha` de todas as barbearias. Hoje não há injeção (SQL parametrizado), mas é uma única camada de defesa. Uma consulta de tenant com `join usuarios` mal escrita vaza contas de outras barbearias. **Com o Supabase, isso vira risco alto se essas tabelas ficarem em `public`** (ver 2.14).

**N14. Baixa. Conexão quebrada volta ao pool.** `apps/api/src/infra/banco.js:24-28` e `:40-44`

Se o `rollback` falhar (conexão caída), a exceção do rollback substitui o erro original e o cliente é devolvido ao pool com `release()` sem argumento. A próxima requisição pode pegar uma conexão inválida. **Correção:** `release(erro)` quando o rollback falhar e preservar o erro original.

**N15. Baixa (desempenho). Comandas do cliente paginadas em memória.** `apps/api/src/app/rotas/caixa.js:129-171`

`/clientes/:id/comandas` carrega todas as comandas do cliente e depois faz `slice`. `/clientes/:id/resumo` também carrega todas. Um cliente antigo com milhares de comandas pesa em toda abertura da ficha. **Correção:** `limit/offset` e `count(*)` no SQL, e o resumo agregado no SQL.

**N16. Baixa (aderência). ADR 0006 sem implementação.** Não existe `/api/preferencias`, catálogo no backend nem `usePreferencias` no front (a busca não acha nada). A regra `.claude/rules/central-de-preferencias.md` descreve algo que ainda não existe. Registrar no ADR 0006 como "aceito, não implementado" ou planejar.

### Pontos verificados sem achado

- SQL todo parametrizado. As interpolações em `balcao.js:312,318` usam só valores gerados pelo servidor, mas valem trocar por parâmetros por higiene.
- Chaves estrangeiras entre tenants: as FKs não são compostas, e a checagem de FK ignora o RLS. Mesmo assim, toda rota valida o id do barbeiro, serviço ou cliente por `select` com RLS antes de gravar. A exceção é a do achado conhecido sobre `atendimentoId` em `salvarComanda`, mais o N11.
- Hierarquia (`podeAgirSobre`) aplicada no papel atual e no papel novo; ninguém altera o próprio acesso.
- Login em tempo constante, token de redefinição de uso único e atômico, cookie com flags corretas e helmet ativo.

### O que a migração resolve ou torna irrelevante

| Achado                                              | Efeito da migração                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Conhecido: UPDATE de sessão a cada request          | **Resolvido** na F3 (JWT curto, sem tabela `sessoes`)                                                                  |
| Conhecido: timing em `/auth/esqueci`                | **Irrelevante** na F3 (passa ao GoTrue). Conferir o comportamento do `/recover` [confirmar]                            |
| N1 senha inicial definida por quem convida          | **Resolvido** na F3 (`inviteUserByEmail`)                                                                              |
| N2 enumeração e vínculo sem aceite                  | **Parcial:** o convite por e-mail ajuda, mas a resposta igual e o limite continuam sendo trabalho da API               |
| N13 tabelas globais sem RLS                         | **Obrigatório resolver** na F2. A migração aumenta o risco se não for tratado                                          |
| N14 conexão ao pool                                 | Continua (a API segue com `pg`)                                                                                        |
| Conhecido: hook de security-review contornável      | Sem relação                                                                                                            |
| Demais (conhecidos 1-4, 7, 8, 10; N3-N12, N15, N16) | **Não mudam:** são regras de negócio e validação que continuam na API Node. Devem ser corrigidos antes ou durante a F1 |

---

## Questões em aberto para a entrevista (grill-me)

1. **O que é "total"?** Só a infraestrutura (banco, migrações, e-mail) ou também o Auth? E o front passa a falar com o Supabase (supabase-js, PostgREST, Realtime)?
2. **A API Node continua?** A recomendação é sim, como a única porta de escrita e de regras. Aceita que o PostgREST fique fechado ao front nesta migração?
3. **Auth do Supabase (GoTrue) ou a própria?** Se for o GoTrue, aceita o BFF (a API guarda o refresh token em cookie `HttpOnly`) em vez de tokens no `localStorage`?
4. **O destino de produção é o Supabase hospedado?** Isso muda o peso do lock-in e decide o ADR de hospedagem (0024 B1).
5. **Schema:** mover as tabelas para um schema `app`, não exposto, ou manter em `public` com revogação?
6. **Barbearia ativa:** cabeçalho ou cookie validado pela API (recomendado) ou claim no JWT via hook (exige renovar o token ao trocar de barbearia)?
7. **Convite de usuário:** pode virar convite por e-mail com link, acabando com a senha inicial definida pelo Dono (N1)? O usuário convidado precisa aceitar antes de ser vinculado (N2)?
8. **Testes de integração:** banco separado (`barbertime_teste`) ou `supabase db reset` no banco de dev?
9. **CI:** nasce já com `supabase start` (mais lento) ou com Postgres de serviço mais as migrações SQL?
10. **Redis:** continua no `docker-compose` para o limite distribuído (0024 B8) ou fica para depois?
11. **Ordem:** corrigir os achados da revisão (conhecidos e N1-N16) antes da F1, ou junto de cada fase?
12. **Exclusão de cliente (N4):** exclusão lógica ou anonimização (LGPD)? Isso decide o `on delete` no schema novo.
13. **Fidelidade e Pacotes (F4):** entram nesta migração ou num planejamento próprio?
14. **Realtime na fila do balcão (F5):** interessa agora?

## Critérios de pronto (do plano inteiro)

- `supabase start` e `pnpm banco` sobem tudo. `pnpm verificar:tudo` fica verde sem o Postgres do compose.
- Testes de isolamento (integração e pgTAP) verdes, incluindo "anon não lê nada".
- Login, esqueci a senha (e-mail visível no Mailpit/Inbucket local), convite, troca de barbearia, balcão, caixa e página pública funcionando no navegador.
- ADRs 0015 e 0016 aceitos; 0001, 0009, 0010 e 0014 revisados; índices atualizados.

## Riscos e pendências

- Ver a seção 2.14.
- Todos os itens [confirmar] precisam de checagem com o CLI instalado antes da F1 (responsável: quem executar a F1).
- A revisão não cobriu o front nem o design system (feito por outro agente).

## Registro de mudanças

- 2026-11-08: rascunho criado pelo subagente, com o levantamento, o plano em fases, a revisão do backend (N1-N16) e as questões para a entrevista.
