# ADR 0014: Proteção da API contra abuso e entrada maliciosa

- **Status:** Aceito
- **Data:** 2026-11-08
- **Relacionado:** ADRs 0009, 0010 e 0013; planejamento 0022

## Contexto

A API já tinha:

- SQL sempre parametrizado;
- RLS forçado por barbearia;
- senhas em scrypt e sessão com token aleatório guardado só como hash.

Faltavam defesas contra abuso e entrada maliciosa:

- **Sem limite de requisições:** dava para fazer força bruta no login e varrer telefones na página pública para descobrir quem é cliente.
- **Login com tempo diferente** para e-mail inexistente e para senha errada, o que revelava quais e-mails têm conta.
- **Sem validação de tipo e tamanho na entrada:** um id não numérico virava erro 500 e não havia limite para textos enormes.
- **Sem cabeçalhos de segurança.**

## Decisão

- **Limite de requisições com `@fastify/rate-limit`:**
  - Limite global por IP.
  - Limites mais apertados nas rotas sensíveis, com chaves combinadas: IP, e-mail, telefone e barbearia. Assim, um ataque distribuído contra uma conta ou uma barbearia também é barrado.
  - Os valores ficam em `config.limites` (planejamento 0022).
  - Excedeu, recebe 429 com mensagem em pt-BR.
  - Atrás de proxy, `TRUST_PROXY` liga o IP real. O padrão é desligado, para que ninguém forje o IP pelo cabeçalho.
- **Login em tempo constante:** sem usuário, a senha é conferida contra um hash falso de mesmo custo.
- **Reconhecimento por telefone na página pública:**
  - Continua existindo, porque o produto precisa dele, mas com limite por IP e por barbearia e resposta só com o primeiro nome.
  - Se a consulta for barrada, o front segue como "cliente novo".
- **Entrada validada em três camadas:**
  1. Guarda genérica de tamanho e forma em toda requisição: corpo, profundidade, textos e listas.
  2. Parâmetros de rota tipados em todas as rotas.
  3. Schemas específicos nas rotas de autenticação, públicas e administrativas.

  Regra de negócio não vai para o schema: continua no domínio e nas rotas, com as mensagens próprias. Erro de schema responde 400 em pt-BR.

- **Cabeçalhos com `@fastify/helmet`** nos padrões.
- **Sem CORS:** o front usa a mesma origem. Abrir CORS exige um novo ADR.
- **Rota nova segue o mesmo padrão:** parâmetros tipados (automático), schema quando recebe corpo e limite próprio quando é pública ou trata credenciais.

## Consequências

- Força bruta e varredura ficam lentas a ponto de não valerem a pena. Com várias instâncias, o limite em memória passa a ser por instância e precisa ir para o Redis.
- Uma entrada malformada recebe 400, não 500, e não chega ao banco.
- Alterar limites ou schemas exige teste, e as regras ficam documentadas neste ADR.
