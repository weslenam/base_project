<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  DsBotao,
  DsCartao,
  DsFormulario,
  DsInput,
  DsPagina,
  DsSelo,
  useNotificacao,
} from '@barbertime/ui';
import { useAcao } from '../../dados/useAcao.ts';
import { useSessao } from '../../sessao/sessao.ts';

// Meu perfil (planejamento 0017): qualquer usuário logado troca o nome, a senha
// e a barbearia em que está trabalhando.
const SENHA_MINIMA = 8;

const router = useRouter();
const notificar = useNotificacao();
const executar = useAcao();
const { sessao, atualizarPerfil, trocarSenha, trocarBarbearia } = useSessao();

const nome = ref('');
watch(
  () => sessao.value?.usuario?.nome,
  (n) => (nome.value = n ?? ''),
  { immediate: true },
);
const salvandoNome = ref(false);

async function salvarNome() {
  salvandoNome.value = true;
  const ok = await executar(
    async () => (await atualizarPerfil({ nome: nome.value }), true),
  );
  salvandoNome.value = false;
  if (ok) notificar.sucesso('Nome atualizado.');
}

const senha = ref({ atual: '', nova: '', repetir: '' });
const trocandoSenha = ref(false);
const regrasNova = [
  (v: unknown) =>
    String(v ?? '').length >= SENHA_MINIMA ||
    `Pelo menos ${SENHA_MINIMA} caracteres`,
];
const regrasRepetir = [
  (v: unknown) => v === senha.value.nova || 'As senhas não são iguais',
];

async function salvarSenha() {
  trocandoSenha.value = true;
  const r = await executar(() =>
    trocarSenha(senha.value.atual, senha.value.nova),
  );
  trocandoSenha.value = false;
  if (!r) return;
  senha.value = { atual: '', nova: '', repetir: '' };
  notificar.sucesso(
    r.sessoesEncerradas
      ? `Senha trocada. ${r.sessoesEncerradas === 1 ? 'A outra sessão aberta foi encerrada' : `As ${r.sessoesEncerradas} outras sessões abertas foram encerradas`}.`
      : 'Senha trocada.',
  );
}

const barbearias = computed(() => sessao.value?.barbearias ?? []);
const atual = computed(() => sessao.value?.barbearia?.id);

async function entrarEm(b: { id: number; nome: string }) {
  const ok = await executar(async () => (await trocarBarbearia(b.id), true));
  if (!ok) return;
  notificar.sucesso(`Você está em ${b.nome}.`);
  router.push('/');
}
</script>

<template>
  <DsPagina
    titulo="Meu perfil"
    :sobretitulo="
      sessao?.papel
        ? `${sessao.papel.nome} · ${sessao.barbearia?.nome ?? ''}`
        : ''
    "
  >
    <div class="perfil">
      <DsCartao titulo="Seus dados">
        <DsFormulario id="form-perfil" class="campos" @enviar="salvarNome">
          <DsInput v-model="nome" rotulo="Nome" obrigatorio />
          <DsInput
            :model-value="sessao?.usuario?.email"
            tipo="email"
            rotulo="E-mail"
            ajuda="É o seu login. Para trocar, fale com o suporte BarberTime."
            somente-leitura
          />
        </DsFormulario>
        <template #acoes>
          <DsBotao formulario="form-perfil" :carregando="salvandoNome">
            Salvar
          </DsBotao>
        </template>
      </DsCartao>

      <DsCartao titulo="Trocar senha">
        <DsFormulario id="form-senha" class="campos" @enviar="salvarSenha">
          <DsInput
            v-model="senha.atual"
            tipo="senha"
            rotulo="Senha atual"
            obrigatorio
          />
          <DsInput
            v-model="senha.nova"
            tipo="senha"
            rotulo="Nova senha"
            :ajuda="`Pelo menos ${SENHA_MINIMA} caracteres`"
            :regras="regrasNova"
            obrigatorio
          />
          <DsInput
            v-model="senha.repetir"
            tipo="senha"
            rotulo="Repita a nova senha"
            :regras="regrasRepetir"
            obrigatorio
          />
          <p class="ds-corpo-sm ds-suave">
            Ao trocar, as outras sessões abertas (outro computador, celular) são
            encerradas.
          </p>
        </DsFormulario>
        <template #acoes>
          <DsBotao formulario="form-senha" :carregando="trocandoSenha">
            Trocar senha
          </DsBotao>
        </template>
      </DsCartao>

      <DsCartao
        v-if="barbearias.length"
        titulo="Suas barbearias"
        class="perfil__inteira"
      >
        <ul class="barbearias" aria-label="Suas barbearias">
          <li v-for="b in barbearias" :key="b.id" class="barbearia">
            <span>
              <strong>{{ b.nome }}</strong>
              <span class="ds-corpo-sm ds-suave"> · /agendar/{{ b.slug }}</span>
            </span>
            <DsSelo v-if="b.id === atual" estado="confirmado">Atual</DsSelo>
            <DsBotao
              v-else
              variante="secundario"
              tamanho="sm"
              @click="entrarEm(b)"
            >
              Entrar nesta
            </DsBotao>
          </li>
        </ul>
      </DsCartao>
    </div>
  </DsPagina>
</template>

<style scoped>
.perfil {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  gap: var(--esp-4);
  align-items: start;
  max-width: 60rem;
}
.perfil__inteira {
  grid-column: 1 / -1;
}
.campos {
  display: grid;
  gap: var(--esp-2);
}
.campos p {
  margin: 0;
}
.barbearias {
  display: grid;
  gap: var(--esp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.barbearia {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--esp-2);
  padding: var(--esp-2) 0;
  border-bottom: 1px solid var(--linha);
}
.barbearia:last-child {
  border-bottom: 0;
}
</style>
