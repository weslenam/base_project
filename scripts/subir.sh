#!/usr/bin/env bash
# Sobe o ambiente de desenvolvimento do BarberTime.
#
#   ./scripts/subir.sh              → banco + migrations + seed
#   ./scripts/subir.sh --sem-seed   → banco + migrations (sem dados de exemplo)
#   ./scripts/subir.sh --dev        → banco + migrations + seed + pnpm dev
#   ./scripts/subir.sh --ajuda      → esta mensagem

set -euo pipefail
cd "$(dirname "$0")/.."

# ── Cores ────────────────────────────────────────────────────────────────────
CZ='\033[0m'
CINZA='\033[0;90m'
VERDE='\033[0;32m'
AMARELO='\033[0;33m'
VERMELHO='\033[0;31m'
NEGRITO='\033[1m'

ok()    { echo -e "${VERDE}✓${CZ}  $*"; }
info()  { echo -e "${CINZA}→${CZ}  $*"; }
aviso() { echo -e "${AMARELO}!${CZ}  $*"; }
erro()  { echo -e "${VERMELHO}✗${CZ}  $*" >&2; exit 1; }
titulo(){ echo -e "\n${NEGRITO}$*${CZ}"; }

# ── Flags ────────────────────────────────────────────────────────────────────
SEED=true
DEV=false

for arg in "$@"; do
  case "$arg" in
    --sem-seed) SEED=false ;;
    --dev)      DEV=true   ;;
    --ajuda|-h)
      echo "Uso: ./scripts/subir.sh [--sem-seed] [--dev] [--ajuda]"
      echo ""
      echo "  --sem-seed   Pula o seed (não cria dados de exemplo)"
      echo "  --dev        Após o banco pronto, inicia pnpm dev"
      echo "  --ajuda      Exibe esta ajuda"
      exit 0
      ;;
    *) erro "Flag desconhecida: $arg. Use --ajuda para ver as opções." ;;
  esac
done

# ── Pré-requisitos ───────────────────────────────────────────────────────────
titulo "Verificando pré-requisitos"

command -v docker  >/dev/null 2>&1 || erro "Docker não encontrado. Instale o Docker Desktop ou o Docker Engine."
command -v pnpm    >/dev/null 2>&1 || erro "pnpm não encontrado. Instale via: corepack enable"

docker info >/dev/null 2>&1 || erro "Docker não está em execução. Inicie o Docker antes de continuar."

ok "Docker e pnpm encontrados"

# ── Arquivo .env ─────────────────────────────────────────────────────────────
titulo "Verificando .env"

if [ ! -f .env ]; then
  aviso ".env não encontrado. Copiando de .env.example..."
  cp .env.example .env
  echo ""
  aviso "ATENÇÃO: Edite o .env e troque as senhas antes de continuar:"
  aviso "  POSTGRES_PASSWORD=troque-me-postgres"
  aviso "  APP_DB_PASSWORD=troque-me-app"
  echo ""
  read -r -p "Pressione Enter depois de salvar o .env (Ctrl+C para cancelar)..."
fi

# Verifica se as senhas obrigatórias foram definidas
# shellcheck source=/dev/null
source .env 2>/dev/null || true

if [ "${POSTGRES_PASSWORD:-}" = "troque-me-postgres" ] || [ -z "${POSTGRES_PASSWORD:-}" ]; then
  erro "POSTGRES_PASSWORD não foi alterada no .env. Defina uma senha antes de continuar."
fi
if [ "${APP_DB_PASSWORD:-}" = "troque-me-app" ] || [ -z "${APP_DB_PASSWORD:-}" ]; then
  erro "APP_DB_PASSWORD não foi alterada no .env. Defina uma senha antes de continuar."
fi

ok ".env configurado"

# ── Dependências ─────────────────────────────────────────────────────────────
titulo "Dependências"

if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  info "Instalando dependências (pnpm install)..."
  pnpm install --frozen-lockfile
  ok "Dependências instaladas"
else
  ok "node_modules atualizado"
fi

# ── Infraestrutura ───────────────────────────────────────────────────────────
titulo "Infraestrutura Docker"

info "Subindo postgres, redis e mailpit..."
docker compose up -d --wait postgres redis mailpit

ok "Postgres, Redis e Mailpit prontos"
info "  Mailpit (e-mails): http://localhost:${MAILPIT_WEB_PORT:-8025}"

# ── Migrations ───────────────────────────────────────────────────────────────
titulo "Banco de dados"

info "Rodando migrations..."
pnpm nx run api:migrar
ok "Migrations aplicadas"

# ── Seed ─────────────────────────────────────────────────────────────────────
if [ "$SEED" = true ]; then
  info "Populando com dados de exemplo (seed)..."
  pnpm nx run api:semear
  ok "Seed concluído"
  echo ""
  echo -e "  ${CINZA}Credenciais:${CZ}"
  echo -e "  ${CINZA}  Dono      →${CZ} dono@barbertime.dev / barbertime123"
  echo -e "  ${CINZA}  Gerente   →${CZ} gerente@barbertime.dev / barbertime123"
  echo -e "  ${CINZA}  Recepção  →${CZ} recepcao@barbertime.dev / barbertime123"
  echo -e "  ${CINZA}  Barbeiro  →${CZ} barbeiro@barbertime.dev / barbertime123"
fi

# ── Resumo ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${VERDE}${NEGRITO}Ambiente pronto.${CZ}"
echo ""
echo -e "  ${CINZA}App     →${CZ} http://localhost:4200"
echo -e "  ${CINZA}API     →${CZ} http://localhost:3000"
echo -e "  ${CINZA}Mailpit →${CZ} http://localhost:${MAILPIT_WEB_PORT:-8025}"
echo ""

# ── Dev server ───────────────────────────────────────────────────────────────
if [ "$DEV" = true ]; then
  info "Iniciando pnpm dev (Ctrl+C para parar)..."
  echo ""
  exec pnpm dev
fi

echo -e "  ${CINZA}Para iniciar o front e a API:${CZ}  pnpm dev"
echo -e "  ${CINZA}Para parar o banco:${CZ}            pnpm banco:parar"
echo ""
