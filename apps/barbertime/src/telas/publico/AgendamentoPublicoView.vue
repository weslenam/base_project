<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  DsBotao,
  DsCartao,
  DsHorarios,
  DsIcone,
  DsInput,
  DsInputTelefone,
  DsPassos,
  useDialogo,
} from '@barbertime/ui';
import {
  formatarDiaCurto,
  formatarMoeda,
  somenteDigitos,
  validarTelefone,
} from '@barbertime/ui-utils';
import { hojeIso, somarDias } from '@barbertime/dominio';
import { api } from '../../dados/api.ts';
import { ErroDeNegocio } from '../../dados/erros.ts';
import type { AgendamentoPublico, EmJson } from '@barbertime/contratos';
import type { Pagina } from '../../dados/modelos.ts';
import type { HorarioLivre } from '../../dados/tipos.ts';

type ServicoPublico = Pagina['servicos'][number];
type BarbeiroPublico = Pagina['barbeiros'][number];
/** O que o cliente escolheu, etapa por etapa. */
interface Escolha {
  servico: ServicoPublico | null;
  barbeiro: BarbeiroPublico | null;
  dia: string | null;
  hora: string | null;
}
const escolhaVazia = (): Escolha => ({
  servico: null,
  barbeiro: null,
  dia: null,
  hora: null,
});

// Página do cliente final (planejamentos 0006 e 0014): uma etapa por vez, sem rolagem,
// cartão "Seu agendamento" ao lado em telas largas e saudação a quem já é cliente.
// Marca da barbearia em primeiro lugar; BarberTime só no rodapé (ADR 0003).
const route = useRoute();
const { negar } = useDialogo();

const barbearia = ref<Pagina['barbearia'] | null>(null);
const naoEncontrada = ref(false);
const servicos = ref<ServicoPublico[]>([]);
const barbeiros = ref<BarbeiroPublico[]>([]);
const horarios = ref<HorarioLivre[]>([]);
const enviando = ref(false);
const confirmado = ref<EmJson<AgendamentoPublico> | null>(null);

const passo = ref(0);
const escolha = ref<Escolha>(escolhaVazia());

// Etapa "Seus dados": telefone primeiro; quem já é cliente é reconhecido.
const telefone = ref<string | null>(null);
const nome = ref('');
/** undefined: ainda não consultou · null: cliente novo · { primeiroNome }: já é cliente */
const reconhecido = ref<{ primeiroNome: string } | null | undefined>(undefined);
const erroDados = ref('');

const PASSOS = ['Serviço', 'Barbeiro', 'Dia', 'Horário', 'Seus dados'];
const passos = PASSOS.map((rotulo) => ({ rotulo }));
// Slug e, no modo "só com o link", o código ?c= (planejamento 0019, ADR 0013).
const slug = String(route.params.slug);
// Com o ?c= repetido no link, vale o primeiro.
const c = [route.query.c].flat()[0];
const codigo = c ? String(c) : undefined;
const hoje = ref(hojeIso());

/** Próximos 7 dias em que a barbearia abre, dentro do limite de dias à frente. */
const dias = computed(() => {
  const b = barbearia.value;
  if (!b) return [];
  const lista: string[] = [];
  const limite = b.agendamento?.diasAFrente ?? 30;
  for (let i = 0; i <= limite && lista.length < 7; i++) {
    const iso = somarDias(hoje.value, i);
    const semana = new Date(`${iso}T12:00:00Z`).getUTCDay();
    const dia = b.funcionamento?.find((d) => d.dia === semana);
    if (!dia || dia.aberto) lista.push(iso);
  }
  return lista;
});
const rotuloDia = (iso: string) =>
  iso === hoje.value
    ? 'Hoje'
    : iso === somarDias(hoje.value, 1)
      ? 'Amanhã'
      : formatarDiaCurto(iso);

