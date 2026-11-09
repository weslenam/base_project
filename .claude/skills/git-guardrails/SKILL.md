---
name: git-guardrails
description: Regras de segurança para comandos Git e operações destrutivas. Use sempre que for executar git, apagar arquivos ou mexer em branches e histórico.
---

# Git Guardrails

## Proibido sem confirmação explícita de Weslen na mesma conversa
- `git push` (qualquer), principalmente `--force` / `--force-with-lease`
- `git reset --hard`, `git clean -fd`, `git checkout -- .`, `git restore .`
- `git branch -D`, `git push origin --delete` (exceto apagar a branch de um PR já mesclado na `main`; ver "Sempre")
- `git rebase` em branch compartilhada, `git commit --amend` em commit já enviado
- `git stash drop` / `clear`
- `rm -rf` ou apagar arquivos versionados em massa

Ao pedir confirmação: mostre o comando exato, o que será perdido e uma alternativa segura.

## Sempre
- Rode `git status` e `git diff --stat` antes de commitar.
- Nunca trabalhe direto em `main`/`master`: crie uma branch que diga de onde vem (planejamento 0038):
  - `feat/NNNN-slug`, `chore/NNNN-slug` e `docs/NNNN-slug`, onde NNNN é o número do planejamento;
  - `fix/<issue>-slug` para bug, a partir de uma issue no GitHub.
- Correção de bug: um teste de regressão com `#<issue>` no nome, e `Fixes #<issue>` mais `Introduzido em: <sha>` no commit ou no PR.
- Depois do merge, que é feito com merge commit e não squash: apagar a branch, local (`git branch -d`) e remota (`git push origin --delete`), e voltar para a `main` atualizada. Esse é o padrão definido pelo Weslen e não precisa de nova confirmação. `branch -D` (forçado) continua exigindo confirmação.
- Commits pequenos, em conventional commits com descrição em português, no padrão do histórico: `feat(escopo): hierarquia fixa de papéis`, `fix(caixa): ...`, `docs: ...`.
- Não commite segredos (.env, certificados, tokens). Se aparecer, pare e avise.
- Antes de operação arriscada, crie ponto de retorno: `git branch backup/<data>` ou `git stash push -m`.

## Se algo der errado
- Não tente consertar com mais comandos destrutivos.
- Use `git reflog` para localizar o estado anterior e proponha a recuperação antes de executar.

## Reforço pelo harness
O hook `.claude/hooks/confirmar-git-destrutivo.sh` (PreToolUse, Bash) pede confirmação explícita para os padrões acima, para a regra não depender só da instrução.
