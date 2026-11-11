<script setup lang="ts">
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
import { administracao } from '../../dados/administracao.ts';
import { useAcao } from '../../dados/useAcao.ts';
import { useSessao } from '../../sessao/sessao.ts';
import HistoriaDoPapel from './HistoriaDoPapel.vue';
import type { PropType } from 'vue';
import type { Papel, Usuario } from '../../dados/modelos.ts';

// Hierarquia fixa (ADR 0010, planejamento 0023): só se altera quem está abaixo,
// e só se dá papel abaixo do seu. Senha de outra pessoa não se troca aqui: cada
// um troca a sua em Meu perfil ou pede "Esqueci minha senha". A API decide; a
// tela só não oferece o que seria recusado.
const aberto = defineModel<boolean>({ default: false });
const props = defineProps({
  /** null = convidar novo */
  usuario: { type: Object as PropType<Usuario | null>, default: null },
  papeis: { type: Array as PropType<Papel[]>, default: () => [] },
  eu: { type: Number as PropType<number | null>, default: null },
  /** Chave do papel de quem está usando a tela. */
  meuPapel: { type: String as PropType<string | null>, default: null },
});
const emit = defineEmits(['salvo']);

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();

/** Convite (nome, e-mail e senha) ou alteração (papel e situação). */
const form = ref<{
  nome?: string;
  email?: string;
  senha?: string;
  papelId: number | null;
  ativo?: boolean;
}>({ papelId: null });
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
  const usuario = props.usuario;
  const feito = await executar(() =>
    usuario
      ? administracao.usuarios.alterar(usuario.id, form.value)
      : administracao.usuarios.convidar(form.value),
  );
  if (!feito) return;
  notificar.sucesso(
    novo.value ? `${feito.nome} agora tem acesso.` : 'Acesso atualizado.',
  );
  aberto.value = false;
  emit('salvo');
}

async function remover() {
  const usuario = props.usuario;
  if (!usuario) return;
  const ok = await confirmar(
    `Remover o acesso de ${usuario.nome} a esta barbearia?`,
    {
      perigo: true,
      textoOk: 'Remover acesso',
      textoCancelar: 'Manter',
    },
  );
  if (!ok) return;
  const feito = await executar(
    async () => (await administracao.usuarios.remover(usuario.id), true),
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
    :titulo="novo ? 'Convidar usuário' : usuario?.nome"
    largura="md"
    fechavel
  >
    <p v-if="souEu" class="ds-corpo-sm ds-suave">
      Este é o seu acesso: só quem está acima de você pode alterá-lo. Para
      trocar a sua senha, use Meu perfil.
    </p>
    <p v-else-if="!podeAlterar" class="ds-corpo-sm ds-suave">
      {{ usuario?.nome }} ({{ usuario?.papelNome }}) está no seu nível ou acima:
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
      <p v-else class="ds-valor ds-suave">{{ usuario?.email }}</p>
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