onMounted(async () => {
  try {
    const pagina = await api.publico.carregar(slug, codigo);
    barbearia.value = pagina.barbearia;
    servicos.value = pagina.servicos;
    barbeiros.value = pagina.barbeiros;
    hoje.value = pagina.hoje ?? hoje.value;
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
          await api.publico.horarios(slug, codigo, {
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
function escolher<C extends keyof Escolha>(campo: C, valor: Escolha[C]) {
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

// Reconhece o cliente assim que o telefone fica completo.
let consulta = 0;
watch(telefone, async (valor) => {
  erroDados.value = '';
  const esta = ++consulta;
  if (!valor || !validarTelefone(valor)) {
    reconhecido.value = undefined;
    return;
  }
  const r = await api.publico.reconhecer(slug, codigo, valor);
  if (esta === consulta) reconhecido.value = r;
});

const clienteQueVolta = computed(() => Boolean(reconhecido.value));
const clienteNovo = computed(() => reconhecido.value === null);

function trocarTelefone() {
  telefone.value = null;
  reconhecido.value = undefined;
}

async function confirmar() {
  erroDados.value = '';
  if (!validarTelefone(telefone.value)) {
    erroDados.value = 'Informe seu WhatsApp ou celular com DDD.';
    return;
  }
  if (clienteNovo.value && !nome.value.trim()) {
    erroDados.value = 'Informe seu nome.';
    return;
  }
  enviando.value = true;
  try {
    const { servico, barbeiro, dia, hora } = escolha.value;
    // O botão de confirmar só aparece na última etapa, com tudo escolhido.
    if (!servico || !barbeiro || !dia || !hora) {
      erroDados.value = 'Escolha de novo o horário.';
      passo.value = 3;
      return;
    }
    confirmado.value = await api.publico.agendar(slug, codigo, {
      data: dia,
      inicio: hora,
      servicoId: servico.id,
      barbeiroId: barbeiro.id,
      // Para quem já é cliente, o cadastro é achado pelo telefone.
      cliente: {
        nome: nome.value.trim(),
        telefone: somenteDigitos(telefone.value),
      },
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
  escolha.value = escolhaVazia();
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
          <p v-if="barbearia.contato?.endereco" class="ds-rotulo">
            {{ barbearia.contato.endereco }}
          </p>
          <h1 class="marca__nome">{{ barbearia.nome }}</h1>
        </header>

        <DsCartao
          v-if="confirmado"
          titulo="Horário reservado"
          class="reservado"
        >
          <p class="ds-corpo-lg">
            {{ confirmado.primeiroNome ?? reconhecido?.primeiroNome }}, seu
            horário é
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

        <div v-else class="corpo">
          <div class="etapas">
            <DsPassos
              v-model="passo"
              :passos="passos"
              rotulo="Etapas do agendamento"
            />

            <!-- Celular: resumo numa linha (em telas largas vira o cartão ao lado). -->
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
                  :aria-pressed="
                    escolha.servico?.id === s.id ? 'true' : 'false'
                  "
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
                  :aria-pressed="
                    escolha.barbeiro?.id === b.id ? 'true' : 'false'
                  "
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

            <!-- 5. Seus dados: telefone primeiro, saudação a quem já é cliente -->
            <section v-else class="etapa" aria-label="Seus dados">
              <h2 class="etapa__titulo">Seus dados</h2>
              <DsInputTelefone
                v-model="telefone"
                rotulo="Seu WhatsApp ou celular"
                ajuda="Para confirmar o horário"
                :validar-numero="false"
              />

              <div v-if="clienteQueVolta" class="saudacao" role="status">
                <p class="saudacao__titulo">
                  Olá, {{ reconhecido?.primeiroNome }}!
                </p>
                <p>Que bom te ver de novo. É só confirmar.</p>
                <DsBotao
                  variante="fantasma"
                  tamanho="sm"
                  @click="trocarTelefone"
                >
                  Não é você? Usar outro número
                </DsBotao>
              </div>

              <template v-else-if="clienteNovo">
                <div class="saudacao saudacao--nova" role="status">
                  <p class="saudacao__titulo">Primeira vez por aqui?</p>
                  <p>Seja bem-vindo! Como podemos te chamar?</p>
                </div>
                <DsInput v-model="nome" rotulo="Seu nome" />
              </template>

              <p v-if="erroDados" class="erro" role="alert">{{ erroDados }}</p>

              <DsBotao
                bloco
                tamanho="lg"
                :desabilitado="reconhecido === undefined"
                :carregando="enviando"
                @click="confirmar"
              >
                Confirmar horário
              </DsBotao>
            </section>

            <div v-if="passo > 0" class="navegacao">
              <DsBotao variante="fantasma" @click="passo -= 1">
                <DsIcone nome="voltar" />
                Voltar
              </DsBotao>
            </div>
          </div>

          <!-- Telas largas: o agendamento sendo montado, sempre à vista. -->
          <aside class="lateral" aria-label="Seu agendamento">
            <DsCartao titulo="Seu agendamento">
              <dl class="detalhes">
                <div>
                  <dt class="ds-rotulo">Serviço</dt>
                  <dd>
                    <template v-if="escolha.servico">
                      {{ escolha.servico.nome }}
                      <span class="ds-suave"
                        >· {{ escolha.servico.duracao }} min</span
                      >
                    </template>
                    <span v-else class="ds-suave">—</span>
                  </dd>
                </div>
                <div>
                  <dt class="ds-rotulo">Barbeiro</dt>
                  <dd>{{ escolha.barbeiro?.nome ?? '—' }}</dd>
                </div>
                <div>
                  <dt class="ds-rotulo">Dia</dt>
                  <dd>{{ escolha.dia ? rotuloDia(escolha.dia) : '—' }}</dd>
                </div>
                <div>
                  <dt class="ds-rotulo">Horário</dt>
                  <dd class="ds-hora">{{ escolha.hora ?? '—' }}</dd>
                </div>
                <div v-if="escolha.servico" class="detalhes__total">
                  <dt class="ds-rotulo">Valor</dt>
                  <dd class="ds-valor">
                    {{ formatarMoeda(escolha.servico.preco) }}
                  </dd>
                </div>
              </dl>
            </DsCartao>
          </aside>
        </div>
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
  max-width: 64rem;
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
.reservado {
  max-width: 40rem;
}
.corpo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  gap: var(--esp-6);
  align-items: start;
}
.etapas {
  display: grid;
  gap: var(--esp-4);
}
.resumo {
  display: none;
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
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: var(--esp-2);
}
.dias {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: var(--esp-2);
}
.opcao {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--esp-3);
  min-height: 64px;
  padding: var(--esp-3) var(--esp-4);
  border: 2px solid var(--linha-forte);
  border-radius: var(--raio-sm);
  background: var(--placa);
  color: var(--grafite);
  font: var(--tipo-corpo-lg);
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
  font: var(--tipo-corpo);
  white-space: nowrap;
}
.saudacao {
  display: grid;
  justify-items: start;
  gap: var(--esp-1);
  padding: var(--esp-3) var(--esp-4);
  border-left: 4px solid var(--sucesso);
  border-radius: var(--raio-sm);
  background: var(--sucesso-suave);
}
.saudacao--nova {
  border-left-color: var(--aco);
  background: var(--aco-suave);
}
.saudacao__titulo {
  font: var(--tipo-subtitulo);
  letter-spacing: var(--tipo-subtitulo-espacamento);
  text-transform: uppercase;
}
.erro {
  color: var(--perigo);
  font: var(--tipo-corpo-sm);
}
.navegacao {
  display: flex;
}
.detalhes {
  display: grid;
  gap: var(--esp-3);
  margin: 0;
}
.detalhes dt,
.detalhes dd {
  margin: 0;
}
.detalhes__total {
  padding-top: var(--esp-3);
  border-top: 1px solid var(--linha);
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
/* Telas estreitas: uma coluna; o cartão vira o resumo em uma linha. */
@media (max-width: 56rem) {
  .corpo {
    grid-template-columns: 1fr;
  }
  .lateral {
    display: none;
  }
  .resumo {
    display: block;
  }
}
</style>
