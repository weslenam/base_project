<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  DsBotao,
  DsCartao,
  DsFormulario,
  DsHorarios,
  DsInput,
  DsInputTelefone,
  useDialogo,
} from '@barbertime/ui';
import { formatarDiaCurto, formatarMoeda } from '@barbertime/ui-utils';
import { hojeIso, somarDias } from '@barbertime/dominio';
import { api } from '../../dados/api.js';
import { ErroDeNegocio } from '../../dados/erros.js';

// Página do cliente final (planejamento 0006): marca da barbearia em primeiro lugar,
// BarberTime só no rodapé (ADR 0003). Um passo por vez, pensada para o celular.
const route = useRoute();
const { negar } = useDialogo();

const barbearia = ref(null);
const naoEncontrada = ref(false);
const servicos = ref([]);
const barbeiros = ref([]);
const horarios = ref([]);
const enviando = ref(false);
const confirmado = ref(null);

const escolha = ref({ servico: null, barbeiro: null, dia: null, hora: null });
const contato = ref({ nome: '', telefone: null });

const dias = Array.from({ length: 7 }, (_, i) => somarDias(hojeIso(), i));
const rotuloDia = (iso, i) =>
  i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : formatarDiaCurto(iso);

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
  escolha.value.hora = null;
  horarios.value =
    servico && barbeiro && dia
      ? await api.agendamentos.horariosLivres({
          data: dia,
          barbeiroId: barbeiro.id,
          servicoId: servico.id,
        })
      : [];
}
watch(
  () => [escolha.value.servico, escolha.value.barbeiro, escolha.value.dia],
  carregarHorarios,
);

const passo = computed(() => {
  const e = escolha.value;
  if (!e.servico) return 1;
  if (!e.barbeiro) return 2;
  if (!e.dia) return 3;
  if (!e.hora) return 4;
  return 5;
});

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
    await negar(`${erro.message} Os horários abaixo já estão atualizados.`);
    await carregarHorarios();
  } finally {
    enviando.value = false;
  }
}

function recomecar() {
  confirmado.value = null;
  escolha.value = { servico: null, barbeiro: null, dia: null, hora: null };
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
          <h1 class="ds-titulo">{{ barbearia.nome }}</h1>
          <p class="ds-corpo-lg ds-suave">Escolha o serviço e o barbeiro.</p>
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
          <section class="passo" aria-labelledby="passo-servico">
            <h2 id="passo-servico" class="passo__titulo">
              <span>1</span> Serviço
            </h2>
            <div class="opcoes">
              <button
                v-for="s in servicos"
                :key="s.id"
                type="button"
                class="opcao"
                :aria-pressed="escolha.servico?.id === s.id ? 'true' : 'false'"
                @click="escolha.servico = s"
              >
                <span class="opcao__nome">{{ s.nome }}</span>
                <span class="opcao__detalhe">
                  {{ s.duracao }} min ·
                  <span class="ds-valor">{{ formatarMoeda(s.preco) }}</span>
                </span>
              </button>
            </div>
          </section>

          <section
            v-if="passo >= 2"
            class="passo"
            aria-labelledby="passo-barbeiro"
          >
            <h2 id="passo-barbeiro" class="passo__titulo">
              <span>2</span> Barbeiro
            </h2>
            <div class="opcoes">
              <button
                v-for="b in barbeiros"
                :key="b.id"
                type="button"
                class="opcao"
                :aria-pressed="escolha.barbeiro?.id === b.id ? 'true' : 'false'"
                @click="escolha.barbeiro = b"
              >
                <span class="opcao__nome">{{ b.nome }}</span>
                <span class="opcao__detalhe ds-hora"
                  >{{ b.inicio }}–{{ b.fim }}</span
                >
              </button>
            </div>
          </section>

          <section v-if="passo >= 3" class="passo" aria-labelledby="passo-dia">
            <h2 id="passo-dia" class="passo__titulo"><span>3</span> Dia</h2>
            <div class="dias">
              <button
                v-for="(d, i) in dias"
                :key="d"
                type="button"
                class="opcao opcao--dia"
                :aria-pressed="escolha.dia === d ? 'true' : 'false'"
                @click="escolha.dia = d"
              >
                {{ rotuloDia(d, i) }}
              </button>
            </div>
          </section>

          <section
            v-if="passo >= 4"
            class="passo"
            aria-labelledby="passo-horario"
          >
            <h2 id="passo-horario" class="passo__titulo">
              <span>4</span> Horário
            </h2>
            <DsHorarios
              v-model="escolha.hora"
              :opcoes="horarios.filter((h) => h.disponivel)"
              rotulo="Horários livres"
            />
          </section>

          <section
            v-if="passo >= 5"
            class="passo"
            aria-labelledby="passo-dados"
          >
            <h2 id="passo-dados" class="passo__titulo">
              <span>5</span> Seus dados
            </h2>
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
  background: var(--concreto);
}
.publico__conteudo {
  display: grid;
  align-content: start;
  gap: var(--esp-6);
  width: 100%;
  max-width: 36rem;
  margin: 0 auto;
  padding: var(--esp-8) var(--esp-4);
  box-sizing: border-box;
}
.marca {
  display: grid;
  gap: var(--esp-1);
}
.marca p,
.marca h1 {
  margin: 0;
}
.passo {
  display: grid;
  gap: var(--esp-3);
}
.passo__titulo {
  display: flex;
  align-items: center;
  gap: var(--esp-2);
  margin: 0;
  font: var(--tipo-subtitulo);
  letter-spacing: var(--tipo-subtitulo-espacamento);
  text-transform: uppercase;
}
.passo__titulo span {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--raio-sm);
  background: var(--grafite);
  color: var(--concreto);
  font: var(--tipo-hora);
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
  min-height: 44px;
  padding: var(--esp-3) var(--esp-4);
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
.publico__rodape {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--esp-2);
  padding: var(--esp-4);
  color: var(--grafite-suave);
  font: var(--tipo-corpo-sm);
}
</style>
