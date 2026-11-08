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
const senhaProvisoria = ref('');
const definindoSenha = ref(false);
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
  senhaProvisoria.value = '';
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

/** Quem esqueceu a senha: o Dono define uma provisória (planejamento 0017). */
async function definirSenha() {
  if (senhaProvisoria.value.length < 8) {
    notificar.aviso('A senha provisória precisa ter pelo menos 8 caracteres.');
    return;
  }
  definindoSenha.value = true;
  const feito = await executar(() =>
    administracao.usuarios.definirSenha(
      props.usuario.id,
      senhaProvisoria.value,
    ),
  );
  definindoSenha.value = false;
  if (!feito) return;
  senhaProvisoria.value = '';
  notificar.sucesso(
    `Senha provisória definida. Passe para ${props.usuario.nome}; ela pode trocar em Meu perfil.`,
  );
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
      Este é o seu acesso. Peça a outro dono para alterá-lo. Para trocar a sua
      senha, use Meu perfil.
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
    <section v-if="!novo && !souEu" class="senha" aria-label="Senha provisória">
      <p class="ds-rotulo">Esqueceu a senha?</p>
      <div class="senha__linha">
        <DsInput
          v-model="senhaProvisoria"
          tipo="senha"
          rotulo="Nova senha provisória"
          ajuda="As sessões abertas dessa pessoa são encerradas"
        />
        <DsBotao
          variante="secundario"
          :carregando="definindoSenha"
          @click="definirSenha"
        >
          Definir senha
        </DsBotao>
      </div>
    </section>
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
.senha {
  display: grid;
  gap: var(--esp-2);
  margin-top: var(--esp-3);
  padding-top: var(--esp-3);
  border-top: 1px solid var(--linha);
}
.senha p {
  margin: 0;
}
.senha__linha {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--esp-2);
}
.acao-remover {
  margin-inline-end: auto;
}
</style>
