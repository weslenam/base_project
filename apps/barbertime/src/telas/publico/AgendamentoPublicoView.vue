<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  DsBotao,
  DsCartao,
  DsFormulario,
  DsHorarios,
  DsIcone,
  DsInput,
  DsInputTelefone,
  DsPassos,
  useDialogo,
} from '@barbertime/ui';
import { formatarDiaCurto, formatarMoeda } from '@barbertime/ui-utils';
import { hojeIso, somarDias } from '@barbertime/dominio';
import { api } from '../../dados/api.js';
import { ErroDeNegocio } from '../../dados/erros.js';

// Página do cliente final (planejamentos 0006 e 0014): uma etapa por vez, sem rolagem.
// Marca da barbearia em primeiro lugar; BarberTime só no rodapé (ADR 0003).
const route = useRoute();
const { negar } = useDialogo();

const barbearia = ref(null);
const naoEncontrada = ref(false);
const servicos = ref([]);
const barbeiros = ref([]);
const horarios = ref([]);
const enviando = ref(false);
const confirmado = ref(null);

const passo = ref(0);
const escolha = ref({ servico: null, barbeiro: null, dia: null, hora: null });
const contato = ref({ nome: '', telefone: null });

const PASSOS = ['Serviço', 'Barbeiro', 'Dia', 'Horário', 'Seus dados'];
const dias = Array.from({ length: 7 }, (_, i) => somarDias(hojeIso(), i));
const rotuloDia = (iso) => {
  const i = dias.indexOf(iso);
  return i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : formatarDiaCurto(iso);
};

onMounted(async () => {
  try {
    barbearia.value = await api.barbearia.obterPorSlug(route.params.slug);
    [servicos.value, barbeiros.value] = await Promise.all([
      api.servicos.listar(),
      api.barbeiros.listar(),
    ]);
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) naoEncontrada.value = true;
    else throw erro;
  }
});

async function carregarHorarios() {
  const { servico, barbeiro, dia } = escolha.value;
  horarios.value =
    servico && barbeiro && dia
      ? (
          await api.agendamentos.horariosLivres({
            data: dia,
            barbeiroId: barbeiro.id,
            servicoId: servico.id,
          })
        ).filter((h) => h.disponivel)
      : [];
}
// Mudar serviço, barbeiro ou dia invalida o horário escolhido.
watch(
  () => [escolha.value.servico, escolha.value.barbeiro, escolha.value.dia],
  () => {
    escolha.value.hora = null;
    carregarHorarios();
  },
);

/** Escolher já avança, como num PDV. */
function escolher(campo, valor) {
  escolha.value[campo] = valor;
  passo.value = Math.min(passo.value + 1, PASSOS.length - 1);
}

const resumo = computed(() =>
  [
    escolha.value.servico?.nome,
    escolha.value.barbeiro?.nome,
    escolha.value.dia && rotuloDia(escolha.value.dia),
    escolha.value.hora,
  ].filter(Boolean),
);
const passos = PASSOS.map((rotulo) => ({ rotulo }));

async function confirmar() {
  enviando.value = true;
  try {
    const { servico, barbeiro, dia, hora } = escolha.value;
    confirmado.value = await api.agendamentos.criar({
      data: dia,
      inicio: hora,
      servicoId: servico.id,
      barbeiroId: barbeiro.id,
      cliente: contato.value,
    });
  } catch (erro) {
    if (!(erro instanceof ErroDeNegocio)) throw erro;
    await negar(`${erro.message} Os horários já estão atualizados.`);
    escolha.value.hora = null;
    await carregarHorarios();
    passo.value = 3;
  } finally {
    enviando.value = false;
  }
}

function recomecar() {
  confirmado.value = null;
  escolha.value = { servico: null, barbeiro: null, dia: null, hora: null };
  passo.value = 0;
}
</script>

