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
