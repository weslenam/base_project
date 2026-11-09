# ADR 0017: Schema `app` não exposto e PostgREST fechado ao front

- **Status:** Aceito
- **Data:** 2026-11-08
- **Relacionado:** ADRs 0001, 0009, 0015 e 0016; planejamento 0025 (sprint S2)

## Contexto

O Supabase publica pelo PostgREST as tabelas dos schemas expostos (`public` por padrão) a quem tem a chave anônima. No BarberTime, toda leitura e escrita passa pela API Node, que concentra o domínio, a hierarquia de papéis e os limites.

## Decisão

- **Schema:** as tabelas do sistema ficam no schema `app`, fora de `[api] schemas` no `config.toml`. O schema `public` fica vazio, reservado para uma RPC pública futura e explícita.
- **Barbearia da requisição:** vem da função `app.barbearia_atual()`, que lê o GUC `app.barbearia_id` definido pela API a cada transação. Todas as políticas de RLS usam essa função.
- **Acesso dos papéis:** `anon` e `authenticated` não têm nenhum privilégio em `app`.
- **Teste automático** prova que a chave anônima não lê tabela nenhuma pelo `/rest/v1`.

## Consequências

- O front nunca usa supabase-js para dados.
- **Tempo real:** se for preciso (fila do balcão, sprint S7), ele chega por SSE da API, não pelo Realtime no navegador.
- **Abrir leitura direta no futuro** exige um ADR novo, com políticas e testes próprios.
