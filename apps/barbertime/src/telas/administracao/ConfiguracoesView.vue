<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  DsAbas,
  DsBotao,
  DsCaixaDeSelecao,
  DsFormulario,
  DsInput,
  DsInputTelefone,
  DsEscolha,
  DsPagina,
  DsQrCode,
  useDialogo,
  useNotificacao,
} from '@barbertime/ui';
import {
  DIAS_DA_SEMANA,
  LIMITES_DO_AGENDAMENTO,
  MODOS_DA_PAGINA_PUBLICA,
  validarConfigBarbearia,
} from '@barbertime/dominio';
import { administracao } from '../../dados/administracao.js';
import { ErroDeNegocio } from '../../dados/erros.js';
import { useAcao } from '../../dados/useAcao.js';
import { carregarSessao, useSessao } from '../../sessao/sessao.js';

// Configurações da barbearia (planejamento 0017, ADR 0012): dados do negócio,
// editados pelo Dono. Uma aba por assunto, para a página não rolar.
const { advertir, confirmar } = useDialogo();
const { moduloAtivo } = useSessao();
const notificar = useNotificacao();
const executar = useAcao();

const aba = ref('dados');
const abas = [
  { valor: 'dados', rotulo: 'Dados da barbearia' },
  { valor: 'funcionamento', rotulo: 'Funcionamento' },
  { valor: 'agendamento', rotulo: 'Agendamento online' },
  { valor: 'pagina', rotulo: 'Página pública' },
];

const form = ref(null);
const slugSalvo = ref('');
const salvando = ref(false);
const copiar = (v) => JSON.parse(JSON.stringify(v));

onMounted(async () => {
  const dados = await executar(() => administracao.barbearia.obter());
  if (!dados) return;
  form.value = copiar(dados);
  slugSalvo.value = dados.slug;
  modoSalvo.value = dados.configuracoes.paginaPublica.modo;
});

const link = computed(() =>
  form.value ? `${location.origin}/agendar/${form.value.slug || '...'}` : '',
);

// ---- Página pública (planejamento 0019, ADR 0013) ----
const modo = computed(() => form.value?.configuracoes.paginaPublica.modo);
const modoSalvo = ref('');
const descricaoDoModo = computed(
  () => MODOS_DA_PAGINA_PUBLICA.find((m) => m.valor === modo.value)?.descricao,
);
/** Link com o endereço e o modo SALVOS (o que o cliente vai abrir). */
const linkPublico = computed(() => {
  if (!form.value) return '';
  const base = `${location.origin}/agendar/${slugSalvo.value}`;
  return modoSalvo.value === 'com_link'
    ? `${base}?c=${form.value.tokenPublico}`
    : base;
});
const alteracaoPendente = computed(
  () =>
    form.value &&
    (modo.value !== modoSalvo.value || form.value.slug !== slugSalvo.value),
);
const textoWhatsapp = computed(
  () => `Agende seu horário na ${form.value?.nome}: ${linkPublico.value}`,
);

async function copiarLink() {
  try {
    await navigator.clipboard.writeText(linkPublico.value);
    notificar.sucesso('Link copiado.');
  } catch {
    notificar.aviso('Não deu para copiar. Selecione o link e copie.');
  }
}

function abrirPagina() {
  window.open(linkPublico.value, '_blank', 'noopener');
}

function enviarWhatsapp() {
  window.open(
    `https://wa.me/?text=${encodeURIComponent(textoWhatsapp.value)}`,
    '_blank',
    'noopener',
  );
}

async function novoCodigo() {
  const ok = await confirmar(
    'Gerar um código novo? Quem tiver o link atual não vai mais conseguir agendar; mande o link novo para os seus clientes.',
    { textoOk: 'Gerar código novo', textoCancelar: 'Manter o atual' },
  );
  if (!ok) return;
  const r = await executar(() => administracao.barbearia.novoCodigo());
  if (!r) return;
  form.value.tokenPublico = r.tokenPublico;
  notificar.sucesso('Código novo gerado. O link antigo deixou de funcionar.');
}

/** Horário do primeiro dia aberto vai para os outros dias abertos. */
function repetirHorario() {
  const dias = form.value.configuracoes.funcionamento;
  const modelo = dias.find((d) => d.aberto);
  if (!modelo) return;
  for (const d of dias) {
    if (d.aberto) Object.assign(d, { abre: modelo.abre, fecha: modelo.fecha });
  }
  notificar.info(
    `Horário de ${DIAS_DA_SEMANA[modelo.dia].toLowerCase()} aplicado aos dias abertos.`,
  );
}

