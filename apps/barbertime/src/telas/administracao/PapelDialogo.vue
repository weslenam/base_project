<script setup>
import { computed } from 'vue';
import { DsCaixaDeSelecao, DsDialogo } from '@barbertime/ui';
import { permissoesPorGrupo } from '@barbertime/dominio';

// Hierarquia fixa (ADR 0010, planejamento 0023): papéis só para leitura.
const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ papel: { type: Object, default: null } });

const grupos = permissoesPorGrupo();
const tem = computed(() => new Set(props.papel?.permissoes ?? []));
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="papel ? `Papel ${papel.nome}` : ''"
    largura="lg"
    fechavel
  >
    <p class="ds-corpo-sm ds-suave">
      Os papéis são fixos e seguem a hierarquia Dono, Gerente, Recepção e
      Barbeiro. Cada um só altera o acesso de quem está abaixo dele.
    </p>
    <div class="grupos">
      <fieldset v-for="g in grupos" :key="g.grupo" class="grupo">
        <legend class="ds-rotulo">{{ g.grupo }}</legend>
        <DsCaixaDeSelecao
          v-for="p in g.permissoes"
          :key="p.chave"
          :model-value="tem.has(p.chave)"
          :rotulo="p.descricao"
          :descricao="p.modulo ? 'Vale só com o módulo ativo' : ''"
          desabilitado
        />
      </fieldset>
    </div>
  </DsDialogo>
</template>

<style scoped>
.grupos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: var(--esp-2) var(--esp-6);
}
.grupo {
  margin: 0;
  padding: 0;
  border: 0;
}
.grupo legend {
  padding: 0;
  margin-bottom: var(--esp-1);
}
</style>
