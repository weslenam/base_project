#!/usr/bin/env bash
# PreToolUse (Edit|Write): editar UI (.vue ou libs/ui-*) só depois de carregar a
# skill design-system nesta sessão. Confere na transcrição; se faltar, nega a edição.
. "$(dirname "$0")/_comum.sh"
ENTRADA="$(cat)"
arquivo="$(campo tool_input.file_path)"
case "$arquivo" in
  *.vue|*/libs/ui-*) ;;
  *) exit 0 ;;
esac
transcricao="$(campo transcript_path)"
if [ -f "$transcricao" ] && grep -q '"skill":"design-system"' "$transcricao"; then
  exit 0
fi
python3 - <<'PY'
import json
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Edição de UI bloqueada: carregue antes a skill design-system (Skill tool, skill \"design-system\") e siga o contrato Ds*. Regra em .claude/rules/fluxo-de-trabalho.md."
}}, ensure_ascii=False))
PY
