# base_project

Base de skills e configurações de agentes para iniciar projetos novos (extraída do protótipo Agenda).

- `.claude/` — skills `design-system` e `planejamento-documentado`, regra `central-de-preferencias` e `settings.json`
- `.agents/`, `.cursor/`, `.github/`, `.opencode/` — skills do Nx (`nx-workspace`, `nx-generate`, `nx-run-tasks`, `nx-plugins`, `nx-import`, `link-workspace-packages`, `monitor-ci`)
- `.codex/`, `.gemini/`, `.cursor/`, `.github/`, `.opencode/` — subagente `ci-monitor` e comando `monitor-ci`
- `CLAUDE.md`, `AGENTS.md`, `opencode.json` — instruções e MCP do Nx para os agentes
