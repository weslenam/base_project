# Secrets necessários

Configure em **GitHub → Settings → Secrets and variables → Actions**.

## Secrets do repositório

| Secret | Descrição | Onde obter |
|---|---|---|
| `RAILWAY_TOKEN` | Token de serviço do Railway para deploys | Railway → Account Settings → Tokens |
| `STAGING_DATABASE_URL_MIGRACAO` | URL do Postgres do staging com usuário postgres (migrations) | Railway → Serviço postgres → Variables |

## Secrets automáticos do GitHub Actions

Estes já estão disponíveis sem configuração:

| Secret | Uso |
|---|---|
| `GITHUB_TOKEN` | Login no ghcr.io para push de imagens Docker |

## Variáveis de ambiente no Railway

Configure diretamente no dashboard do Railway por serviço, **não** nos secrets do GitHub:

### Serviço `barbertime-api`

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do Postgres (usuário app) |
| `DATABASE_URL_MIGRACAO` | URL do Postgres (usuário postgres) |
| `REDIS_URL` | URL do Redis |
| `SMTP_URL` | URL do Mailpit ou serviço SMTP real |
| `APP_URL` | URL pública do frontend (ex: https://staging.barbertime.dev) |
| `AUTH` | `propria` |
| `TRUST_PROXY` | `true` (Railway usa proxy reverso) |
| `NODE_ENV` | `production` |
| `PORT` | `3333` |

### Railway — Release Command (serviço barbertime-api)

Configure como "Release Command" no Railway para rodar antes do restart:

```
pnpm nx run api:migrar
```

## Ambientes no GitHub Actions

O workflow `staging.yml` usa `environment: staging`. Crie este ambiente em:

**GitHub → Settings → Environments → New environment → staging**

Opcionalmente adicione proteção (aprovação manual) para produção no futuro.