<template>
  <div class="publico">
    <main class="publico__conteudo">
      <p v-if="naoEncontrada" class="ds-corpo-lg">
        Não encontramos essa barbearia. Confira o link que você recebeu.
      </p>

      <template v-else-if="barbearia">
        <header class="marca">
          <p class="ds-rotulo">{{ barbearia.cidade }}</p>
          <h1 class="marca__nome">{{ barbearia.nome }}</h1>
        </header>

        <DsCartao v-if="confirmado" titulo="Horário reservado">
          <p class="ds-corpo-lg">
            {{ confirmado.clienteNome }}, seu horário é
            <strong>{{ formatarDiaCurto(confirmado.data) }}</strong> às
            <strong class="ds-hora">{{ confirmado.inicio }}</strong
            >, com {{ confirmado.barbeiroNome }} ({{ confirmado.servicoNome }}).
          </p>
          <p class="ds-suave">
            Antes do horário, você recebe uma mensagem para confirmar.
          </p>
          <template #acoes>
            <DsBotao variante="secundario" @click="recomecar"
              >Agendar outro horário</DsBotao
            >
          </template>
        </DsCartao>

        <template v-else>
          <DsPassos
            v-model="passo"
            :passos="passos"
            rotulo="Etapas do agendamento"
          />

          <p v-if="resumo.length" class="resumo" aria-label="Suas escolhas">
            {{ resumo.join(' · ') }}
          </p>

          <!-- 1. Serviço -->
          <section
            v-if="passo === 0"
            class="etapa"
            aria-label="Escolha o serviço"
          >
            <h2 class="etapa__titulo">Qual serviço?</h2>
            <div class="opcoes">
              <button
                v-for="s in servicos"
                :key="s.id"
                type="button"
                class="opcao"
                :aria-pressed="escolha.servico?.id === s.id ? 'true' : 'false'"
                @click="escolher('servico', s)"
              >
                <span class="opcao__nome">{{ s.nome }}</span>
                <span class="opcao__detalhe">
                  {{ s.duracao }} min ·
                  <span class="ds-valor">{{ formatarMoeda(s.preco) }}</span>
                </span>
              </button>
            </div>
          </section>

          <!-- 2. Barbeiro -->
          <section
            v-else-if="passo === 1"
            class="etapa"
            aria-label="Escolha o barbeiro"
          >
            <h2 class="etapa__titulo">Com quem?</h2>
            <div class="opcoes">
              <button
                v-for="b in barbeiros"
                :key="b.id"
                type="button"
                class="opcao"
                :aria-pressed="escolha.barbeiro?.id === b.id ? 'true' : 'false'"
                @click="escolher('barbeiro', b)"
              >
                <span class="opcao__nome">{{ b.nome }}</span>
                <span class="opcao__detalhe ds-hora"
                  >{{ b.inicio }}–{{ b.fim }}</span
                >
              </button>
            </div>
          </section>

          <!-- 3. Dia -->
          <section
            v-else-if="passo === 2"
            class="etapa"
            aria-label="Escolha o dia"
          >
            <h2 class="etapa__titulo">Que dia?</h2>
            <div class="dias">
              <button
                v-for="d in dias"
                :key="d"
                type="button"
                class="opcao opcao--dia"
                :aria-pressed="escolha.dia === d ? 'true' : 'false'"
                @click="escolher('dia', d)"
              >
                {{ rotuloDia(d) }}
              </button>
            </div>
          </section>

          <!-- 4. Horário -->
          <section
            v-else-if="passo === 3"
            class="etapa"
            aria-label="Escolha o horário"
          >
            <h2 class="etapa__titulo">Que horas?</h2>
            <DsHorarios
              :model-value="escolha.hora"
              :opcoes="horarios"
              rotulo="Horários livres"
              texto-vazio="Nenhum horário livre neste dia. Volte e escolha outro dia."
              @update:model-value="(h) => escolher('hora', h)"
            />
          </section>

          <!-- 5. Seus dados -->
          <section v-else class="etapa" aria-label="Seus dados">
            <h2 class="etapa__titulo">Seus dados</h2>
            <DsFormulario id="form-publico" @enviar="confirmar">
              <DsInput v-model="contato.nome" rotulo="Seu nome" obrigatorio />
              <DsInputTelefone
                v-model="contato.telefone"
                rotulo="WhatsApp ou celular"
                ajuda="Para confirmar o horário"
                obrigatorio
              />
              <DsBotao
                formulario="form-publico"
                bloco
                tamanho="lg"
                :carregando="enviando"
              >
                Confirmar horário
              </DsBotao>
            </DsFormulario>
          </section>

          <div v-if="passo > 0" class="navegacao">
            <DsBotao variante="fantasma" @click="passo -= 1">
              <DsIcone nome="voltar" />
              Voltar
            </DsBotao>
          </div>
        </template>
      </template>
    </main>

    <footer class="publico__rodape">
      <img src="/barbertime-simbolo.svg" alt="" width="16" height="16" />
      Agendamento por BarberTime
    </footer>
  </div>
</template>

<style scoped>
.publico {
  display: grid;
  grid-template-rows: 1fr auto;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--concreto);
}
.publico__conteudo {
  display: grid;
  align-content: start;
  gap: var(--esp-4);
  width: 100%;
  max-width: 36rem;
  margin: 0 auto;
  padding: var(--esp-6) var(--esp-4) var(--esp-4);
  box-sizing: border-box;
}
.publico__conteudo p {
  margin: 0;
}
.marca {
  display: grid;
  gap: 2px;
}
.marca__nome {
  margin: 0;
  font: var(--tipo-titulo);
  letter-spacing: var(--tipo-titulo-espacamento);
  text-transform: uppercase;
}
.resumo {
  padding: var(--esp-2) var(--esp-3);
  border-left: 4px solid var(--cobre);
  border-radius: var(--raio-sm);
  background: var(--placa);
  font-weight: 600;
}
.etapa {
  display: grid;
  gap: var(--esp-3);
}
.etapa__titulo {
  margin: 0;
  font: var(--tipo-subtitulo);
  letter-spacing: var(--tipo-subtitulo-espacamento);
  text-transform: uppercase;
}
.opcoes {
  display: grid;
  gap: var(--esp-2);
}
.dias {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  gap: var(--esp-2);
}
.opcao {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--esp-3);
  min-height: 52px;
  padding: var(--esp-2) var(--esp-4);
  border: 2px solid var(--linha-forte);
  border-radius: var(--raio-sm);
  background: var(--placa);
  color: var(--grafite);
  font: var(--tipo-corpo);
  text-align: left;
  cursor: pointer;
}
.opcao--dia {
  justify-content: center;
  font-weight: 600;
}
.opcao:hover {
  border-color: var(--cobre);
}
.opcao[aria-pressed='true'] {
  border-color: var(--cobre);
  background: var(--cobre-suave);
}
.opcao__nome {
  font-weight: 600;
}
.opcao__detalhe {
  color: var(--grafite-suave);
  white-space: nowrap;
}
.navegacao {
  display: flex;
}
.publico__rodape {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--esp-2);
  padding: var(--esp-3);
  color: var(--grafite-suave);
  font: var(--tipo-corpo-sm);
}
</style>
