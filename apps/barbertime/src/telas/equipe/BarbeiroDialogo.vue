<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PropType } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsFormulario,
  DsInput,
  DsSelect,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';
import type { OpcaoDeSelect } from '@barbertime/ui';

/** Barbeiro no formulário (o novo ainda não tem id). */
interface FormularioDoBarbeiro {
  id?: number;
  nome: string;
  inicio: string;
  fim: string;
  comissao: number | string;
  usuarioId: number | null;
}

const aberto = defineModel<boolean>({ default: false });
const props = defineProps({
  id: { type: Number as PropType<number | null>, default: null },
});
const emit = defineEmits(['salvo']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();
const form = ref<FormularioDoBarbeiro>({
  nome: '',
  inicio: '09:00',
  fim: '18:00',
  comissao: 40,
  usuarioId: null,
});
const contas = ref<OpcaoDeSelect[]>([]);
const editando = computed(() => Boolean(props.id));

const regraComissao = (v: unknown) =>
  (v !== '' && Number(v) >= 0 && Number(v) <= 100) || 'Entre 0 e 100';

watch(aberto, async (abriu) => {
  if (!abriu) return;
  const [equipe, lista] = await Promise.all([
    api.barbeiros.listar(),
    api.barbeiros.contas().catch(() => []),
  ]);
  contas.value = lista.map((u) => ({
    valor: u.id,
    rotulo: `${u.nome} (${u.email})`,
  }));
  const atual = equipe.find((b) => b.id === props.id);
  form.value = atual
    ? { ...atual }
    : {
        nome: '',
        inicio: '09:00',
        fim: '18:00',
        comissao: 40,
        usuarioId: null,
      };
});

async function salvar() {
  const salvo = await executar(() =>
    api.barbeiros.salvar({
      ...form.value,
      comissao: Number(form.value.comissao),
    }),
  );
  if (!salvo) return;
  notificar.sucesso(
    editando.value ? 'Cadastro atualizado.' : `${salvo.nome} entrou na equipe.`,
  );
  aberto.value = false;
  emit('salvo');
}

async function excluir() {
  const id = props.id;
  if (id === null) return;
  const ok = await confirmar(`Tirar ${form.value.nome} da equipe?`, {
    perigo: true,
    textoOk: 'Tirar da equipe',
    textoCancelar: 'Manter',
  });
  if (!ok) return;
  const feito = await executar(
    async () => (await api.barbeiros.excluir(id), true),
  );
  if (!feito) return;
  notificar.sucesso('Barbeiro removido da equipe.');
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="editando ? 'Editar barbeiro' : 'Novo barbeiro'"
    largura="sm"
  >
    <DsFormulario id="form-barbeiro" @enviar="salvar">
      <DsInput v-model="form.nome" rotulo="Nome" obrigatorio />
      <div class="horas">
        <DsInput
          v-model="form.inicio"
          tipo="hora"
          rotulo="Início do expediente"
          obrigatorio
        />
        <DsInput
          v-model="form.fim"
          tipo="hora"
          rotulo="Fim do expediente"
          obrigatorio
        />
      </div>
      <DsInput
        v-model="form.comissao"
        tipo="numero"
        rotulo="Comissão (%)"
        ajuda="Sobre os serviços que ele realiza"
        :regras="[regraComissao]"
        obrigatorio
      />
      <DsSelect
        v-model="form.usuarioId"
        rotulo="Conta de acesso"
        :opcoes="contas"
        ajuda="Com a conta ligada, ele vê a própria agenda ao entrar"
        limpavel
      />
    </DsFormulario>
    <template #acoes>
      <DsBotao
        v-if="editando"
        variante="perigo"
        class="acao-excluir"
        @click="excluir"
      >
        Tirar da equipe
      </DsBotao>
      <DsBotao variante="secundario" @click="aberto = false">Cancelar</DsBotao>
      <DsBotao formulario="form-barbeiro">Salvar</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.horas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--esp-3);
}
.acao-excluir {
  margin-inline-end: auto;
}
</style>
