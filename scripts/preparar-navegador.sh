#!/usr/bin/env bash
# Prepara o Chromium do Playwright para os testes de layout (ADR 0020).
#  - Baixa o Chromium headless (~130 MB em ~/.cache/ms-playwright).
#  - Com sudo disponível, o melhor é: sudo pnpm exec playwright install-deps chromium
#  - Sem sudo (WSL), baixa os .deb das bibliotecas que faltam e extrai em
#    ~/.cache/pw-libs/raiz; o playwright.config.js as coloca no LD_LIBRARY_PATH.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm exec playwright install chromium

BIN=$(find ~/.cache/ms-playwright -name chrome-headless-shell -type f | head -1)
faltando() { ldd "$BIN" | awk '/not found/ {print $1}'; }

if [ -z "$(faltando)" ]; then
  echo "Chromium pronto: nenhuma biblioteca faltando."
  exit 0
fi

DESTINO=~/.cache/pw-libs
mkdir -p "$DESTINO/debs"
PACOTES=(libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libxcomposite1
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libxkbcommon0 libasound2
  libatspi2.0-0 libxrender1 libwayland-server0 libxcb-randr0 libxi6)
(
  cd "$DESTINO/debs"
  for p in "${PACOTES[@]}"; do
    # Ubuntu 24.04 renomeou alguns pacotes com o sufixo t64.
    apt-get download "$p" >/dev/null 2>&1 || apt-get download "${p}t64" >/dev/null 2>&1 || echo "aviso: $p não encontrado"
  done
)
for d in "$DESTINO"/debs/*.deb; do dpkg -x "$d" "$DESTINO/raiz"; done

export LD_LIBRARY_PATH=$(find "$DESTINO/raiz" -name '*.so*' -printf '%h\n' | sort -u | paste -sd:)
if [ -n "$(faltando)" ]; then
  echo "Ainda faltam bibliotecas:"; faltando
  echo "Rode: sudo pnpm exec playwright install-deps chromium"
  exit 1
fi
echo "Chromium pronto (bibliotecas locais em $DESTINO/raiz)."
