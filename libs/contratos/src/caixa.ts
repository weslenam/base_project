// Contratos do caixa e das comandas (planejamento 0040, etapa 4): o formato
// das respostas que o front consome. A libs/contratos junta tudo na etapa 9.
import type { ItemComanda, resumoDoCaixa } from '@barbertime/dominio';
import type { CreditoDaComanda } from './fidelidade.ts';

/** Caixa do dia (sem o resumo). */
export interface Caixa {
  id: number;
  data: string;
  valorInicial: number;
  aberto: boolean;
  abertoAs: string;
  fechadoAs: string | null;
  dinheiroContado: number | null;
  diferenca: number | null;
}

/** Resumo do caixa: por forma, total, dinheiro esperado e comandas em aberto. */
export type ResumoDoCaixa = ReturnType<typeof resumoDoCaixa>;

/** GET /caixa, abrir e fechar (null: o caixa de hoje ainda não foi aberto). */
export type CaixaComResumo = Caixa & { resumo: ResumoDoCaixa };

/** Comanda com os totais (GET /comandas, /comandas/:id, salvar, cancelar). */
export interface ComandaDoCaixa {
  id: number;
  caixaId: number;
  data: string;
  atendimentoId: number | null;
  clienteId: number | null;
  barbeiroId: number | null;
  hora: string;
  itens: ItemComanda[];
  forma: string | null;
  estado: string;
  pagaAs: string | null;
  premioFidelidade: boolean;
  cashbackUsado: number;
  clienteNome: string;
  barbeiroNome: string;
  // Totais (totalDaComanda); o desconto vem já em reais.
  servicos: number;
  produtos: number;
  subtotal: number;
  desconto: number;
  cashback: number;
  total: number;
}

/** POST /comandas/:id/receber: a comanda paga e os créditos da fidelidade. */
export type ComandaRecebida = ComandaDoCaixa & {
  creditos: CreditoDaComanda[];
};

/** GET /clientes/:id/resumo (planejamento 0016). */
export interface ResumoDoCliente {
  comandas: number;
  totalServicos: number;
  totalProdutos: number;
  totalGasto: number;
  ticketMedio: number;
  ultimaVisita: string | null;
  ultimoServico: {
    nome: string | undefined;
    data: string | undefined;
    barbeiroId: number | null | undefined;
    barbeiroNome: string;
  } | null;
  faltas: number;
}

/** GET /clientes/:id/comandas: página das comandas não canceladas. */
export interface ComandasDoCliente {
  total: number;
  itens: ComandaDoCaixa[];
}
