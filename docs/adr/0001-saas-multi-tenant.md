# ADR 0001: SaaS multi-tenant com banco compartilhado e isolamento por barbearia

- **Status:** Aceito
- **Data:** 2026-11-07
- **Relacionado:** [Planejamento 0001](../planejamentos/0001-escopo-e-roadmap.md)

## Contexto

O BarberTime será vendido como SaaS: muitas barbearias na mesma plataforma, cada uma vendo apenas os próprios dados. O protótipo Agenda era 100% offline com SQLite local, o que não serve para esse modelo. Precisamos escolher como isolar os dados de cada barbearia (tenant).

## Opções consideradas

1. **Banco por tenant:** isolamento máximo, mas custo e operação crescem com cada barbearia (migrações, backups, conexões). Exagero para barbearias pequenas.
2. **Schema por tenant (PostgreSQL):** bom isolamento, mas migrações em centenas de schemas e pool de conexões complicam.
3. **Banco e schema compartilhados, coluna `barbearia_id`:** simples, barato e fácil de migrar; o risco é vazar dados por uma consulta sem filtro.

## Decisão

Opção 3, com defesa em camadas:

- PostgreSQL único; toda tabela de negócio tem `barbearia_id NOT NULL` e índices que começam por ela.
- **Row-Level Security (RLS)** no PostgreSQL: a API define o tenant da requisição na sessão do banco e as políticas impedem ler ou gravar outro tenant, mesmo com erro no código.
- Na API (Fastify, [ADR 0008](0008-workspace-javascript-com-fastify.md)), o tenant vem do token do usuário (ou do slug, na página pública) e é aplicado por um contexto de requisição; nenhum serviço recebe `barbearia_id` vindo do corpo da requisição.
- Testes automatizados que tentam acessar dados de outro tenant e devem falhar.
- Tabelas globais (planos do SaaS, catálogo de permissões) ficam fora do RLS e são acessadas só pelo super admin.
- Se uma barbearia grande exigir isolamento físico, ela poderá ser migrada para banco próprio no futuro, sem mudar o modelo de dados.

## Consequências

- Custo de infraestrutura baixo e um único fluxo de migrações.
- Exige disciplina: RLS ativo em toda tabela nova (checado em revisão e em teste).
- Relatórios da plataforma (super admin) usam um papel de banco que ignora RLS, com auditoria.

## Pontos em aberto

- ORM e ferramenta de migrações (ADR futuro, junto com a stack).
- Usuário em várias barbearias: tabela de vínculo usuário × barbearia × papel.
- Unidades: `unidade_id` abaixo de `barbearia_id` nas tabelas operacionais.
