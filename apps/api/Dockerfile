# ── Estágio 1: instalar dependências ─────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/barbertime/package.json ./apps/barbertime/
COPY apps/business-center/package.json ./apps/business-center/
COPY apps/e2e-layout/package.json ./apps/e2e-layout/
COPY libs/ ./libs/

RUN pnpm install --frozen-lockfile

# ── Estágio 2: imagem de produção ─────────────────────────────────────────────
FROM node:22-alpine AS prod

RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

WORKDIR /app

# Apenas deps de produção
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Código-fonte da API e libs compartilhadas
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
COPY libs/ ./libs/
COPY nx.json tsconfig.base.json ./

RUN chown -R node:node /app
USER node

ENV HOST=0.0.0.0
ENV PORT=3333
ENV NODE_ENV=production

EXPOSE 3333

WORKDIR /app/apps/api
CMD ["node", "src/main.ts"]