const ordemDosDias = [1, 2, 3, 4, 5, 6, 0]; // a semana do balcão começa na segunda
const diasNaOrdem = computed(() =>
  ordemDosDias.map((dia) =>
    form.value.configuracoes.funcionamento.find((d) => d.dia === dia),
  ),
);

const REGRAS = [
  {
    campo: 'antecedenciaMinimaHoras',
    rotulo: 'Antecedência mínima (horas)',
    ajuda: 'O cliente não marca horário que começa antes disso',
  },
  {
    campo: 'diasAFrente',
    rotulo: 'Agenda aberta até (dias)',
    ajuda: 'Quantos dias à frente o cliente consegue marcar',
  },
  {
    campo: 'cancelamentoAteHoras',
    rotulo: 'Cancelamento até (horas antes)',
    ajuda: 'Depois disso, só a barbearia cancela',
  },
].map((r) => ({ ...r, ...LIMITES_DO_AGENDAMENTO[r.campo] }));

async function salvar() {
  const dados = copiar(form.value);
  const ag = dados.configuracoes.agendamento;
  for (const r of REGRAS) ag[r.campo] = Number(ag[r.campo]);

  if (dados.slug !== slugSalvo.value) {
    const ok = await advertir(
      `O endereço da página pública muda para /agendar/${dados.slug}. Quem tiver o link antigo (/agendar/${slugSalvo.value}) não vai mais encontrar a barbearia. Trocar mesmo assim?`,
      { textoOk: 'Trocar endereço', textoCancelar: 'Manter o atual' },
    );
    if (!ok) return;
  }

  salvando.value = true;
  const salvo = await executar(async () => {
    const motivo = validarConfigBarbearia(dados.configuracoes);
    if (motivo) throw new ErroDeNegocio(motivo);
    return administracao.barbearia.salvar(dados);
  });
  salvando.value = false;
  if (!salvo) return;
  form.value = copiar(salvo);
  slugSalvo.value = salvo.slug;
  modoSalvo.value = salvo.configuracoes.paginaPublica.modo;
  await carregarSessao(); // nome e endereço no cabeçalho e no menu
  notificar.sucesso('Configurações salvas.');
}
</script>

