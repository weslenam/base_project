# ADR 0009: Stack do backend: PostgreSQL, migrações, sessão e contexto da barbearia

- **Status:** Aceito
- **Data:** 2026-11-07
- **Relacionado:** ADRs 0001 (multi-tenant), 0002 (Docker) e 0008 (Fastify); planejamento 0013

## Contexto

Até aqui as telas usavam dados de exemplo em memória. Faltava decidir o acesso ao banco, as migrações, o login e como cada requisição carrega a barbearia, para que o RLS do ADR 0001 funcione de verdade.

## Decisão

- **Driver `pg`, com SQL escrito à mão e sem ORM.** O isolamento depende de RLS e de `set_config` por transação, que são mais simples de controlar com SQL direto. Em JS puro, um ORM traria pouco ganho.
- **Migrações com `node-pg-migrate`, em JavaScript** (`apps/api/migracoes/`), executadas com o superusuário (`DATABASE_URL_MIGRACAO`). A API conecta como `barbertime_app`, sem BYPASSRLS.
- **Contexto da barbearia:** toda requisição autenticada roda dentro de uma transação que executa `select set_config('app.barbearia_id', $1, true)`. As políticas usam `current_setting('app.barbearia_id', true)::bigint`.
- **Sessão opaca:**
  - cookie `bt_sessao`, `HttpOnly`, `SameSite=Lax`, `Secure` em produção;
  - id aleatório de 32 bytes, guardado como hash SHA-256 na tabela `sessoes`;
  - validade de 30 dias, renovada com o uso.
- **Senhas com `crypto.scrypt`** (N=16384, r=8, p=1), com sal de 16 bytes e comparação em tempo constante. Nada nativo para compilar.
- **Tabelas globais** (`usuarios`, `sessoes`, `barbearias`) ficam fora do RLS e são acessadas só pelas rotas de autenticação e cadastro. As tabelas da barbearia têm `barbearia_id` e RLS habilitado e forçado.

## Consequências

- Toda tabela nova da barbearia precisa de `barbearia_id`, de RLS e de um teste de isolamento.
- Os testes de integração precisam do Postgres (Docker), por isso ficam num target separado.
- Trocar a sessão por token (ex.: app móvel) seria uma decisão nova; o formato atual serve ao navegador.
