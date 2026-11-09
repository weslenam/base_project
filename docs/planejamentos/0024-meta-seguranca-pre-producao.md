# Planejamento 0024: Meta de segurança para pré-produção

- **Status:** Rascunho (meta a tratar)
- **Data:** 2026-11-08
- **Solicitado por:** weslenam
- **Relacionado:** ADRs 0010 e 0014; planejamentos 0022 e 0023
- **Commits:** ainda não commitado

## Solicitação de origem

> crie uma meta para tratarmos
>
> Ninguém repete as verificações automaticamente. Não há CI. A revisão de segurança só bloqueia commits feitos por mim; um commit feito direto por você passa sem ela.
> O ambiente de produção ainda não existe. Faltam HTTPS, os cabeçalhos do servidor do front, TRUST_PROXY, segredos fortes (as senhas troque-me-\* precisam ser recusadas em produção), backup do banco e monitoramento com alertas.
> Conta: não há verificação em duas etapas. A sessão dura 30 dias. Não há registro de auditoria de quem mudou o quê. O limite por e-mail permite que alguém bloqueie o login de uma conta por 15 minutos.
> Dependências: pnpm audit acha 2 vulnerabilidades moderadas e não há atualização automática.
> Nada foi testado de fora: não houve teste de intrusão nem varredura automática (OWASP ZAP) contra o app rodando.
>
> os pontos de vulnerabilidades
>
> apos isso suba o ambiente

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente. A lista citada é a resposta do assistente à pergunta "então segurança ciber ataque vencemos?", que o usuário colou de volta como meta.
- **Esclarecimentos:** nenhum ainda. Cada frente abaixo é aprovada antes de começar.
- "Suba o ambiente" foi tratado à parte: é o ambiente de desenvolvimento (Docker, API e front), não a produção.

## Objetivo

Fechar os riscos que sobraram depois dos planejamentos 0022 e 0023, antes de expor o BarberTime na internet.

Esta é uma **meta**: agrupa cinco frentes, cada uma vira o seu próprio planejamento quando for atacada.

**Fora do escopo:** escolher o provedor de hospedagem. Isso é decisão do usuário e entra na frente B.

## Frentes, em ordem de prioridade

### A. Verificação automática (CI): prioridade 1

Hoje só os commits do assistente passam pela revisão de segurança.

- [ ] A1. GitHub Actions em todo push e PR: `pnpm verificar:tudo`, com Postgres de serviço no CI.
- [ ] A2. `pnpm audit --prod` no CI, falhando em severidade alta ou crítica.
- [ ] A3. Proteção da branch `main`: PR obrigatório e CI verde. A revisão de segurança passa a valer para qualquer autor, não só para o assistente.
- [ ] A4. Varredura estática no CI (CodeQL ou Semgrep) sobre JS e Vue.
- [ ] A5. Hook de git local (`pre-commit`) rodando lint e testes rápidos, para quem commita fora do assistente.

### B. Ambiente de produção: prioridade 2

- [ ] B1. Decidir a hospedagem (decisão do usuário) e documentar em ADR.
- [ ] B2. HTTPS obrigatório (TLS no proxy), com redirecionamento de HTTP e HSTS, que já é enviado pela API.
- [ ] B3. Servidor do front com cabeçalhos próprios: CSP para o app Vue, `frame-ancestors`, `nosniff` e `Referrer-Policy`.
- [ ] B4. `TRUST_PROXY=true` atrás do proxy, com teste de que o IP real chega ao limite de requisições.
- [ ] B5. Na partida da API em produção, recusar senhas padrão (`troque-me-*`), segredos curtos e `DATABASE_URL` com superusuário.
- [ ] B6. Backup automático do Postgres, com restauração testada e retenção definida.
- [ ] B7. Monitoramento e alertas: erros 5xx, picos de 429 e 401 (sinal de ataque), disponibilidade e disco do banco.
- [ ] B8. Limite de requisições em Redis, para mais de uma instância (o Redis já está no `docker-compose`).

### C. Conta e sessão: prioridade 3

- [ ] C1. Verificação em duas etapas (TOTP), no mínimo para Dono e Gerente.
- [ ] C2. Sessão mais curta: expiração por inatividade (ex.: 12h) e teto absoluto (ex.: 7 dias), mais "sair de todos os dispositivos" no perfil.
- [ ] C3. Registro de auditoria: quem mudou papel, desativou ou removeu usuário, trocou configuração, fechou caixa ou cancelou comanda paga.
- [ ] C4. Limite por e-mail sem permitir bloquear a conta alheia. Contar só falhas, com atraso progressivo em vez de bloqueio fixo. O dono legítimo continua entrando, seja por um IP de confiança, seja pela recuperação por e-mail.

### D. Dependências: prioridade 4

- [ ] D1. Resolver as 2 vulnerabilidades moderadas (`minimatch`, via `node-pg-migrate` → `glob`).
- [ ] D2. Atualização automática (Renovate ou Dependabot), respeitando a regra de versão publicada há pelo menos 2 semanas.

### E. Teste de fora: prioridade 5

- [ ] E1. OWASP ZAP (varredura base) contra o app rodando no CI, num ambiente efêmero.
- [ ] E2. Testes ponta a ponta com Playwright nos fluxos críticos (entrar, balcão, caixa, agendamento público, esqueci a senha), com `@axe-core/playwright` para acessibilidade.
- [ ] E3. Teste de intrusão manual antes do lançamento (externo ou checklist OWASP ASVS nível 1).

## Critérios de pronto da meta

- Todas as frentes A a E concluídas ou explicitamente adiadas pelo usuário, com o motivo.
- Nenhum commit chega à `main` sem CI verde.
- A produção sobe só com HTTPS, segredos fortes, backup testado e alertas ativos.

## Riscos e pendências

- **B1 bloqueia B2 a B7:** sem decidir a hospedagem, a frente B não começa. A, C, D e E não dependem dela.
- **C1 exige telas novas** (skill `design-system`) e um fluxo de recuperação para quem perder o celular.

## Registro de mudanças

- 2026-11-08: meta criada a pedido do usuário, a partir da lista de riscos abertos.
