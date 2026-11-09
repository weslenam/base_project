# ADR 0002: Ambiente de desenvolvimento com WSL 2 e Docker

- **Status:** Aceito
- **Data:** 2026-11-07
- **Relacionado:** [ADR 0001](0001-saas-multi-tenant.md)

## Contexto

O BarberTime depende de serviços que não devem ser instalados à mão em cada máquina (PostgreSQL com Row-Level Security, fila para lembretes e cobranças, captura de e-mails). O ambiente precisa subir igual em qualquer máquina e ficar próximo do que roda em produção (Linux). A máquina principal de desenvolvimento é Windows.

## Decisão

- No Windows, o desenvolvimento acontece **dentro do WSL 2** (Ubuntu): o repositório é clonado no sistema de arquivos do Linux (ex.: `~/projetos/barbertime`), nunca em `C:\` ou `/mnt/c`, e Node, npm, git e Nx são instalados no WSL. O editor abre o projeto pelo WSL (VS Code com a extensão WSL, `code .` no terminal do Ubuntu).
- O Docker é usado pelo WSL 2: Docker Desktop com a integração WSL ativada para a distro, ou Docker Engine instalado direto no Ubuntu.
- O desenvolvimento usa **Docker Compose** (`docker-compose.yml` na raiz).
- Serviços de infraestrutura desde já:
  - **postgres** (PostgreSQL 17): banco da aplicação. O script `docker/postgres/init.sql` cria o papel `barbertime_app`, **sem superusuário e sem BYPASSRLS**, para que o RLS do ADR 0001 valha também no desenvolvimento. O superusuário fica só para migrações.
  - **redis** (Redis 7): filas e tarefas agendadas (lembretes, cobranças, mensagens de WhatsApp).
  - **mailpit**: captura os e-mails enviados no desenvolvimento, com interface web.
- Os apps (`api` e `web`) entram no mesmo Compose quando o workspace Nx for criado na fase 0, rodando em container Node com o código montado por volume e `node_modules` em volume próprio (evita conflito de binários entre Windows e Linux).
- Configuração por `.env` (modelo em `.env.example`); nenhum segredo versionado.
- Dados ficam em volumes nomeados; `docker compose down -v` zera o ambiente.

## Consequências

- Requer WSL 2 com Ubuntu e Docker (Desktop com integração WSL ou Engine no Ubuntu).
- Arquivos no sistema do Linux dão desempenho de leitura/escrita e _hot reload_ (eventos de arquivo) confiáveis; em `/mnt/c` o Vite e o Nx ficam lentos e o watch falha.
- Fim de linha LF em tudo (`.gitattributes`) e `git config core.autocrlf input` no WSL.
- Mesmo ambiente Linux do desenvolvimento ao deploy.
- As mesmas imagens base servem de ponto de partida para o deploy.
