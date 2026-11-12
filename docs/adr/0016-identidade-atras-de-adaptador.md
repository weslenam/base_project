# ADR 0016: Identidade atrás de um adaptador, com Supabase Auth e BFF na API

- **Status:** Parcialmente substituído — adaptador `supabase` (GoTrue) abandonado (planejamento 0041, 2026-11-12); adaptador `propria` continua ativo
- **Data:** 2026-11-08
- **Relacionado:** ADRs 0009, 0010, 0014 e 0015; planejamento 0025 (sprints S3, S4 e S5)

## Contexto

Hoje a identidade é toda nossa:

- sessão opaca em cookie `HttpOnly`;
- senha com scrypt;
- "esqueci a senha" com token próprio.

O Weslen escolheu usar o Supabase Auth (GoTrue) com os tokens só no servidor. Como a produção ainda não está decidida, a troca não pode prender o sistema ao Supabase.

## Decisão

- **Interface `identidade` na API**, com estas operações:
  - entrar, sair, sessão atual e renovação;
  - pedir redefinição de senha, redefinir e trocar a senha;
  - encerrar outras sessões;
  - convidar e aceitar convite.
- **Duas implementações**, escolhidas pela variável `AUTH`:
  - `propria`: o código atual extraído (sessão opaca e scrypt). É o padrão até a S4 ficar estável;
  - `supabase`: o GoTrue do stack.
- **BFF:** a API faz o login no GoTrue e guarda o access token e o refresh token em cookies `HttpOnly`, `SameSite=Lax` e `Secure` em produção. O navegador nunca recebe token, e o front continua falando só com a API.
- **Tabelas próprias:**
  - usuários, vínculos e papéis continuam nas nossas tabelas, com `usuarios.auth_id` ligando ao usuário do Auth;
  - as permissões continuam vindo do domínio pela chave do papel (ADR 0010) e não vão nas claims do token.
- **Barbearia ativa:** num cookie validado pela API a cada requisição, como hoje.
- **Convite:** por link de e-mail com aceite. O vínculo só existe depois do aceite, e some a senha inicial definida por quem convida (achados N1 e N2 do planejamento 0025).

## Consequências

- **Testes:** os de integração rodam com `AUTH=propria`, e um conjunto menor roda contra o GoTrue local.
- **Limites:** os do ADR 0014 continuam na API, inclusive nas rotas de identidade. Os limites próprios do GoTrue somam proteção.
- **Volta atrás:** se a produção não for Supabase, basta manter `AUTH=propria`.
