<script setup>
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { DsBotao, DsFormulario, DsInput } from '@barbertime/ui';
import { useSessao } from '../../sessao/sessao.js';
import './estilos.css';

// Planejamento 0023: a senha nova vem do link do e-mail. O token está no
// fragmento (#t=...), que o navegador não envia ao servidor ao abrir a página.
const route = useRoute();
const router = useRouter();
const { redefinirSenha } = useSessao();

const token =
  new URLSearchParams(String(route.hash).replace(/^#/, '')).get('t') ?? '';
const senha = ref('');
const confirmacao = ref('');
const erro = ref('');
const salvando = ref(false);

async function aoEnviar() {
  erro.value = '';
  if (senha.value !== confirmacao.value) {
    erro.value = 'As senhas não conferem.';
    return;
  }
  salvando.value = true;
  try {
    await redefinirSenha(token, senha.value);
    router.replace({ name: 'entrar', query: { senha: 'nova' } });
  } catch (e) {
    erro.value = e.message;
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <main class="acesso">
    <section class="acesso__cartao" aria-labelledby="titulo-redefinir">
      <img
        src="/barbertime-logo.svg"
        alt="BarberTime"
        width="180"
        height="40"
      />
      <h1 id="titulo-redefinir" class="ds-titulo">Criar senha nova</h1>
      <p v-if="!token" class="acesso__erro" role="alert">
        Este link está incompleto. Peça um novo em "Esqueci minha senha".
      </p>
      <DsFormulario v-else id="form-redefinir" @enviar="aoEnviar">
        <DsInput
          v-model="senha"
          tipo="senha"
          rotulo="Senha nova"
          ajuda="Pelo menos 8 caracteres"
          obrigatorio
        />
        <DsInput
          v-model="confirmacao"
          tipo="senha"
          rotulo="Repita a senha nova"
          obrigatorio
        />
        <p v-if="erro" class="acesso__erro" role="alert">{{ erro }}</p>
        <DsBotao tipo="submit" bloco tamanho="lg" :carregando="salvando"
          >Criar senha</DsBotao
        >
      </DsFormulario>
      <p class="acesso__rodape">
        <RouterLink to="/esqueci-senha">Pedir outro link</RouterLink>
      </p>
    </section>
  </main>
</template>
