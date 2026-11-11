<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { DsBotao, DsFormulario, DsInput } from '@barbertime/ui';
import { useSessao } from '../../sessao/sessao.ts';
import './estilos.css';

const router = useRouter();
const { cadastrar } = useSessao();

const form = ref({ nome: '', slug: '', donoNome: '', email: '', senha: '' });
const slugEditado = ref(false);
const erro = ref('');
const enviando = ref(false);

/** "Barbearia do Zé" → "barbearia-do-ze" */
const paraSlug = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

watch(
  () => form.value.nome,
  (nome) => {
    if (!slugEditado.value) form.value.slug = paraSlug(nome);
  },
);

async function aoEnviar() {
  erro.value = '';
  enviando.value = true;
  try {
    const f = form.value;
    await cadastrar({
      nome: f.nome,
      slug: f.slug,
      dono: { nome: f.donoNome, email: f.email, senha: f.senha },
    });
    router.replace('/modulos');
  } catch (e) {
    erro.value = (e as Error).message;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <main class="acesso">
    <section class="acesso__cartao" aria-labelledby="titulo-cadastro">
      <img
        src="/barbertime-logo.svg"
        alt="BarberTime"
        width="180"
        height="40"
      />
      <h1 id="titulo-cadastro" class="ds-titulo">Cadastrar barbearia</h1>
      <DsFormulario id="form-cadastro" @enviar="aoEnviar">
        <DsInput v-model="form.nome" rotulo="Nome da barbearia" obrigatorio />
        <DsInput
          v-model="form.slug"
          rotulo="Endereço da página de agendamento"
          :ajuda="`barbertime.com.br/${form.slug || 'sua-barbearia'}`"
          obrigatorio
          @update:model-value="slugEditado = true"
        />
        <DsInput v-model="form.donoNome" rotulo="Seu nome" obrigatorio />
        <DsInput
          v-model="form.email"
          tipo="email"
          rotulo="Seu e-mail"
          obrigatorio
        />
        <DsInput
          v-model="form.senha"
          tipo="senha"
          rotulo="Senha"
          ajuda="Pelo menos 8 caracteres"
          obrigatorio
        />
        <p v-if="erro" class="acesso__erro" role="alert">{{ erro }}</p>
        <DsBotao tipo="submit" bloco tamanho="lg" :carregando="enviando"
          >Criar minha barbearia</DsBotao
        >
      </DsFormulario>
      <p class="acesso__rodape">
        Já tem conta? <RouterLink to="/entrar">Entrar</RouterLink>
      </p>
    </section>
  </main>
</template>