<template>
  <DsPagina titulo="Configurações" sobretitulo="Administração">
    <template #acoes>
      <DsBotao formulario="form-configuracoes" :carregando="salvando">
        Salvar
      </DsBotao>
    </template>

    <DsFormulario
      v-if="form"
      id="form-configuracoes"
      class="config"
      @enviar="salvar"
    >
      <DsAbas v-model="aba" :abas="abas" rotulo="Configurações da barbearia">
        <template #dados>
          <div class="grade">
            <DsInput
              v-model="form.nome"
              rotulo="Nome da barbearia"
              obrigatorio
            />
            <DsInput
              v-model="form.slug"
              rotulo="Endereço da página pública"
              :ajuda="link"
              obrigatorio
            />
            <DsInputTelefone
              v-model="form.configuracoes.contato.telefone"
              rotulo="Telefone ou WhatsApp"
            />
            <DsInput
              v-model="form.configuracoes.contato.instagram"
              rotulo="Instagram"
              dica="@suabarbearia"
            />
            <DsInput
              v-model="form.configuracoes.contato.endereco"
              class="grade__inteira"
              rotulo="Endereço"
              dica="Rua, número, bairro, cidade"
              ajuda="Aparece para o cliente na página pública"
            />
          </div>
        </template>

        <template #funcionamento>
          <ul class="dias" aria-label="Horário de funcionamento">
            <li
              v-for="d in diasNaOrdem"
              :key="d.dia"
              class="dia"
              :data-dia="d.dia"
            >
              <DsCaixaDeSelecao
                v-model="d.aberto"
                :rotulo="DIAS_DA_SEMANA[d.dia]"
              />
              <template v-if="d.aberto">
                <DsInput v-model="d.abre" tipo="hora" rotulo="Abre" />
                <DsInput v-model="d.fecha" tipo="hora" rotulo="Fecha" />
              </template>
              <span v-else class="ds-corpo-sm ds-suave dia__fechado">
                Fechado
              </span>
            </li>
          </ul>
          <DsBotao variante="fantasma" tamanho="sm" @click="repetirHorario">
            Repetir o primeiro horário nos dias abertos
          </DsBotao>
        </template>

        <template #agendamento>
          <p class="ds-corpo-sm ds-suave">
            Regras da página pública de agendamento. A recepção continua podendo
            marcar e cancelar a qualquer momento.
          </p>
          <div class="grade grade--tres">
            <DsInput
              v-for="r in REGRAS"
              :key="r.campo"
              v-model="form.configuracoes.agendamento[r.campo]"
              tipo="numero"
              :rotulo="r.rotulo"
              :ajuda="`${r.ajuda} (${r.min} a ${r.max})`"
              obrigatorio
            />
          </div>
        </template>
        <template #pagina>
          <div class="pagina">
            <p v-if="form.paginaPublicaLiberada === false" class="trava">
              A página pública de agendamento está bloqueada no sistema por
              enquanto. Você já pode deixar a escolha pronta; ela passa a valer
              quando a página for liberada.
            </p>
            <div class="pagina__modo">
              <DsEscolha
                v-model="form.configuracoes.paginaPublica.modo"
                :opcoes="MODOS_DA_PAGINA_PUBLICA"
                rotulo="Quem pode agendar pela internet"
              />
              <p class="ds-corpo-sm ds-suave">{{ descricaoDoModo }}</p>
              <p
                v-if="!moduloAtivo('agendamento_online')"
                class="ds-corpo-sm aviso"
              >
                O módulo Agendamento online está desativado: a página não abre
                para ninguém. Ative em Módulos.
              </p>
              <p v-if="alteracaoPendente" class="ds-corpo-sm aviso">
                Salve para o link abaixo passar a valer.
              </p>
            </div>
            <section
              v-if="
                modoSalvo !== 'desativada' &&
                form.paginaPublicaLiberada !== false
              "
              class="compartilhar"
              aria-label="Compartilhar a página"
            >
              <div class="compartilhar__link">
                <span class="ds-rotulo">Link para os clientes</span>
                <output class="ds-valor link">{{ linkPublico }}</output>
                <div class="compartilhar__acoes">
                  <DsBotao
                    variante="secundario"
                    tamanho="sm"
                    @click="copiarLink"
                  >
                    Copiar link
                  </DsBotao>
                  <DsBotao
                    variante="secundario"
                    tamanho="sm"
                    @click="enviarWhatsapp"
                  >
                    Enviar no WhatsApp
                  </DsBotao>
                  <DsBotao
                    variante="fantasma"
                    tamanho="sm"
                    @click="abrirPagina"
                  >
                    Abrir a página
                  </DsBotao>
                  <DsBotao
                    v-if="modoSalvo === 'com_link'"
                    variante="fantasma"
                    tamanho="sm"
                    @click="novoCodigo"
                  >
                    Gerar código novo
                  </DsBotao>
                </div>
              </div>
              <DsQrCode
                :valor="linkPublico"
                rotulo="QR code do link de agendamento"
                :tamanho="148"
              />
            </section>
          </div>
        </template>
      </DsAbas>
    </DsFormulario>
  </DsPagina>
</template>

<style scoped>
.config {
  max-width: 56rem;
}
.config p {
  margin: 0 0 var(--esp-3);
}
.grade {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--esp-3) var(--esp-4);
}
.grade--tres {
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}
.grade__inteira {
  grid-column: 1 / -1;
}
.dias {
  display: grid;
  gap: var(--esp-1);
  margin: 0 0 var(--esp-2);
  padding: 0;
  list-style: none;
}
.dia {
  display: grid;
  grid-template-columns: 9rem repeat(2, minmax(0, 10rem));
  align-items: center;
  gap: var(--esp-3);
  min-height: 3.5rem;
  padding-block: 2px;
  border-bottom: 1px solid var(--linha);
}
.dia__fechado {
  grid-column: span 2;
}
.pagina {
  display: grid;
  gap: var(--esp-4);
}
.pagina__modo {
  display: grid;
  gap: var(--esp-2);
}
.pagina__modo p {
  margin: 0;
}
.trava {
  margin: 0;
  padding: var(--esp-3) var(--esp-4);
  border-left: 3px solid var(--cobre);
  border-radius: var(--raio-sm);
  background: var(--cobre-suave);
}
.aviso {
  color: var(--cobre);
  font-weight: 600;
}
.compartilhar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--esp-4);
  padding: var(--esp-4);
  border: 1px solid var(--linha);
  border-radius: var(--raio-md);
  background: var(--placa-funda);
}
.compartilhar__link {
  display: grid;
  flex: 1 1 18rem;
  gap: var(--esp-2);
  min-width: 0;
}
.link {
  overflow-wrap: anywhere;
}
.compartilhar__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--esp-2);
}
@media (max-width: 40rem) {
  .dia {
    grid-template-columns: 1fr 1fr;
  }
  .dia > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
