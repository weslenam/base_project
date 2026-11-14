#!/usr/bin/env bash
# Deploy staging do BarberTime via Railway CLI.
# Chamado pelo .github/workflows/staging.yml
#
#   ./scripts/deploy-staging.sh migrations
#   ./scripts/deploy-staging.sh api  <sha_tag>
#   ./scripts/deploy-staging.sh app  <sha_tag>
#   ./scripts/deploy-staging.sh bc   <sha_tag>

set -euo pipefail
cd "$(dirname "$0")/.."

COMANDO="${1:-}"
SHA_TAG="${2:-}"

REGISTRY="ghcr.io"
REPO_OWNER="${GITHUB_REPOSITORY_OWNER:-barbertime}"
IMAGE_PREFIX="${REGISTRY}/${REPO_OWNER}/barbertime"

# ── Cores ────────────────────────────────────────────────────────────────────
CZ='\033[0m'
VERDE='\033[0;32m'
CINZA='\033[0;90m'
VERMELHO='\033[0;31m'
NEGRITO='\033[1m'

ok()    { echo -e "${VERDE}✓${CZ}  $*"; }
info()  { echo -e "${CINZA}→${CZ}  $*"; }
erro()  { echo -e "${VERMELHO}✗${CZ}  $*" >&2; exit 1; }
titulo(){ echo -e "\n${NEGRITO}$*${CZ}"; }

[ -z "$COMANDO" ] && erro "Uso: deploy-staging.sh <migrations|api|app|bc> [sha_tag]"

case "$COMANDO" in
  migrations)
    titulo "Rodando migrations no staging"
    [ -z "${DATABASE_URL_MIGRACAO:-}" ] && erro "DATABASE_URL_MIGRACAO não definida"
    info "pnpm nx run api:migrar"
    pnpm nx run api:migrar
    ok "Migrations aplicadas"
    ;;

  api)
    titulo "Deploy API no Railway"
    [ -z "$SHA_TAG" ] && erro "sha_tag é obrigatório para deploy de serviço"
    IMAGE="${IMAGE_PREFIX}-api:${SHA_TAG}"
    info "Imagem: ${IMAGE}"
    railway redeploy --service barbertime-api --image "${IMAGE}" --yes
    ok "API deployada → staging"
    ;;

  app)
    titulo "Deploy barbertime no Railway"
    [ -z "$SHA_TAG" ] && erro "sha_tag é obrigatório"
    IMAGE="${IMAGE_PREFIX}-app:${SHA_TAG}"
    info "Imagem: ${IMAGE}"
    railway redeploy --service barbertime-app --image "${IMAGE}" --yes
    ok "App deployado → staging"
    ;;

  bc)
    titulo "Deploy business-center no Railway"
    [ -z "$SHA_TAG" ] && erro "sha_tag é obrigatório"
    IMAGE="${IMAGE_PREFIX}-bc:${SHA_TAG}"
    info "Imagem: ${IMAGE}"
    railway redeploy --service barbertime-bc --image "${IMAGE}" --yes
    ok "Business Center deployado → staging"
    ;;

  *)
    erro "Comando desconhecido: ${COMANDO}. Use: migrations | api | app | bc"
    ;;
esac
