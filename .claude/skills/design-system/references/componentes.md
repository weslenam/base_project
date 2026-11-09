# Componentes Ds\* — exemplos de referência

> **Nota (ADR 0007):** os exemplos de código abaixo foram escritos para o Quasar, que foi substituído pelo Vuetify. Os princípios do contrato continuam valendo; para código atual, use como referência as implementações reais em `libs/ui-vuetify/src/`.
>
> **Tokens reais (ADR 0003):** gerados de `docs/identidade-visual/tokens.json` por `pnpm nx run ui-tokens:gerar`. A variável tem o nome do token (`--cobre`, `--esp-4`, `--raio-sm`, `--tipo-titulo`), e o tema escuro usa `[data-theme='dark']`. Os nomes `--cor-*`/`--espaco-*` abaixo são só ilustrativos.

## Tokens (libs/ui-tokens/src/tokens.css)

```css
:root {
  --cor-primaria: #1f6feb;
  --cor-secundaria: #6e7781;
  --cor-perigo: #cf222e;
  --cor-sucesso: #1a7f37;
  --cor-fundo: #ffffff;
  --cor-superficie: #f6f8fa;
  --cor-texto: #1f2328;
  --cor-texto-invertido: #ffffff;
  --cor-borda: #d0d7de;

  --espaco-xs: 4px;
  --espaco-sm: 8px;
  --espaco-md: 16px;
  --espaco-lg: 24px;

  --raio-sm: 4px;
  --raio-md: 8px;
  --sombra-md: 0 2px 8px rgb(0 0 0 / 0.08);
  --fonte-base: 'Inter', system-ui, sans-serif;
}

:root[data-tema='escuro'] {
  --cor-fundo: #0d1117;
  --cor-superficie: #161b22;
  --cor-texto: #e6edf3;
  --cor-borda: #30363d;
}
```

As cores de marca do Quasar são alimentadas a partir destes tokens em `instalarUi` (ver composables.md), para que componentes internos do Quasar também respeitem a identidade.

## DsBotao

```vue
<script setup>
import { QBtn } from 'quasar';

defineProps({
  variante: { type: String, default: 'primario' }, // primario | secundario | perigo
  tamanho: { type: String, default: 'md' }, // sm | md | lg
  desabilitado: Boolean,
  carregando: Boolean,
});
const emit = defineEmits(['click']);
</script>

<template>
  <QBtn
    unelevated
    no-caps
    :disable="desabilitado"
    :loading="carregando"
    :class="['ds-botao', `ds-botao--${variante}`, `ds-botao--${tamanho}`]"
    @click="emit('click', $event)"
  >
    <slot />
  </QBtn>
</template>

<style scoped>
.ds-botao {
  border-radius: var(--raio-md);
  font-family: var(--fonte-base);
}
.ds-botao--primario {
  background: var(--cor-primaria);
  color: var(--cor-texto-invertido);
}
.ds-botao--secundario {
  background: transparent;
  color: var(--cor-primaria);
  border: 1px solid var(--cor-borda);
}
.ds-botao--perigo {
  background: var(--cor-perigo);
  color: var(--cor-texto-invertido);
}
.ds-botao--sm {
  padding: var(--espaco-xs) var(--espaco-sm);
}
.ds-botao--md {
  padding: var(--espaco-sm) var(--espaco-md);
}
.ds-botao--lg {
  padding: var(--espaco-md) var(--espaco-lg);
}
</style>
```

## DsTabela — slot no formato do contrato

```vue
<script setup>
import { computed } from 'vue';
import { QTable, QTd } from 'quasar';

const props = defineProps({
  linhas: { type: Array, default: () => [] },
  colunas: { type: Array, required: true }, // [{ campo, titulo, alinhamento?, formatar? }]
  carregando: Boolean,
  chave: { type: String, default: 'id' },
});
const emit = defineEmits(['selecionar']);

const colunasQuasar = computed(() =>
  props.colunas.map((c) => ({
    name: c.campo,
    field: c.campo,
    label: c.titulo,
    align: c.alinhamento || 'left',
    format: c.formatar,
  })),
);
</script>

<template>
  <QTable
    flat
    class="ds-tabela"
    :rows="linhas"
    :columns="colunasQuasar"
    :row-key="chave"
    :loading="carregando"
    no-data-label="Nenhum registro encontrado"
    loading-label="Carregando..."
    rows-per-page-label="Registros por página"
    @row-click="(_, linha) => emit('selecionar', linha)"
  >
    <!-- Slot nosso: célula customizada por campo, com dados no NOSSO formato -->
    <template v-for="c in colunas" :key="c.campo" #[`body-cell-${c.campo}`]="p">
      <QTd :props="p">
        <slot
          :name="`celula-${c.campo}`"
          :linha="p.row"
          :coluna="c"
          :valor="p.value"
        >
          {{ p.value }}
        </slot>
      </QTd>
    </template>
  </QTable>
</template>
```

Uso na tela (repare: nenhum conceito do Quasar aparece):

```vue
<DsTabela :linhas="clientes" :colunas="colunas" @selecionar="abrir">
  <template #celula-saldo="{ valor }">{{ formatarMoeda(valor) }}</template>
</DsTabela>
```

## DsInputCnpj — regra de negócio embutida

```vue
<script setup>
import { computed } from 'vue';
import { QInput } from 'quasar';
import { validarCnpj } from '@barbertime/ui-utils';

const modelo = defineModel({ type: String, default: '' }); // sempre só dígitos
defineProps({
  rotulo: { type: String, default: 'CNPJ' },
  obrigatorio: Boolean,
});

const regras = computed(() => [(v) => !v || validarCnpj(v) || 'CNPJ inválido']);
</script>

<template>
  <QInput
    v-model="modelo"
    outlined
    unmasked-value
    mask="##.###.###/####-##"
    :label="rotulo"
    :rules="
      obrigatorio ? [(v) => !!v || 'Campo obrigatório', ...regras] : regras
    "
    class="ds-input"
  />
</template>
```

O valor do modelo é sempre só dígitos; a máscara é detalhe de apresentação. Em outra implementação (Vuetify), o contrato continua: entra e sai string de dígitos, valida CNPJ, mostra máscara.
