#!/usr/bin/env bash
# Utilitários dos hooks do projeto (planejamento 0021).

# Caminho do graphify: PATH ou ~/.local/bin (instalação via uv). Vazio se não houver.
graphify_bin() {
  command -v graphify 2>/dev/null || { [ -x "$HOME/.local/bin/graphify" ] && echo "$HOME/.local/bin/graphify"; }
}

# Lê um campo do JSON de entrada do hook (stdin já salvo em $ENTRADA).
campo() {
  python3 -c 'import json,sys
d=json.loads(sys.argv[1] or "{}")
for k in sys.argv[2].split("."):
    d=d.get(k) if isinstance(d,dict) else None
print(d or "")' "$ENTRADA" "$1"
}
