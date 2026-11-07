# ADRs (Architecture Decision Records)

Decisões arquiteturais duradouras. O trabalho do dia a dia fica em `docs/planejamentos/`.

| Nº                                                             | Decisão                                                              | Status                |
| -------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------- |
| [0001](0001-saas-multi-tenant.md)                              | SaaS multi-tenant com banco compartilhado e isolamento por barbearia | Aceito                |
| [0002](0002-docker-no-desenvolvimento.md)                      | Ambiente de desenvolvimento com WSL 2 e Docker                       | Aceito                |
| [0003](0003-identidade-visual-e-tokens.md)                     | Identidade visual industrial-urbana e tokens como fonte única        | Aceito                |
| [0006](0006-preferencias-na-sessao-sincronizadas-com-banco.md) | Preferências na sessão, sincronizadas com o banco                    | Aceito (reconstruído) |
| [0007](0007-vuetify-substitui-quasar.md)                       | Vuetify substitui o Quasar                                           | Aceito (reconstruído) |
| [0008](0008-workspace-javascript-com-fastify.md)               | Workspace em JavaScript puro com API Fastify                         | Aceito                |

**Números 0004 e 0005:** livres. Os ADRs 0006 e 0007 mantêm os números do protótipo Agenda porque as regras e skills do repositório os citam assim. Eles foram **reconstruídos** a partir dessas regras, já que o texto original não veio junto. O próximo ADR novo é o 0009.

## Modelo

```markdown
# ADR NNNN: <título>

- **Status:** Proposto | Aceito | Substituído pelo NNNN
- **Data:** AAAA-MM-DD
- **Relacionado:** ...

## Contexto

## Decisão

## Consequências
```
