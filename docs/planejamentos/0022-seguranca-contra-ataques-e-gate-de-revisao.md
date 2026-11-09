# Planejamento 0022: Segurança da API contra ataques e revisão de segurança obrigatória antes do commit

- **Status:** Concluído
- **Data:** 2026-11-08
- **Solicitado por:** weslenam
- **Relacionado:** ADR 0014 (novo), ADR 0010 (regra nova: ninguém concede o que não tem), ADRs 0009 a 0011 e 0013; planejamento 0019 (trava da página pública) e 0021 (fluxo por hooks)
- **Commits:** ver git log ("feat(seguranca): limites, schemas, cabeçalhos e revisão de segurança obrigatória")

## Solicitação de origem

> faça uma analise deste projeto e apresente a cobertura de testes de usabilidade, smoke e etc assim como testes de segurança

> minha preocupação é segunraça com relação a ataques e injections temos alguma skill que trata este assunto

> vamos fazer assim no nosso fluxo temos que adicionar a security-review e não liberar commit se nao passar nesta etapa alem disso vamos corrigir todos esses pontos:
>
> Os riscos de ataque que continuam reais são os que listei na análise anterior: falta limite de requisições, dá para descobrir clientes pelo telefone na rota pública e e-mails pelo tempo de resposta do login, não há validação de entrada por schema e não há cabeçalhos de segurança. E nada disso tem teste.
>
> e após a conclusão commitar e fazer push

- **Quando:** 2026-11-08 · **Origem:** Conversa com o assistente
- **Esclarecimentos:** nenhum; o pedido autoriza explicitamente o commit e o push ao final.

## Objetivo

1. Incluir a skill `security-review` no fluxo de trabalho como etapa **bloqueante**: o hook nega `git commit` se a revisão não foi feita sobre exatamente o que está sendo commitado.
2. Corrigir, com testes, os cinco riscos:
   - limite de requisições;
   - descoberta de clientes pelo telefone na rota pública;
   - descoberta de e-mails pelo tempo de resposta do login;
   - validação de entrada por schema;
   - cabeçalhos de segurança.

**Fora do escopo** (ficam em _Riscos e pendências_):

- liberar a trava da página pública, que é decisão do usuário;
- limite distribuído em Redis;
- cabeçalhos do servidor que servirá o front em produção (ainda não existe);
- recusar senhas padrão em produção;
- as 2 vulnerabilidades moderadas do `pnpm audit`;
- CI;
- testes ponta a ponta.

## Decisões e restrições

- **Limite de requisições:** `@fastify/rate-limit` 10.3.0 (versão fixa, publicada em 2025-05).
  - **Global:** 300 requisições por minuto por IP.
  - **Mais apertados nas rotas sensíveis**, combinando chaves. Um limite só por IP não segura um ataque distribuído contra uma conta ou uma barbearia.
    - `POST /auth/entrar`: 20 por 15 min por IP e 5 por 15 min por e-mail.
    - `POST /barbearias` (cadastro): 5 por hora por IP.
    - `PUT /auth/senha`: 10 por 15 min por IP.
    - Página pública:
      - páginas e horários: 60 por minuto por IP;
      - reconhecimento: 10 por 10 min por IP e 100 por hora por barbearia;
      - agendar: 5 por 10 min por IP e 3 por hora por telefone.
  - Os valores ficam em `config.limites` e podem ser trocados em `opts.limites`. Os testes de integração usam limites folgados, e um teste próprio usa os valores reais.
  - **Armazenamento em memória, por processo.** Basta para uma instância só; com várias, passa a valer por instância (pendência: Redis).
  - **Atrás de proxy**, o IP real exige `TRUST_PROXY`. Sem ele, todos os clientes dividiriam o limite do proxy. O padrão é desligado, porque confiar no cabeçalho sem proxy permitiria forjar o IP.
- **Descoberta de clientes pelo telefone:** a rota continua existindo, porque a saudação do cliente que volta faz parte do produto (planejamento 0019). A defesa é deixar a varredura inviável:
  - 10 consultas por IP a cada 10 min e 100 por hora por barbearia, o que cobre ataques distribuídos;
  - a resposta continua sendo só o primeiro nome.
  - Se o limite estourar, o front trata a consulta como "cliente novo" e o agendamento segue normalmente; só a saudação se perde.
- **Descoberta de e-mails pelo tempo do login:** com e-mail inexistente, a senha passa pelo scrypt contra um hash falso, gerado uma vez. Os dois casos custam o mesmo.
- **Validação de entrada,** em três camadas:
  1. **Guarda genérica** em toda requisição (`seguranca/entrada.js`):
     - corpo até 64 KB;
     - profundidade até 8;
     - textos até 5.000 caracteres;
     - listas até 500 itens;
     - o JSON com `__proto__` e `constructor` já é recusado pelo Fastify.
  2. **Parâmetros de rota tipados** em todas as rotas: `:id` é inteiro e `:slug`, `:chave` e `:acao` têm formato e tamanho. Assim, um id como `abc` vira 400, e não erro 500 do banco.
  3. **Schemas específicos** nas rotas de autenticação, usuários, papéis, página pública, pagamentos e bloqueios da agenda: tipos, tamanhos e formatos.

  As regras de negócio continuam nas rotas e no domínio, com as mensagens próprias em pt-BR. O schema cuida de tipo e tamanho, não de regra. O erro de schema sai como 400 com uma mensagem em pt-BR.

