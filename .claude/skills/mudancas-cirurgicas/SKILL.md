---
name: mudancas-cirurgicas
description: Diretrizes de simplicidade e mudanças mínimas ao editar código existente. Use sempre que for alterar código.
---

# Mudanças cirúrgicas

Inspirado nas ideias de Andrej Karpathy: pensar antes, mudar pouco, verificar sempre.

## Antes de editar
- Leia o trecho e quem o chama. Entenda o porquê do código atual.
- Declare em 1-3 linhas: causa, o que vai mudar e o que NÃO vai mudar.
- Se houver mais de uma abordagem, apresente a mais simples primeiro.

## Durante
- Altere o mínimo necessário. Nada de refatorar, renomear ou reformatar fora do escopo.
- Preserve estilo, nomes e padrões do arquivo.
- Não adicione dependências sem perguntar.
- TypeScript `strict` (ADR 0022): código novo em `.ts` ou `<script setup lang="ts">`, só sintaxe apagável (sem `enum`/`namespace`). Durante a conversão (planejamento 0040), não converter arquivo fora do escopo da tarefa.
- Use os componentes Ds* do design system, nunca a biblioteca de UI (Vuetify, ADR 0007) direto nas telas.
- Se notar outros problemas, anote ao final em vez de corrigir.

## Depois
- Mostre o diff resumido e explique cada parte.
- Diga como verificar: teste, lint, build (`pnpm nx test`, `pnpm nx lint`, `pnpm verificar`) ou passo manual.
- Se não deu para verificar, diga claramente.

## Sinais de alerta (pare e pergunte)
- Mais de ~50 linhas ou 3 arquivos para um ajuste pequeno
- Mexer em banco, migrations ou dados de clientes (LGPD)
- Mudar contrato público (API, componente Ds*, lib compartilhada)
