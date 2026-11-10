// Regras de negócio compartilhadas entre o app e a API (scope:shared).
export {
  ESTADOS_DE_AGENDAMENTO,
  ocupaHorario,
  paraMinutos,
  paraHora,
  fimDe,
  sobrepoe,
  horariosLivres,
  naGrade,
  hojeIso,
  somarDias,
  diaDaSemana,
} from './agenda.js';
export {
  FORMAS_DE_PAGAMENTO,
  totalDaComanda,
  motivoParaNaoReceber,
  resumoDoCaixa,
  diferencaDeCaixa,
  resumoDeComandas,
} from './caixa.js';
export {
  PERMISSOES,
  CHAVES_DE_PERMISSAO,
  PAPEIS_PADRAO,
  permissoesInvalidas,
  nivelDoPapel,
  papeisAbaixoDe,
  permissoesDoPapel,
  podeAgirSobre,
  permissoesEfetivas,
  permissoesPorGrupo,
  podeMarcarNaAgenda,
  podeAgirNaAgenda,
  podeAgirNoBalcao,
  papelSemMenu,
} from './permissoes.js';
export {
  ACOES_DAS_PERMISSOES,
  historiaDoPapel,
  resumoDoPapel,
} from './historias.js';
export {
  MODULOS,
  CHAVES_DE_MODULO,
  ESTADOS_DE_MODULO,
  moduloDoCatalogo,
  transicaoDeModulo,
} from './modulos.js';
export { somarMeses, diasEntre, inicioDaSemana, diaEMes } from './agenda.js';
export {
  FIDELIDADE_PADRAO,
  validarConfigFidelidade,
  creditosDaComanda,
  saldoDeFidelidade,
  limiteDeCashback,
  motivoParaUsarCashback,
  motivoParaUsarPremio,
} from './fidelidade.js';
export {
  TIPOS_DE_PACOTE,
  validarPacote,
  vigenciaDoPacote,
  saldoDoPacote,
  podeUsarPacote,
  renovarAssinatura,
  cicloDaRenovacao,
} from './pacotes.js';
export {
  DIAS_DA_SEMANA,
  CONFIG_BARBEARIA_PADRAO,
  LIMITES_DO_AGENDAMENTO,
  SLUG,
  MODOS_DA_PAGINA_PUBLICA,
  mesclarConfigBarbearia,
  validarConfigBarbearia,
  momentoNoFuso,
  janelaDoAgendamentoOnline,
} from './barbearia.js';
export {
  ESTADOS_DE_ATENDIMENTO,
  BALCAO_PADRAO,
  podeTransitar,
  estadoNaAgenda,
  atrasado,
  ordenarFila,
  situacaoDosBarbeiros,
  sugerirEncaixe,
} from './balcao.js';
export {
  TIPOS_DE_PRODUTO,
  UNIDADES,
  arredondarQuantidade,
  sugestaoDeCompra,
  baixasDaComanda,
  ajusteDeInventario,
  totalDaCompra,
  dividirParcelas,
  motivoParcelasInvalidas,
  documentoValido,
} from './estoque.js';
export {
  SELOS_DE_ATIVIDADE,
  DIAS_PARA_PARADA,
  DIAS_DE_NOVA,
  seloDeAtividade,
  ticketMedio,
  variacao,
  ACOES_DE_MODULO_DA_PLATAFORMA,
  transicaoPelaPlataforma,
} from './plataforma.js';
export {
  TIPOS_DE_CONTA,
  FORMAS_DE_BAIXA,
  situacaoDaConta,
  validarConta,
  validarBaixa,
  movimentoDaBaixa,
  totaisDasContas,
} from './financeiro.js';
