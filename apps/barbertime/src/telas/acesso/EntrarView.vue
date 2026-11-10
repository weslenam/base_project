<script setup>
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { DsBotao, DsFormulario, DsInput } from '@barbertime/ui';
import { useSessao } from '../../sessao/sessao.ts';
import './estilos.css';

const route = useRoute();
const router = useRouter();
const { entrar } = useSessao();

const email = ref('');
const senha = ref('');
const erro = ref('');
const entrando = ref(false);

async function aoEnviar() {
  erro.value = '';
  entrando.value = true;
  try {
    await entrar(email.value, senha.value);
    router.replace(String(route.query.volta || '/'));
  } catch (e) {
    erro.value = e.message;
  } finally {
    entrando.value = false;
  }
}
</script>

<template>
  <main class="acesso">
    <section class="acesso__cartao" aria-labelledby="titulo-entrar">
      <img
        src="/barbertime-logo.svg"
        alt="BarberTime"
        width="180"
        height="40"
      />
      <h1 id="titulo-entrar" class="ds-titulo">Entrar</h1>
      <p
        v-if="route.query.senha === 'nova'"
        class="acesso__aviso"
        role="status"
      >
        Senha criada. Entre com a senha nova.
      </p>
      <DsFormulario id="form-entrar" @enviar="aoEnviar">
        <DsInput v-model="email" tipo="email" rotulo="E-mail" obrigatorio />
        <DsInput v-model="senha" tipo="senha" rotulo="Senha" obrigatorio />
        <p v-if="erro" class="acesso__erro" role="alert">{{ erro }}</p>
        <RouterLink to="/esqueci-senha" class="acesso__link"
          >Esqueci minha senha</RouterLink
        >
        <DsBotao tipo="submit" bloco tamanho="lg" :carregando="entrando"
          >Entrar</DsBotao
        >
      </DsFormulario>
      <p class="acesso__rodape">
        Ainda não usa o BarberTime?
        <RouterLink to="/cadastro">Cadastre sua barbearia</RouterLink>
      </p>
    </section>
  </main>
</template>
