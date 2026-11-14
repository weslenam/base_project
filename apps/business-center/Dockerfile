# ── Estágio 1: build Vite ────────────────────────────────────────────────────
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/barbertime/package.json ./apps/barbertime/
COPY apps/business-center/package.json ./apps/business-center/
COPY apps/e2e-layout/package.json ./apps/e2e-layout/
COPY apps/api/package.json ./apps/api/
COPY libs/ ./libs/
COPY nx.json tsconfig.base.json ./

RUN pnpm install --frozen-lockfile

COPY apps/business-center/ ./apps/business-center/

RUN pnpm nx run business-center:build

# ── Estágio 2: nginx ─────────────────────────────────────────────────────────
FROM nginx:alpine AS prod

COPY --from=build /app/apps/business-center/dist /usr/share/nginx/html
COPY apps/business-center/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
