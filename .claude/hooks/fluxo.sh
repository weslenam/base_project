#!/usr/bin/env bash
# UserPromptSubmit: injeta a ordem de trabalho obrigatória em todo pedido.
# Fonte única: .claude/rules/fluxo-de-trabalho.md (planejamento 0021).
dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
regra="$dir/.claude/rules/fluxo-de-trabalho.md"
[ -f "$regra" ] || exit 0
python3 - "$regra" <<'PY'
import json, sys
texto = open(sys.argv[1], encoding="utf-8").read()
inicio = texto.find("## Ordem obrigatória")
resumo = texto[inicio:].split("\n## ", 2)[0] if inicio >= 0 else texto
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Fluxo de trabalho do BarberTime (.claude/rules/fluxo-de-trabalho.md):\n" + resumo.strip()
}}, ensure_ascii=False))
PY
