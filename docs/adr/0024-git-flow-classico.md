# ADR 0024: Git Flow clássico como modelo de branching

- **Status:** Aceito
- **Data:** 2026-11-14
- **Relacionado:** Planejamento 0044

## Contexto

O projeto cresceu para 43 planejamentos e está prestes a ter um ambiente de staging (Railway) e, futuramente, produção. O modelo anterior (`feat/NNNN-slug` → PR → `main`) funcionou bem para desenvolvimento isolado, mas não distingue o que está em staging do que está em produção nem define um caminho explícito para hotfixes de emergência.

## Decisão

Adotar o **Git Flow clássico** (Nvie, 2010) com as seguintes branches e nomenclaturas:

### Branches permanentes

| Branch | Finalidade |
|---|---|
| `main` | Produção — somente releases e hotfixes chegam aqui |
| `develop` | Integração — base de todo desenvolvimento; dispara deploy de staging |

### Branches temporárias

| Prefixo | Uso | Base | Merge destino |
|---|---|---|---|
| `feature/NNNN-slug` | Nova funcionalidade (planejamento) | `develop` | `develop` |
| `fix/NNNN-slug` | Correção planejada em develop | `develop` | `develop` |
| `hotfix/<issue>-slug` | Correção de emergência em produção | `main` | `main` + backmerge `develop` |
| `release/x.y.z` | Preparação de versão (só bugfix e docs) | `develop` | `main` + backmerge `develop` |
| `chore/NNNN-slug` | Infra, deps, CI, sem código de produto | `develop` | `develop` |
| `docs/NNNN-slug` | Documentação pura | `develop` | `develop` |

### Regras

1. Nenhum commit direto em `main` ou `develop` — somente via PR.
2. `main` recebe somente merges de `release/*` e `hotfix/*`.
3. `hotfix/*` nasce de `main` e é mergeado em `main` **e** em `develop` (backmerge obrigatório).
4. `release/*` nasce de `develop` e é mergeado em `main` **e** em `develop`.
5. Merge commit (não squash) em todos os fluxos — mantém rastreabilidade (planejamento 0038).
6. Depois do merge: apagar branch local e remota; voltar para `develop`.
7. Branch default do repositório: `develop`.

### Pipeline CI/CD (planejamento 0044)

- **CI:** roda em todo PR aberto (qualquer branch → develop ou main)
- **Staging:** dispara no merge em `develop`
- **Produção:** disparará no merge em `main` (implementado no futuro)

## Consequências

**Positivo:**
- Caminho explícito para hotfix: nasce de `main`, não contamina `develop` em andamento.
- `develop` sempre reflete staging; `main` sempre reflete produção.
- Histórico de branches diz exatamente o que cada entrega contém.

**Negativo:**
- Mais cerimônia que trunk-based: cada entrega passa por dois merges (develop → release → main).
- O `git-guardrails` skill e o hook `confirmar-git-destrutivo.sh` precisam conhecer `main` e `develop` como branches protegidas.

**Substituído:** o modelo implícito de `feat/NNNN-slug → main` descrito no planejamento 0038 é atualizado por esta ADR. As branches existentes (`feat/`, `fix/`, `chore/`, `docs/`) mantêm seus prefixos, com `feature/` passando a ser o alias formal de `feat/` (ambos aceitos).
