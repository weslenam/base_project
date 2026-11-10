<script setup>
import { onMounted, ref } from 'vue';
import { DsBotao, DsIcone, DsPagina, DsSelo, DsTabela } from '@barbertime/ui';
import { administracao } from '../../dados/administracao.ts';
import { useAcao } from '../../dados/useAcao.ts';
import { useSessao } from '../../sessao/sessao.ts';
import UsuarioDialogo from './UsuarioDialogo.vue';

const executar = useAcao();
const { sessao } = useSessao();

const usuarios = ref([]);
const papeis = ref([]);
const dialogoAberto = ref(false);
const selecionado = ref(null);

const colunas = [
  { campo: 'nome', titulo: 'Nome', ordenavel: true },
  { campo: 'email', titulo: 'E-mail' },
  { campo: 'papelNome', titulo: 'Papel', ordenavel: true },
  { campo: 'ativo', titulo: 'Acesso' },
];

async function carregar() {
  const dados = await executar(() =>
    Promise.all([
      administracao.usuarios.listar(),
      administracao.papeis.listar(),
    ]),
  );
  if (dados) [usuarios.value, papeis.value] = dados;
}
onMounted(carregar);

function abrir(usuario = null) {
  selecionado.value = usuario;
  dialogoAberto.value = true;
}
</script>

<template>
  <DsPagina titulo="Usuários" :sobretitulo="`${usuarios.length} com acesso`">
    <template #acoes>
      <DsBotao @click="abrir()">
        <DsIcone nome="adicionar" />
        Convidar usuário
      </DsBotao>
    </template>
    <p class="ds-corpo-sm ds-suave">
      Quem acessa o sistema desta barbearia e com qual papel. Você só altera o
      acesso de quem está abaixo de você na hierarquia.
    </p>
    <DsTabela
      :colunas="colunas"
      :linhas="usuarios"
      texto-vazio="Nenhum usuário"
      @selecionar="abrir"
    >
      <template #celula-nome="{ linha }">
        {{ linha.nome }}
        <span v-if="linha.id === sessao?.usuario.id" class="ds-suave"
          >(você)</span
        >
      </template>
      <template #celula-ativo="{ valor }">
        <DsSelo :estado="valor ? 'confirmado' : 'neutro'">{{
          valor ? 'Ativo' : 'Desativado'
        }}</DsSelo>
      </template>
    </DsTabela>
    <UsuarioDialogo
      v-model="dialogoAberto"
      :usuario="selecionado"
      :papeis="papeis"
      :eu="sessao?.usuario.id"
      :meu-papel="sessao?.papel?.chave"
      @salvo="carregar"
    />
  </DsPagina>
</template>
