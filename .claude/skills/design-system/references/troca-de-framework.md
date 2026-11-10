# Troca de framework: alias, contrato e lint

> **Nota (ADR 0007):** os exemplos de código abaixo foram escritos para o Quasar, que foi substituído pelo Vuetify. Os princípios do contrato continuam valendo; para código atual, use como referência as implementações reais em `libs/ui-vuetify/src/`.


## Duas implementações lado a lado (em vez de fork)

Um fork diverge com o tempo. Manter `ui-quasar` e `ui-vuetify` no mesmo workspace, com a mesma API, e escolher por alias.

```js
// apps/barbertime/vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const ui = process.env.UI_IMPL || 'quasar'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@barbertime/ui': fileURLToPath(new URL(`../../libs/ui-${ui}/src/index.ts`, import.meta.url))
    }
  }
})
```

Rodar com outra implementação: `UI_IMPL=vuetify nx serve barbertime`.

Se o Quasar for usado via `@quasar/vite-plugin`, carregar o plugin só quando `ui === 'quasar'` (e o equivalente `vite-plugin-vuetify` quando `ui === 'vuetify'`).

## Testes de contrato (libs/ui-contrato)

Um conjunto único de testes (Vitest + Vue Test Utils), exportado como funções que recebem o componente. Cada implementação chama essas funções com o próprio componente e sua função de montagem (que instala o framework correspondente).

```js
// libs/ui-contrato/src/DsBotao.contrato.js
import { it, expect } from 'vitest'

export function testarDsBotao(DsBotao, montar) {
  it('renderiza o conteúdo do slot', () => {
    const w = montar(DsBotao, { slots: { default: 'Salvar' } })
    expect(w.text()).toContain('Salvar')
  })

  it('emite click', async () => {
    const w = montar(DsBotao, { slots: { default: 'Salvar' } })
    await w.find('button').trigger('click')
    expect(w.emitted('click')).toBeTruthy()
  })

  it('não emite click quando desabilitado', async () => {
    const w = montar(DsBotao, { props: { desabilitado: true } })
    await w.find('button').trigger('click')
    expect(w.emitted('click')).toBeFalsy()
  })
}
```

```js
// libs/ui-quasar/src/componentes/DsBotao.spec.js
import { describe } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import { testarDsBotao } from '@barbertime/ui-contrato'
import DsBotao from './DsBotao.vue'

const montar = (c, opcoes = {}) => mount(c, { ...opcoes, global: { plugins: [Quasar] } })

describe('DsBotao (Quasar)', () => testarDsBotao(DsBotao, montar))
```

Testar comportamento observável (texto, eventos emitidos, valor do v-model, validação), nunca classes internas do framework. Se a versão Vuetify passar em todos os testes de contrato, a troca é segura.

## Lint de fronteira

Impedir que telas importem o framework diretamente. Na configuração ESLint dos apps:

```js
// apps/barbertime/eslint.config.js (trecho)
{
  files: ['src/**/*.{js,vue}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['quasar', 'quasar/*', '@quasar/*'], message: 'Use @barbertime/ui.' },
        { group: ['vuetify', 'vuetify/*'], message: 'Use @barbertime/ui.' },
        { group: ['primevue', 'primevue/*'], message: 'Use @barbertime/ui.' },
        { group: ['@barbertime/ui-quasar', '@barbertime/ui-vuetify'], message: 'Importe @barbertime/ui (o alias escolhe a implementação).' }
      ]
    }]
  }
}
```

Também vale uma checagem simples (CI ou revisão) procurando classes utilitárias do Quasar nas telas: `grep -rE 'q-(pa|ma|px|py|mt|mb)-|class="row|col-[0-9]' apps/*/src`.

## Passo a passo para testar Vuetify

1. Criar `libs/ui-vuetify` com a mesma estrutura e o mesmo `index.ts` (mesmos nomes exportados).
2. Implementar `instalarUi` com `createVuetify`, mapeando os tokens para o tema do Vuetify.
3. Reimplementar cada `Ds*` e composable (ex.: `useNotificacao` sobre um snackbar global; `useConfirmacao` sobre um VDialog montado por um serviço).
4. Ligar os testes de contrato à implementação Vuetify e fazê-los passar.
5. Subir o app com `UI_IMPL=vuetify` e comparar visualmente.

Se as regras do contrato foram respeitadas, nenhuma tela muda nesse processo.
