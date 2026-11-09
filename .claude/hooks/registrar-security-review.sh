#!/usr/bin/env bash
# Registra que a revisão de segurança (skill security-review) passou sobre o que
# está em stage agora (planejamento 0022). Rode SÓ quando a revisão terminar sem
# achados abertos e com tudo já em `git add`. Qualquer mudança no stage depois
# disso invalida o registro, e o hook exigir-security-review.sh nega o commit.
set -euo pipefail
dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
mkdir -p "$dir/.claude/estado"
git -C "$dir" write-tree > "$dir/.claude/estado/security-review.ok"
echo "Revisão de segurança registrada para a árvore $(cat "$dir/.claude/estado/security-review.ok")."
