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
} from './caixa.js';
export {
  PERMISSOES,
  CHAVES_DE_PERMISSAO,
  PAPEIS_PADRAO,
  permissoesInvalidas,
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
