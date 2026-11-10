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
} from './agenda.ts';
export {
  FORMAS_DE_PAGAMENTO,
  totalDaComanda,
  motivoParaNaoReceber,
  resumoDoCaixa,
  diferencaDeCaixa,
  resumoDeComandas,
} from './caixa.ts';
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
} from './permissoes.ts';
export {
  ACOES_DAS_PERMISSOES,
  historiaDoPapel,
  resumoDoPapel,
} from './historias.ts';
export {
  MODULOS,
  CHAVES_DE_MODULO,
  ESTADOS_DE_MODULO,
  moduloDoCatalogo,
  transicaoDeModulo,
} from './modulos.ts';
export { somarMeses, diasEntre, inicioDaSemana, diaEMes } from './agenda.ts';
export {
  FIDELIDADE_PADRAO,
  validarConfigFidelidade,
  creditosDaComanda,
  saldoDeFidelidade,
  limiteDeCashback,
  motivoParaUsarCashback,
  motivoParaUsarPremio,
} from './fidelidade.ts';
export {
  TIPOS_DE_PACOTE,
  validarPacote,
  vigenciaDoPacote,
  saldoDoPacote,
  podeUsarPacote,
  renovarAssinatura,
  cicloDaRenovacao,
} from './pacotes.ts';
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
} from './barbearia.ts';
export {
  ESTADOS_DE_ATENDIMENTO,
  BALCAO_PADRAO,
  podeTransitar,
  estadoNaAgenda,
  atrasado,
  ordenarFila,
  situacaoDosBarbeiros,
  sugerirEncaixe,
} from './balcao.ts';
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
} from './estoque.ts';
export {
  SELOS_DE_ATIVIDADE,
  DIAS_PARA_PARADA,
  DIAS_DE_NOVA,
  seloDeAtividade,
  ticketMedio,
  variacao,
  ACOES_DE_MODULO_DA_PLATAFORMA,
  transicaoPelaPlataforma,
} from './plataforma.ts';
export {
  TIPOS_DE_CONTA,
  FORMAS_DE_BAIXA,
  situacaoDaConta,
  validarConta,
  validarBaixa,
  movimentoDaBaixa,
  totaisDasContas,
} from './financeiro.ts';

// Tipos do domínio (planejamento 0040).
export type { Intervalo } from './agenda.ts';
export type { Valor, ItemComanda, Comanda, MovimentoDeCaixa } from './caixa.ts';
export type { Permissao, Papel, QuemAge } from './permissoes.ts';
export type { Modulo } from './modulos.ts';
export type {
  DiaDeFuncionamento,
  ConfigBarbearia,
  ConfigBarbeariaGravada,
} from './barbearia.ts';
export type {
  AtendimentoBalcao,
  BarbeiroBalcao,
  SituacaoDoBarbeiro,
} from './balcao.ts';
export type {
  ConfigFidelidade,
  MovimentoFidelidade,
  SaldoFidelidade,
} from './fidelidade.ts';
export type { Pacote, UsoDePacote, Assinatura } from './pacotes.ts';
export type { ProdutoEstoque, LinhaDeFicha, Baixa } from './estoque.ts';
export type { Conta, BaixaDeConta } from './financeiro.ts';
