#!/usr/bin/env bash
# PreToolUse (Bash): `git commit` só depois da revisão de segurança (planejamento 0022).
# Exige as duas coisas:
#  1. a skill security-review carregada nesta sessão (confere na transcrição);
#  2. o registro da revisão (.claude/estado/security-review.ok) igual à árvore do
#     índice atual (`git write-tree`): o que vai no commit é o que foi revisado.
# O registro é gravado por registrar-security-review.sh, só quando a revisão passa.
. "$(dirname "$0")/_comum.sh"
ENTRADA="$(cat)"
comando="$(campo tool_input.command)"

# Só interessa `git commit` como comando (início ou depois de ; && || |).
python3 - "$comando" <<'PY' || exit 0
import re, sys
padrao = r'(^|[;&|]\s*|\$\(\s*)git(\s+-C\s+\S+|\s+-c\s+\S+)*\s+commit\b'
sys.exit(0 if re.search(padrao, sys.argv[1], re.M) else 1)
PY

dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
negar() {
  python3 - "$1" <<'PY'
import json, sys
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": sys.argv[1]
}}, ensure_ascii=False))
PY
  exit 0
}

transcricao="$(campo transcript_path)"
if ! { [ -f "$transcricao" ] && grep -q '"skill":"security-review"' "$transcricao"; }; then
  negar "Commit bloqueado: rode a revisão de segurança antes (Skill \"security-review\") sobre o diff em stage. Se não houver achados abertos, registre com .claude/hooks/registrar-security-review.sh. Regra em .claude/rules/fluxo-de-trabalho.md (etapa 7)."
fi

registro="$dir/.claude/estado/security-review.ok"
arvore="$(git -C "$dir" write-tree 2>/dev/null)"
if [ ! -f "$registro" ] || [ "$(cat "$registro")" != "$arvore" ]; then
  negar "Commit bloqueado: o que está em stage não é o que passou na revisão de segurança (ou ela não foi registrada). Revise de novo com a skill security-review e, sem achados abertos, rode .claude/hooks/registrar-security-review.sh. Regra em .claude/rules/fluxo-de-trabalho.md (etapa 7)."
fi
exit 0
