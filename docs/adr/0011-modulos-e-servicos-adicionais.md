# ADR 0011: Módulos por barbearia e serviços adicionais (ex.: gateway de pagamento)

- **Status:** Aceito
- **Data:** 2026-11-07
- **Relacionado:** ADRs 0001 e 0010; planejamento 0013; definição do produto (planos e diferenciais)

## Contexto

O produto tem funcionalidades que nem toda barbearia usa ou paga: gateway de pagamento, WhatsApp, NFS-e, fidelidade e pacotes. O gateway, em particular, deve ser um **serviço adicional**, contratado à parte.

## Decisão

- **Catálogo fechado de módulos** em `@barbertime/dominio`. Cada módulo tem `chave`, `nome`, `descricao`, `tipo` e as `permissoes` que traz.
  - `tipo: 'incluso'`: faz parte do plano, e a barbearia ativa e desativa à vontade.
  - `tipo: 'adicional'`: serviço contratado. A barbearia **solicita**, e o módulo só fica **ativo** depois de a contratação ser confirmada. Por ora a confirmação é manual (super admin); no futuro, vem da cobrança do SaaS.
- **Estado por barbearia** em `barbearia_modulos` (com RLS): `inativo`, `solicitado` ou `ativo`, mais as datas.
- **Na API:** `exigirModulo('chave')` recusa com 403 ("O módulo X não está ativo nesta barbearia").
- **No front:** o menu e as telas de um módulo aparecem só quando ele está ativo; os adicionais aparecem na tela Módulos com a opção de solicitar.
- **Gateway de pagamento** (módulo `pagamentos_online`, adicional): fica atrás de uma interface de provedor no backend (`criarCobranca`, `consultarCobranca`, `tratarWebhook`), com um provedor `simulado` para desenvolvimento. O provedor real (Asaas, Mercado Pago, Pagar.me...) será escolhido em ADR próprio, e as credenciais de cada barbearia ficarão cifradas.

## Consequências

- Uma funcionalidade opcional nova nasce como módulo do catálogo.
- O plano do SaaS (Solo, Equipe, Pro, Rede) poderá definir quais módulos vêm inclusos, sem mudar este modelo.

## Catálogo atual

| Módulo                                                                                            | Tipo      | Desde             |
| ------------------------------------------------------------------------------------------------- | --------- | ----------------- |
| Agendamento online, Comissões, Lembretes por e-mail                                               | incluso   | planejamento 0013 |
| Pagamento online (gateway), WhatsApp, Nota fiscal (NFS-e)                                         | adicional | planejamento 0013 |
| Fidelidade (selos e/ou cashback), Pacotes (por quantidade ou livres; recorrentes ou com validade) | adicional | planejamento 0015 |
