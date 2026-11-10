# Composables wrapper e instalação da lib

> **Nota (ADR 0007):** os exemplos de código abaixo foram escritos para o Quasar, que foi substituído pelo Vuetify. Os princípios do contrato continuam valendo; para código atual, use como referência as implementações reais em `libs/ui-vuetify/src/`.


Plugins e composables do framework (Notify, Dialog, Loading, useQuasar) ficam atrás de composables nossos. As telas nunca chamam `$q` diretamente.

## useNotificacao

```js
// libs/ui-quasar/src/composables/useNotificacao.js
import { useQuasar } from 'quasar'

export function useNotificacao() {
  const $q = useQuasar()
  const base = { position: 'top-right', timeout: 3000 }

  return {
    sucesso: (mensagem) => $q.notify({ ...base, type: 'positive', message: mensagem }),
    erro: (mensagem) => $q.notify({ ...base, type: 'negative', message: mensagem, timeout: 5000 }),
    aviso: (mensagem) => $q.notify({ ...base, type: 'warning', message: mensagem }),
    info: (mensagem) => $q.notify({ ...base, type: 'info', message: mensagem })
  }
}
```

## useConfirmacao — callbacks viram Promise

```js
// libs/ui-quasar/src/composables/useConfirmacao.js
import { useQuasar } from 'quasar'

export function useConfirmacao() {
  const $q = useQuasar()

  return (mensagem, { titulo = 'Confirmação', textoOk = 'Confirmar', textoCancelar = 'Cancelar' } = {}) =>
    new Promise((resolve) => {
      $q.dialog({
        title: titulo,
        message: mensagem,
        cancel: { label: textoCancelar, flat: true },
        ok: { label: textoOk },
        persistent: true
      })
        .onOk(() => resolve(true))
        .onCancel(() => resolve(false))
    })
}
```

Uso:

```js
const confirmar = useConfirmacao()
const notificar = useNotificacao()

async function excluir(cliente) {
  if (!(await confirmar(`Excluir ${cliente.nome}?`))) return
  await api.excluir(cliente.id)
  notificar.sucesso('Cliente excluído')
}
```

## useCarregando

```js
import { useQuasar } from 'quasar'

export function useCarregando() {
  const $q = useQuasar()
  return {
    mostrar: (mensagem = 'Carregando...') => $q.loading.show({ message: mensagem }),
    esconder: () => $q.loading.hide(),
    async durante(promessa, mensagem) {
      $q.loading.show({ message: mensagem })
      try { return await promessa } finally { $q.loading.hide() }
    }
  }
}
```

## Cuidado: só dentro do setup

`useQuasar()` só funciona dentro do `setup` de um componente. Logo, nossos composables também precisam ser chamados no `setup` (no topo do `<script setup>`), nunca dentro de funções soltas, stores fora de contexto ou interceptors do Axios. Para notificar a partir de código fora de componente (ex.: interceptor de erro HTTP), exporte uma versão baseada no plugin global (`Notify.create`) dentro da lib, por exemplo `notificarGlobal.erro(msg)`, mantendo o mesmo contrato.

## instalarUi — porta de entrada da lib

```js
// libs/ui-quasar/src/instalarUi.ts
import { Quasar, Notify, Dialog, Loading, setCssVar } from 'quasar'
import quasarLang from 'quasar/lang/pt-BR'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/dist/quasar.css'
import '@barbertime/ui-tokens/tokens.css'

export function instalarUi(app) {
  app.use(Quasar, {
    plugins: { Notify, Dialog, Loading },
    lang: quasarLang
  })

  // Alimenta as cores de marca do Quasar a partir dos nossos tokens
  const estilo = getComputedStyle(document.documentElement)
  for (const [quasar, token] of [
    ['primary', '--cor-primaria'],
    ['secondary', '--cor-secundaria'],
    ['negative', '--cor-perigo'],
    ['positive', '--cor-sucesso']
  ]) {
    const valor = estilo.getPropertyValue(token).trim()
    if (valor) setCssVar(quasar, valor)
  }
}
```

```js
// libs/ui-quasar/src/index.ts
export { instalarUi } from './instalarUi.ts'
export { default as DsBotao } from './componentes/DsBotao.vue'
export { default as DsInput } from './componentes/DsInput.vue'
export { default as DsInputCnpj } from './componentes/DsInputCnpj.vue'
export { default as DsTabela } from './componentes/DsTabela.vue'
export { useNotificacao } from './composables/useNotificacao.js'
export { useConfirmacao } from './composables/useConfirmacao.js'
export { useCarregando } from './composables/useCarregando.js'
```

```js
// apps/barbertime/src/main.js
import { createApp } from 'vue'
import { instalarUi } from '@barbertime/ui'
import App from './App.vue'

const app = createApp(App)
instalarUi(app)
app.mount('#app')
```
