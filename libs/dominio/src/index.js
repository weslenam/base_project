// Regras de negócio compartilhadas entre o app e a API (scope:shared).
export {
  ESTADOS_DE_AGENDAMENTO,
  ocupaHorario,
  paraMinutos,
  paraHora,
  fimDe,
  sobrepoe,
  horariosLivres,
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
  permissoesAlemDasSuas,
  permissoesEfetivas,
  permissoesPorGrupo,
} from './permissoes.js';
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
} from './fidelidade.js';
export {
  TIPOS_DE_PACOTE,
  validarPacote,
  vigenciaDoPacote,
  saldoDoPacote,
  podeUsarPacote,
  renovarAssinatura,
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
