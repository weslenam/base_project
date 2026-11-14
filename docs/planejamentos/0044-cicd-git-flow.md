# Planejamento 0044: CI/CD com GitHub Actions e Git Flow

- **Status:** Em andamento
- **Data:** 2026-11-14
- **Solicitado por:** weslenam
- **Relacionado:** ADR 0024
- **Commits:** ainda não commitado

## Solicitação de origem

> crie um agente de devops e vamos preparar para implementar o sistema como pipeline ci e cd

- **Quando:** 2026-11-14 · **Origem:** Conversa com o assistente
- **Esclarecimentos:**
  - Onde o pipeline vai rodar? → GitHub Actions
  - Alvo de deploy? → API, app barbertime, business-center e migrations
  - Qual ambiente primeiro? → Só staging (preview)
  - Escopo do agente? → DevOps amplo (CI/CD + infra + secrets + monitoring)
  - Onde hospedar staging? → Railway
  - Banco de dados no staging? → Um banco por ambiente (Postgres fixo no Railway)

### Solicitações relacionadas

> conseguimos de alguma forma usar o grafana para acomparnhar e monitorar? também quero trabalhar com o git flow para poder controlar hotfix feat e etc penso em fazer uma adr pra isso, tem a necessidade ou essa esteira esta bem definida atualmente (2026-11-14)

> qual é a boa pratica com relação as nomenclaturas? (2026-11-14)

> vamos adotar essa então (2026-11-14) — aprovação da nomenclatura Git Flow com os prefixos feature/, fix/, hotfix/, release/, chore/, docs/ e sufixo NNNN-slug

## Objetivo

Montar pipeline CI/CD no GitHub Actions para o Nx monorepo, com deploy automático em staging (Railway) a cada merge em `develop`. Adotar Git Flow clássico como modelo de branching (ADR 0024). Criar agente DevOps especializado para manutenção contínua da infra.

**Fora do escopo:** produção/main CD, Grafana/monitoring (planejamento futuro), infra como código.

## Decisões e restrições

| Decisão | Motivo |
|---|---|
| GitHub Actions | Nativo no GitHub, sem infra adicional |
| ghcr.io como registry | Gratuito, integrado ao GitHub |
| Railway para staging | DX simples, Postgres gerenciado incluso |
| Um Postgres por ambiente | Mais simples; PRs compartilham banco de staging |
| Git Flow clássico | Controle explícito de release e hotfix (ADR 0024) |
| Node 22 nativo para TS | API roda `.ts` direto; sem etapa de compilação separada |
| Nx affected no CI | Roda só o que mudou; reduz tempo de CI em ~60% |

## Etapas

- [x] 1. Criar planejamento `0044` em `docs/planejamentos/`
- [x] 2. Criar ADR 0024 — Git Flow clássico
- [x] 3. Criar agente `.claude/agents/devops.md`
- [x] 4. Atualizar `.claude/rules/fluxo-de-trabalho.md` com nomenclatura Git Flow
- [ ] 5. `apps/api/Dockerfile` — multi-stage, Node 22, sem devDeps
- [ ] 6. `apps/barbertime/Dockerfile` — Vite build + nginx
- [ ] 7. `apps/business-center/Dockerfile` — Vite build + nginx
- [ ] 8. `.github/workflows/ci.yml` — Nx affected lint + testes em PRs para develop
- [ ] 9. `.github/workflows/staging.yml` — build + push ghcr.io + deploy Railway
- [ ] 10. `scripts/deploy-staging.sh` — usado pelo workflow de staging
- [ ] 11. Atualizar índices (planejamentos/README.md, adr/README.md)
- [ ] 12. Criar branch `develop` e ajustar branch default no GitHub (manual)

## Critérios de pronto

- PR → develop → CI verde com lint + testes em ~5 min (Nx affected)
- Merge em develop → API + frontends no Railway staging em ~10 min
- Migrations rodam antes do restart da API
- Agente devops.md funcional (consegue criar/editar workflows)
- Branch `develop` criada e definida como default no GitHub

## Riscos e pendências

- Railway CLI precisa de token nos secrets do GitHub (`RAILWAY_TOKEN`)
- O Registry ghcr.io precisa de `GITHUB_TOKEN` (já disponível nos Actions)
- Branch `develop` precisa ser criada manualmente e definida como default no GitHub (ação externa)

## Registro de mudanças

- 2026-11-14 — Planejamento criado. Mini-spec aprovado pelo usuário antes da implementação.
