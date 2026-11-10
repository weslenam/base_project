// Contratos da fidelidade (planejamento 0040, etapa 4): o formato das
// respostas que o front consome. A libs/contratos junta tudo na etapa 9.
import type { ConfigFidelidade, SaldoFidelidade } from '@barbertime/dominio';

/** GET/PUT /fidelidade/config: a configuração no formato do domínio. */
export type ConfigDaFidelidade = ConfigFidelidade;

/** Linha do extrato do cliente, do mais novo para o mais antigo. */
export interface MovimentoDoExtrato {
  tipo: string;
  valor: number;
  data: string;
  expiraEm: string | null;
  comandaId: number | null;
}

/** GET /clientes/:id/fidelidade. */
export interface FidelidadeDoCliente {
  saldo: SaldoFidelidade;
  extrato: MovimentoDoExtrato[];
}

/** Crédito ganho ao receber a comanda ("+1 selo", "+R$ 3,50"). */
export interface CreditoDaComanda {
  tipo: string;
  valor: number;
}
