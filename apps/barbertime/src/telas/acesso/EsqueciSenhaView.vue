<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { DsBotao, DsFormulario, DsInput } from '@barbertime/ui';
import { useSessao } from '../../sessao/sessao.ts';
import './estilos.css';

// Planejamento 0023: quem esqueceu a senha pede um link por e-mail. A resposta
// é sempre a mesma, exista a conta ou não.
const { pedirRedefinicao } = useSessao();

const email = ref('');
const erro = ref('');
const aviso = ref('');
const enviando = ref(false);

async function aoEnviar() {
  erro.value = '';
  enviando.value = true;
  try {
    aviso.value = (await pedirRedefinicao(email.value)).mensagem;
  } catch (e) {
    erro.value = e.message;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <main class="acesso">
    <section class="acesso__cartao" aria-labelledby="titulo-esqueci">
      <img
        src="/barbertime-logo.svg"
        alt="BarberTime"
        width="180"
        height="40"
      />
      <h1 id="titulo-esqueci" class="ds-titulo">Esqueci minha senha</h1>
      <p v-if="aviso" class="acesso__aviso" role="status">{{ aviso }}</p>
      <DsFormulario v-else id="form-esqueci" @enviar="aoEnviar">
        <p class="acesso__aviso">
          Informe o e-mail da sua conta. Enviaremos um link para você criar uma
          senha nova.
        </p>
        <DsInput v-model="email" tipo="email" rotulo="E-mail" obrigatorio />
        <p v-if="erro" class="acesso__erro" role="alert">{{ erro }}</p>
        <DsBotao tipo="submit" bloco tamanho="lg" :carregando="enviando"
          >Enviar link</DsBotao
        >
      </DsFormulario>
      <p class="acesso__rodape">
        <RouterLink to="/entrar">Voltar para Entrar</RouterLink>
      </p>
    </section>
  </main>
</template>
