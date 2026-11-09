#!/usr/bin/env bash
# PreToolUse (Bash|Grep e Read|Glob): lembra de consultar o grafo antes de buscar
# em arquivos. Repassa para `graphify hook-guard`; sem graphify instalado, não faz nada.
. "$(dirname "$0")/_comum.sh"
bin="$(graphify_bin)"
[ -n "$bin" ] || exit 0
exec "$bin" hook-guard "$@"
