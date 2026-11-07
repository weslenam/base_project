# Planejamento 0013: Backend real, administração com ACL e módulos adicionais

- **Status:** Em andamento
- **Data:** 2026-11-07
- **Solicitado por:** weslenam@gmail.com
- **Relacionado:** ADRs 0001, 0002, 0008, 0009, 0010 e 0011; planejamento 0001 (fase 0)
- **Commits:** ainda não commitado (branch `feat/backend-acl-modulos`, a partir de `feat/caixa-comanda`)

## Solicitação de origem

> ok temos mais implementações?

> eu penso em integrarmos com algum gateway de pagamento, podemos fazer assim avançar com a administração e controle de ACL dentro do tenent e acharmos uma forma de gerir gadgets ai se o tenent quiser gateway tratamos com serviço adicional

- **Quando:** 2026-11-07 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - "Gadgets" são o quê? → **Módulos adicionais por barbearia** (alguns inclusos no plano, outros pagos à parte, como o gateway).
  - Modelo de ACL? → **Papéis padrão + personalizáveis** (o dono cria papéis marcando permissões de um catálogo fechado).
  - Backend antes ou protótipo no front? → **Backend real primeiro.**
  - Qual gateway? → **Decidir depois**; o módulo fica atrás de uma interface de provedor genérica.

## Objetivo

Colocar no ar a fundação de backend que faltava (banco, migrações, login e isolamento por barbearia) e, sobre ela, a administração da barbearia: usuários, papéis e permissões, além do catálogo de módulos que a barbearia ativa. O gateway de pagamento entra como o primeiro módulo **adicional**.

**Fora do escopo desta entrega:**

- migrar as telas já existentes (agenda, clientes, caixa...) dos dados de exemplo para a API, que é a fase 2;
- integrar com um gateway de verdade;
- cobrar o SaaS e o painel do super admin;
- recuperar senha por e-mail.

## Fases

1. **Fundação do backend (esta entrega)**
   - ADRs 0009, 0010 e 0011;
   - PostgreSQL com migrações e RLS;
   - login por sessão com cookie;
   - contexto da barbearia em cada requisição;
   - catálogo de permissões e de módulos na lib `dominio`;
   - API de autenticação, cadastro da barbearia, usuários, papéis e módulos, com testes de integração.
2. **Front da administração (esta entrega)**
   - tela de entrada (login);
   - sessão no app, com o menu filtrado por permissão e por módulo;
   - telas Usuários, Papéis e Módulos.
3. **Migração das telas para a API (próxima):** clientes, serviços, produtos, equipe, agenda, caixa e comandas em tabelas com RLS; `dados/api.js` passa a chamar HTTP.
4. **Gateway (depois):** escolher o provedor, adaptador, webhooks, cobrança do módulo adicional.

## Decisões

Detalhes nos ADRs 0009 (stack), 0010 (ACL) e 0011 (módulos). Resumo:

- **Banco e migrações:** PostgreSQL 17 com o driver `pg` e migrações `node-pg-migrate` em JavaScript.
- **Isolamento por barbearia:** a cada requisição autenticada, uma transação define `app.barbearia_id`, e as políticas de RLS filtram as tabelas da barbearia. A API usa o papel `barbertime_app`, que não ignora RLS.
- **Login:** sessão opaca em cookie `HttpOnly` e `SameSite=Lax`, guardada no banco; senha com `scrypt`, nativo do Node (sem dependência compilada).
- **Usuários:**
  - um usuário pode pertencer a várias barbearias, com um papel em cada;
  - papéis padrão: Dono, Gerente, Recepção e Barbeiro;
  - o dono pode criar papéis com permissões do catálogo;
  - o papel Dono não pode ser alterado nem ficar sem ninguém.
- **Módulos:**
  - catálogo fechado no código;
  - cada um é `incluso` (no plano) ou `adicional` (serviço contratado à parte);
  - a barbearia ativa os inclusos, e os adicionais ficam como "solicitado" até a contratação ser confirmada;
  - a API recusa rotas de módulo inativo (403), e o menu esconde o que não está ativo.
- **Testes:** os de integração usam um banco `barbertime_teste` no Postgres do Docker, no target `api:integracao`. O `pnpm verificar` continua sem exigir Docker; o novo `pnpm verificar:tudo` inclui a integração.

## Etapas

- [x] 1. ADRs 0009, 0010 e 0011.
- [x] 2. `dominio`: catálogo de permissões, papéis padrão e catálogo de módulos, com testes.
- [x] 3. API: dependências, configuração, conexão, migrações, contexto de barbearia, sessão, autorização e exigência de módulo.
- [x] 4. API: rotas de autenticação, cadastro da barbearia, usuários, papéis e módulos; semente de desenvolvimento.
- [x] 5. Testes de integração: login, 401/403, isolamento entre barbearias (RLS), papéis personalizados, módulo adicional.
- [x] 6. Front: login, sessão, guarda de rotas, menu por permissão e módulo, telas Usuários, Papéis e Módulos.
- [x] 7. README, `pnpm verificar` e `pnpm verificar:tudo`.

## Critérios de pronto

- Um usuário de uma barbearia não lê nem altera dados de outra, mesmo errando a consulta (teste com RLS).
- Recepção não acessa a administração (403); o dono cria um papel personalizado e ele passa a valer.
- Ativar um módulo incluso libera suas rotas; um módulo adicional fica "solicitado" sem liberar nada.
- `pnpm verificar` e `pnpm verificar:tudo` passam.

## Registro de mudanças

- 2026-11-07: Plano criado.
- 2026-11-07: Fases 1 e 2 concluídas. Testes: 13 de integração na API, contra o Postgres real (login, 401/403, papéis personalizados, Dono protegido, RLS barrando gravação em outra barbearia, módulo adicional que só libera depois de confirmado, gateway simulado); 10 de domínio para os catálogos; 3 contratos do `DsCaixaDeSelecao`; 11 de tela (guarda de rotas, login, menu por papel, usuários, papéis, módulos). A semente de desenvolvimento entrou (`pnpm banco`). Fases 3 (migrar as telas para a API) e 4 (gateway real) continuam pendentes.
