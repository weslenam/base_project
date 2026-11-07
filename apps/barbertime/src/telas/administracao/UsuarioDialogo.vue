<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsEscolha,
  DsFormulario,
  DsInput,
  DsSelect,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { administracao } from '../../dados/administracao.js';
import { useAcao } from '../../dados/useAcao.js';

const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({
  /** null = convidar novo */
  usuario: { type: Object, default: null },
  papeis: { type: Array, default: () => [] },
  eu: { type: Number, default: null },
});
const emit = defineEmits(['salvo']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const form = ref({});
const novo = computed(() => !props.usuario);
const souEu = computed(() => props.usuario?.id === props.eu);
const opcoesPapeis = computed(() =>
  props.papeis.map((p) => ({ valor: p.id, rotulo: p.nome })),
);
const situacoes = [
  { valor: true, rotulo: 'Ativo' },
  { valor: false, rotulo: 'Desativado' },
];

watch(aberto, (abriu) => {
  if (!abriu) return;
  form.value = props.usuario
    ? { papelId: props.usuario.papelId, ativo: props.usuario.ativo }
    : { nome: '', email: '', senha: '', papelId: null };
});

async function salvar() {
  const feito = await executar(() =>
    novo.value
      ? administracao.usuarios.convidar(form.value)
      : administracao.usuarios.alterar(props.usuario.id, form.value),
  );
  if (!feito) return;
  notificar.sucesso(
    novo.value ? `${feito.nome} agora tem acesso.` : 'Acesso atualizado.',
  );
  aberto.value = false;
  emit('salvo');
}

async function remover() {
  const ok = await confirmar(
    `Remover o acesso de ${props.usuario.nome} a esta barbearia?`,
    {
      perigo: true,
      textoOk: 'Remover acesso',
      textoCancelar: 'Manter',
    },
  );
  if (!ok) return;
  const feito = await executar(
    async () => (await administracao.usuarios.remover(props.usuario.id), true),
  );
  if (!feito) return;
  notificar.sucesso('Acesso removido.');
  aberto.value = false;
  emit('salvo');
}
</script>

<template>
  <DsDialogo
    v-model="aberto"
    :titulo="novo ? 'Convidar usuário' : usuario.nome"
    largura="sm"
    fechavel
  >
    <p v-if="souEu" class="ds-corpo-sm ds-suave">
      Este é o seu acesso. Peça a outro dono para alterá-lo.
    </p>
    <DsFormulario v-else id="form-usuario" @enviar="salvar">
      <template v-if="novo">
        <DsInput v-model="form.nome" rotulo="Nome" obrigatorio />
        <DsInput
          v-model="form.email"
          tipo="email"
          rotulo="E-mail"
          obrigatorio
        />
        <DsInput
          v-model="form.senha"
          tipo="senha"
          rotulo="Senha provisória"
          ajuda="Passe para a pessoa; se o e-mail já tiver conta, ela é mantida"
        />
      </template>
      <p v-else class="ds-valor ds-suave">{{ usuario.email }}</p>
      <DsSelect
        v-model="form.papelId"
        rotulo="Papel"
        :opcoes="opcoesPapeis"
        obrigatorio
      />
      <DsEscolha
        v-if="!novo"
        v-model="form.ativo"
        :opcoes="situacoes"
        rotulo="Acesso"
      />
    </DsFormulario>
    <template v-if="!souEu" #acoes>
      <DsBotao
        v-if="!novo"
        variante="perigo"
        class="acao-remover"
        @click="remover"
      >
        Remover acesso
      </DsBotao>
      <DsBotao formulario="form-usuario">{{
        novo ? 'Convidar' : 'Salvar'
      }}</DsBotao>
    </template>
  </DsDialogo>
</template>

<style scoped>
.acao-remover {
  margin-inline-end: auto;
}
</style>
