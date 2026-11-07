<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsCaixaDeSelecao,
  DsDialogo,
  DsFormulario,
  DsInput,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { permissoesPorGrupo } from '@barbertime/dominio';
import { administracao } from '../../dados/administracao.js';
import { useAcao } from '../../dados/useAcao.js';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({ papel: { type: Object, default: null } });
const emit = defineEmits(['salvo']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const nome = ref('');
const marcadas = ref(new Set());
const grupos = permissoesPorGrupo();
const novo = computed(() => !props.papel);
const somenteLeitura = computed(() => Boolean(props.papel?.protegido));

watch(aberto, (abriu) => {
  if (!abriu) return;
  nome.value = props.papel?.nome ?? '';
  marcadas.value = new Set(props.papel?.permissoes ?? []);
});

function alternar(chave, valor) {
  const copia = new Set(marcadas.value);
  if (valor) copia.add(chave);
  else copia.delete(chave);
  marcadas.value = copia;
}

async function salvar() {
  const dados = { nome: nome.value, permissoes: [...marcadas.value] };
  const feito = await executar(() =>
    novo.value
      ? administracao.papeis.criar(dados)
      : administracao.papeis.alterar(props.papel.id, dados),
  );
  if (!feito) return;
  notificar.sucesso(
    novo.value ? `Papel ${feito.nome} criado.` : 'Papel atualizado.',
  );
  aberto.value = false;
  emit('salvo');
}

async function excluir() {
  const ok = await confirmar(`Excluir o papel ${props.papel.nome}?`, {
    perigo: true,
    textoOk: 'Excluir',
    textoCancelar: 'Manter',
  });
  if (!ok) return;
  const feito = await executar(
    async () => (await administracao.papeis.excluir(props.papel.id), true),
  );
  if (!feito) return;
  notificar.sucesso('Papel excluído.');
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="novo ? 'Novo papel' : `Papel ${papel.nome}`"
    largura="lg"
    fechavel
  >
    <DsFormulario id="form-papel" @enviar="salvar">
      <DsInput
        v-model="nome"
        rotulo="Nome do papel"
        obrigatorio
        :desabilitado="somenteLeitura"
      />
      <p v-if="somenteLeitura" class="ds-corpo-sm ds-suave">
        O papel Dono tem todas as permissões e não pode ser alterado.
      </p>
      <div class="grupos">
        <fieldset v-for="g in grupos" :key="g.grupo" class="grupo">
          <legend class="ds-rotulo">{{ g.grupo }}</legend>
          <DsCaixaDeSelecao
            v-for="p in g.permissoes"
            :key="p.chave"
            :model-value="marcadas.has(p.chave)"
            :rotulo="p.descricao"
            :descricao="p.modulo ? 'Vale só com o módulo ativo' : ''"
            :desabilitado="somenteLeitura"
            @update:model-value="(v) => alternar(p.chave, v)"
          />
        </fieldset>
      </div>
    </DsFormulario>
    <template v-if="!somenteLeitura" #acoes>
      <DsBotao
        v-if="!novo"
        variante="perigo"
        class="acao-excluir"
        @click="excluir"
        >Excluir</DsBotao
      >
      <DsBotao formulario="form-papel">Salvar</DsBotao>
    </template>
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
.acao-excluir {
  margin-inline-end: auto;
}
</style>
