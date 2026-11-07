# Exceções: trazer um componente de outra biblioteca

> **Nota (ADR 0007):** os exemplos de código abaixo foram escritos para o Quasar, que foi substituído pelo Vuetify. Os princípios do contrato continuam valendo; para código atual, use como referência as implementações reais em `libs/ui-vuetify/src/`.


Regra geral: Quasar como base quase completa + ApexCharts. Não misturar outra suíte completa.

## Quando abrir exceção

Só quando surgir uma necessidade real que o Quasar não atende bem, por exemplo:
- TreeTable (tabela hierárquica com expansão)
- Organograma (OrganizationChart)
- DataTable com recursos avançados de planilha: colunas congeladas, agrupamento de linhas, filtro por coluna em menu

Antes, confirmar que não dá para resolver com QTable/QTree + customização razoável.

## Como trazer (ex.: PrimeVue)

1. **Modo unstyled**, sem tema do PrimeVue; estilizar com nossos tokens.
2. **Importar só o componente** (`primevue/treetable`), nunca a lib inteira.
3. **Ajustar z-index** para ficar coerente com os overlays do Quasar.
4. **Esconder atrás de um Ds*** (`DsArvoreTabela`), com API em português e teste de contrato como qualquer outro.

```js
// dentro de instalarUi, só se a exceção existir
import PrimeVue from 'primevue/config'

app.use(PrimeVue, {
  unstyled: true,
  zIndex: { overlay: 6000, modal: 6100 }
})
```

## Riscos a lembrar

- CSS global do Quasar x estilos do outro framework.
- Overlays: select de uma lib dentro de diálogo da outra pode abrir atrás ou não fechar ao clicar fora.
- Duas configurações de idioma (meses, "nenhum resultado").
- Tema duplicado: mais um mapeamento de tokens para manter.
- Bundle maior e mais um changelog para acompanhar.