- **Cabeçalhos de segurança:** `@fastify/helmet` 13.1.2 com os padrões (CSP restrita, `nosniff`, `frame-ancestors`, HSTS, `Referrer-Policy`).
  - **Sem CORS de propósito:** o front chama a API pela mesma origem (proxy `/api`), então nenhum outro site lê as respostas. Isso fica coberto por teste.
- **Etapa de revisão de segurança** (`security-review`), depois de verificar e revisar e antes de fechar:
  - `.claude/hooks/registrar-security-review.sh` grava o hash da árvore do índice (`git write-tree`). O assistente o roda **só** quando a revisão termina sem achados abertos, com tudo já em stage.
  - `.claude/hooks/exigir-security-review.sh` (PreToolUse Bash) nega `git commit` em dois casos: se a skill não foi carregada na sessão, ou se o índice mudou depois da revisão.
  - **Limite:** o hook prova que a revisão foi feita sobre o conteúdo exato do commit. Que ela "passou" depende de o assistente só registrar sem achados; isso fica escrito na regra.

## Etapas

- [x] 1. Planejamento (este documento) e ADR 0014.
- [x] 2. Gate do `security-review`: hooks, `settings.json`, `.gitignore`, regra do fluxo e `CLAUDE.md`.
- [x] 3. Dependências: `@fastify/rate-limit` e `@fastify/helmet`.
- [x] 4. Cabeçalhos, guarda de entrada, parâmetros tipados e mensagem de erro de schema.
- [x] 5. Limites de requisição: global e por rota sensível.
- [x] 6. Login com tempo constante.
- [x] 7. Schemas específicos nas rotas.
- [x] 8. Front: reconhecimento que estoura o limite vira "cliente novo".
- [x] 9. Testes: unitários (cabeçalhos, CORS, guarda, parâmetros, hash falso, front) e integração (429 com os limites reais, tempo do login, schemas).
- [x] 10. `pnpm verificar:tudo`.
- [x] 11. `security-review` sobre o diff e registro do gate. O `/code-review` fica para a abertura do PR, como manda a etapa 6 do fluxo (antes de PR ou merge na `main`); aqui é commit e push na branch.
- [x] 12. Fechar: índices, commit e push (autorizado no pedido).

## Critérios de pronto

- `pnpm verificar:tudo` verde.
- Testes provam:
  - 429 nos limites;
  - tempo do login parecido para e-mail inexistente e para senha errada;
  - 400 para entrada fora do schema;
  - cabeçalhos presentes;
  - nenhum `Access-Control-Allow-Origin`.
- `git commit` negado pelo hook sem a revisão de segurança e liberado depois dela.

## Riscos e pendências

- Limite em memória: com várias instâncias, migrar para Redis (já existe no `docker-compose`).
- `TRUST_PROXY` precisa ser configurado no deploy atrás de proxy.
- O cadastro (`POST /barbearias`) responde 409 para e-mail já usado. Isso é inerente ao cadastro aberto; a mitigação é o limite de 5 por hora por IP.
- A trava da página pública continua; liberar é decisão do usuário, agora com os limites prontos.
- Fica para depois:
  - cabeçalhos do servidor do front em produção;
  - recusar senhas padrão (`troque-me-*`) em produção;
  - `pnpm audit` (2 moderadas em `node-pg-migrate`);
  - CI;
  - Playwright.

## Registro de mudanças

- 2026-11-08: criado a partir do pedido, já aprovado pelo usuário ("vamos fazer assim").
- 2026-11-08: ajustes na execução.
  - O `fastify.rateLimit` do plugin para no primeiro limitador da requisição; por isso os limites empilhados usam `createRateLimit`, com store próprio para cada um.
  - Com corpo ausente, o Fastify recusa `type: 'object'`. A guarda passou a tratar o corpo ausente como `{}`, como os handlers já faziam.
  - Opcionais aceitam `null`, porque sem isso o Ajv converteria `null` em 0 ou `""`.
  - Campos numéricos que as rotas convertem com `Number()` são validados como texto, porque o Ajv recusa união de tipos sem `allowUnionTypes`.
  - O teste de tempo do login foi provado contra a regressão: sem o hash falso, a razão cai para 0,07 e o teste falha.
- 2026-11-08: a primeira revisão de segurança (`security-review`, sobre o diff da branch contra a `main`) achou uma **escalada de privilégio** de severidade média, já existente na branch.
  - **O problema:** quem tinha `usuarios.gerenciar` num papel personalizado podia dar a si o papel Dono, ou trocar a senha do Dono e entrar como ele. Quem tinha `papeis.gerenciar` podia aumentar o próprio papel.
  - **A correção:** a regra "ninguém concede o que não tem" (`permissoesAlemDasSuas`, no domínio) aplicada em usuários (criar, alterar, remover, senha provisória) e papéis (criar, editar, excluir).
  - **O contexto** passa a levar `permissoesDoPapel`.
  - **Testes:** 3 de domínio e 2 de integração.
  - **Documentação:** ADR 0010 atualizado.
  - **Efeito no produto:** um papel "RH" só consegue dar papéis contidos no dele.
  - Revisão refeita sobre a correção antes do registro do gate.
- 2026-11-08: concluído. `pnpm verificar:tudo` verde.
  - API: 13 testes unitários e 48 de integração (9 novos de ataque).
  - Front: 113 testes (3 novos).
  - Gate do commit testado pelo hook nos três casos: sem a skill, sem registro e com registro.
