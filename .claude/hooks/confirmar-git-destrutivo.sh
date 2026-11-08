#!/usr/bin/env bash
# PreToolUse (Bash): pede confirmação explícita antes de comandos Git destrutivos
# ou que publicam algo (skill git-guardrails). Não bloqueia: devolve "ask".
. "$(dirname "$0")/_comum.sh"
ENTRADA="$(cat)"
comando="$(campo tool_input.command)"
[ -n "$comando" ] || exit 0

python3 - "$comando" <<'PY'
import json, re, sys
cmd = sys.argv[1]
# Início de comando: começo da linha ou depois de ; && || | $(
ini = r'(?:^|[;&|]\s*|\$\(\s*)'
git = ini + r'git(?:\s+-C\s+\S+|\s+-c\s+\S+)*\s+'
regras = [
    (git + r'push\b', 'git push (publica no remoto)'),
    (git + r'reset\b[^;&|]*--hard\b', 'git reset --hard (descarta alterações)'),
    (git + r'clean\b[^;&|]*\s-[a-zA-Z]*f', 'git clean -f (apaga arquivos não versionados)'),
    (git + r'branch\b[^;&|]*\s(-D|--delete\s+--force|-d\s+-f)\b', 'git branch -D (apaga branch)'),
    (git + r'rebase\b', 'git rebase (reescreve histórico)'),
    (git + r'commit\b[^;&|]*--amend\b', 'git commit --amend (reescreve o último commit)'),
    (git + r'stash\s+(drop|clear)\b', 'git stash drop/clear (descarta stash)'),
    (git + r'checkout\b[^;&|]*\s--\s+\.(\s|$)', 'git checkout -- . (descarta alterações)'),
    (git + r'restore\b[^;&|]*\s\.(\s|$)', 'git restore . (descarta alterações)'),
    (ini + r'rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-r\s+-f|-f\s+-r)\b', 'rm -rf (apaga em massa)'),
]
achados = [motivo for padrao, motivo in regras if re.search(padrao, cmd, re.M)]
if achados:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": "git-guardrails: confirme antes de rodar — " + "; ".join(achados)
    }}, ensure_ascii=False))
PY
exit 0
