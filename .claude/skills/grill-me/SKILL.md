---
name: grill-me
description: Entrevista Weslen antes de implementar qualquer feature, tela ou mudança não trivial, para fechar requisitos e evitar retrabalho.
---

# Grill Me — entrevista antes de codar

Nenhuma linha de código antes de o problema estar claro.

## Quando ativar
- Feature, tela ou módulo novo (agendamento, comissão, contratos, atendimento)
- Pedido vago ou com termos ambíguos
- Mudança de arquitetura
- NÃO ativar para correções pontuais claras

## Como conduzir
1. Resuma em 2-3 linhas o que entendeu.
2. Perguntas em rodadas de no máximo 4, priorizando as que mudam o desenho:
   - Quem usa (barbeiro, recepção, cliente, dono) e qual problema resolve?
   - Regras e casos-limite (horário ocupado, cancelamento, no-show, permissão)
   - Dados: origem, armazenamento, LGPD?
   - Integrações e restrições técnicas
   - Critério de pronto
3. Quando houver padrão razoável, proponha e peça só confirmação.
4. Pare quando as respostas não mudarem mais o plano.

## Saída: mini-spec
- Objetivo
- Escopo (dentro / fora)
- Regras e casos-limite
- Decisões tomadas (candidatas a ADR em `docs/adr/`)
- Critérios de aceite
- Plano em passos pequenos

Só implemente depois que Weslen aprovar o mini-spec.
