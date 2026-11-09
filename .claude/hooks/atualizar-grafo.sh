#!/usr/bin/env bash
# Stop: se houve mudança de código desde o último grafo, atualiza o grafo do
# graphify (só AST, local, sem LLM). Silencioso; nunca bloqueia.
. "$(dirname "$0")/_comum.sh"
dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
bin="$(graphify_bin)"
grafo="$dir/graphify-out/graph.json"
[ -n "$bin" ] && [ -f "$grafo" ] || exit 0
cd "$dir" || exit 0
# Arquivos de código alterados (rastreados ou novos) mais novos que o grafo.
mudou=$(git status --porcelain --untracked-files=all -- apps libs scripts 2>/dev/null \
  | awk '{print $NF}' | grep -E '\.(js|mjs|vue|ts)$' \
  | while read -r f; do [ "$f" -nt "$grafo" ] && echo "$f"; done | head -1)
[ -n "$mudou" ] || exit 0
"$bin" update . >/dev/null 2>&1
echo '{"systemMessage": "graphify: grafo atualizado com as mudanças de código."}'
