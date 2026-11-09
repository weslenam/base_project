<script setup>
import { computed, ref, watch } from 'vue';
import {
  DsBotao,
  DsDialogo,
  DsEscolha,
  DsFormulario,
  DsInput,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import {
  historiaDoPapel,
  podeAgirSobre,
  resumoDoPapel,
} from '@barbertime/dominio';
import { administracao } from '../../dados/administracao.js';
import { useAcao } from '../../dados/useAcao.js';
import { useSessao } from '../../sessao/sessao.js';
import HistoriaDoPapel from './HistoriaDoPapel.vue';

// Hierarquia fixa (ADR 0010, planejamento 0023): só se altera quem está abaixo,
// e só se dá papel abaixo do seu. Senha de outra pessoa não se troca aqui: cada
// um troca a sua em Meu perfil ou pede "Esqueci minha senha". A API decide; a
// tela só não oferece o que seria recusado.
const aberto = defineModel({ type: Boolean, default: false });
const props = defineProps({
  /** null = convidar novo */
  usuario: { type: Object, default: null },
  papeis: { type: Array, default: () => [] },
  eu: { type: Number, default: null },
  /** Chave do papel de quem está usando a tela. */
  meuPapel: { type: String, default: null },
});
const emit = defineEmits(['salvo']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

const form = ref({});
const novo = computed(() => !props.usuario);
const souEu = computed(() => props.usuario?.id === props.eu);
const podeAlterar = computed(
  () => novo.value || podeAgirSobre(props.meuPapel, props.usuario?.papelChave),
);
// Papéis como cartões com o resumo; a história completa aparece ao escolher
// (planejamento 0033), só com o que existe nesta barbearia (módulos ativos).
const opcoesPapeis = computed(() =>
  props.papeis
    .filter((p) => podeAgirSobre(props.meuPapel, p.chave))
    .map((p) => ({
      valor: p.id,
      rotulo: p.nome,
      detalhe: resumoDoPapel(p.chave),
    })),
);
const { sessao } = useSessao();
const historia = computed(() => {
  const papel = props.papeis.find((p) => p.id === form.value.papelId);
  return papel
    ? historiaDoPapel(papel.chave, sessao.value?.modulosAtivos ?? [])
    : null;
});
const tituloDaHistoria = computed(() => {
  const nome = String(
    (novo.value ? form.value.nome : props.usuario?.nome) ?? '',
  )
    .trim()
    .split(/\s+/)[0];
  const quem = nome || 'quem for';
  return `Como vai ser o dia de ${quem} como ${historia.value?.nome}`;
});
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
    largura="md"
    fechavel
  >
    <p v-if="souEu" class="ds-corpo-sm ds-suave">
      Este é o seu acesso: só quem está acima de você pode alterá-lo. Para
      trocar a sua senha, use Meu perfil.
    </p>
    <p v-else-if="!podeAlterar" class="ds-corpo-sm ds-suave">
      {{ usuario.nome }} ({{ usuario.papelNome }}) está no seu nível ou acima:
      só quem está acima pode alterar este acesso.
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
          rotulo="Senha inicial"
          ajuda="A pessoa troca em Meu perfil. Se o e-mail já tiver conta, a senha dela é mantida"
        />
      </template>
      <p v-else class="ds-valor ds-suave">{{ usuario.email }}</p>
      <DsEscolha
        v-model="form.papelId"
        rotulo="Papel"
        :opcoes="opcoesPapeis"
        grande
      />
      <HistoriaDoPapel
        v-if="historia"
        :historia="historia"
        :titulo="tituloDaHistoria"
      />
      <DsEscolha
        v-if="!novo"
        v-model="form.ativo"
        :opcoes="situacoes"
        rotulo="Acesso"
      />
    </DsFormulario>
    <template v-if="!souEu && podeAlterar" #acoes>
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
