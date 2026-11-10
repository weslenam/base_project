<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DsBotao, DsFormulario, DsInput } from '@barbertime/ui';
import { useOperador } from '../sessao/operador.ts';

// Operador entra com e-mail, senha e o código do app autenticador (ADR 0018).
const route = useRoute();
const router = useRouter();
const { entrar } = useOperador();

const email = ref('');
const senha = ref('');
const codigo = ref('');
const erro = ref('');
const entrando = ref(false);

async function aoEnviar() {
  erro.value = '';
  entrando.value = true;
  try {
    await entrar(email.value, senha.value, codigo.value);
    router.replace(String(route.query.volta || '/barbearias'));
  } catch (e) {
    erro.value = (e as Error).message;
    codigo.value = '';
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
      <h1 id="titulo-entrar" class="ds-titulo">Business Center</h1>
      <p class="ds-corpo-sm ds-suave">Acesso restrito à equipe BarberTime.</p>
      <DsFormulario id="form-entrar" @enviar="aoEnviar">
        <DsInput v-model="email" tipo="email" rotulo="E-mail" obrigatorio />
        <DsInput v-model="senha" tipo="senha" rotulo="Senha" obrigatorio />
        <DsInput
          v-model="codigo"
          rotulo="Código do autenticador"
          ajuda="6 dígitos do app autenticador"
          obrigatorio
        />
        <p v-if="erro" class="acesso__erro" role="alert">{{ erro }}</p>
        <DsBotao tipo="submit" bloco tamanho="lg" :carregando="entrando"
          >Entrar</DsBotao
        >
      </DsFormulario>
    </section>
  </main>
</template>

<style scoped>
.acesso {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: var(--esp-6) var(--esp-4);
  background: var(--concreto);
  box-sizing: border-box;
}
.acesso__cartao {
  display: grid;
  gap: var(--esp-4);
  width: 100%;
  max-width: 26rem;
  padding: var(--esp-6);
  border: 1px solid var(--linha);
  border-radius: var(--raio-md);
  background: var(--placa);
  box-shadow: var(--sombra-placa);
  box-sizing: border-box;
}
.acesso__cartao p {
  margin: 0;
}
.acesso__erro {
  color: var(--perigo);
  font: var(--tipo-corpo-sm);
}
</style>
