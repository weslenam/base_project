<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  DsBotao,
  DsCartao,
  DsPagina,
  DsSelo,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import { administracao } from '../../dados/administracao.ts';
import { useAcao } from '../../dados/useAcao.ts';
import { carregarSessao, useSessao } from '../../sessao/sessao.ts';
import type { Selo } from '../estados.ts';
import type { Modulo } from '../../dados/modelos.ts';

const { confirmar } = useDialogo();
const notificar = useNotificacao();
const executar = useAcao();
const { pode } = useSessao();

const modulos = ref<Modulo[]>([]);
const podeGerenciar = computed(() => pode('modulos.gerenciar'));
const inclusos = computed(() =>
  modulos.value.filter((m) => m.tipo === 'incluso'),
);
const adicionais = computed(() =>
  modulos.value.filter((m) => m.tipo === 'adicional'),
);

const SELO: Record<string, Selo> = {
  ativo: { estado: 'confirmado', texto: 'Ativo' },
  solicitado: { estado: 'pendente', texto: 'Aguardando contratação' },
  inativo: { estado: 'neutro', texto: 'Inativo' },
};

async function carregar() {
  const lista = await executar(() => administracao.modulos.listar());
  if (lista) modulos.value = lista;
}
onMounted(carregar);

async function agir(modulo: Modulo, acao: string, mensagem: string) {
  if (acao === 'solicitar') {
    const ok = await confirmar(
      `${modulo.nome} é um serviço adicional, cobrado à parte. Enviar a solicitação de contratação para a equipe BarberTime?`,
      { textoOk: 'Solicitar contratação' },
    );
    if (!ok) return;
  }
  if (acao === 'desativar') {
    const ok = await confirmar(
      `Desativar ${modulo.nome}? As telas dele saem do menu.`,
      {
        textoOk: 'Desativar',
      },
    );
    if (!ok) return;
  }
  const feito = await executar(() =>
    administracao.modulos.executar(modulo.chave, acao),
  );
  if (!feito) return;
  notificar.sucesso(mensagem);
  await Promise.all([carregar(), carregarSessao()]);
}
</script>

<template>
  <DsPagina titulo="Módulos">
    <p class="ds-corpo-sm ds-suave">
      Os módulos inclusos fazem parte do plano: ative quando quiser. Os serviços
      adicionais são contratados à parte; depois da solicitação, a equipe
      BarberTime confirma e ativa.
    </p>

    <h2 class="ds-subtitulo">Inclusos no plano</h2>
    <div class="modulos">
      <DsCartao v-for="m in inclusos" :key="m.chave" :titulo="m.nome">
        <template #cabecalho-acoes>
          <DsSelo :estado="SELO[m.estado].estado">{{
            SELO[m.estado].texto
          }}</DsSelo>
        </template>
        <p class="ds-corpo-sm">{{ m.descricao }}</p>
        <template v-if="podeGerenciar" #acoes>
          <DsBotao
            v-if="m.estado === 'ativo'"
            variante="secundario"
            tamanho="sm"
            @click="agir(m, 'desativar', `${m.nome} desativado.`)"
          >
            Desativar
          </DsBotao>
          <DsBotao
            v-else
            tamanho="sm"
            @click="agir(m, 'ativar', `${m.nome} ativado.`)"
          >
            Ativar
          </DsBotao>
        </template>
      </DsCartao>
    </div>

    <h2 class="ds-subtitulo">Serviços adicionais</h2>
    <div class="modulos">
      <DsCartao v-for="m in adicionais" :key="m.chave" :titulo="m.nome">
        <template #cabecalho-acoes>
          <DsSelo :estado="SELO[m.estado].estado">{{
            SELO[m.estado].texto
          }}</DsSelo>
        </template>
        <p class="ds-corpo-sm">{{ m.descricao }}</p>
        <p v-if="m.estado === 'solicitado'" class="ds-corpo-sm ds-suave">
          Solicitação enviada. A equipe BarberTime entra em contato para
          concluir a contratação.
        </p>
        <template v-if="podeGerenciar && m.estado !== 'ativo'" #acoes>
          <DsBotao
            v-if="m.estado === 'solicitado'"
            variante="fantasma"
            tamanho="sm"
            @click="agir(m, 'cancelar_solicitacao', 'Solicitação cancelada.')"
          >
            Cancelar solicitação
          </DsBotao>
          <DsBotao
            v-else
            tamanho="sm"
            @click="
              agir(m, 'solicitar', 'Solicitação enviada à equipe BarberTime.')
            "
          >
            Solicitar contratação
          </DsBotao>
        </template>
      </DsCartao>
    </div>
  </DsPagina>
</template>

<style scoped>
.modulos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: var(--esp-3);
}
.modulos p {
  margin: 0;
}
h2 {
  margin: var(--esp-2) 0 0;
}
</style>
