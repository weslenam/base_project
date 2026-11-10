// Contratos dos pacotes e assinaturas (planejamento 0040, etapa 4): o formato
// das respostas que o front consome. A libs/contratos junta tudo na etapa 9.

/** Pacote do catálogo com itens e limites (GET /pacotes e o salvar). */
export interface PacoteDoCatalogo {
  id: number;
  nome: string;
  preco: number;
  tipo: string;
  validadeDias: number | null;
  itens: {
    servicoId: number;
    servicoNome: string;
    quantidade: number | null;
  }[];
  limites: {
    intervaloMinimoDias: number | null;
    maximoPorSemana: number | null;
  };
  /** Só nos pacotes já excluídos (assinaturas antigas). */
  excluido?: true;
}

/** Saldo de um serviço do pacote no ciclo. */
export interface SaldoDoServico {
  servicoId: number | null;
  servicoNome?: string;
  quantidade: number | null;
  usados: number;
  restantes: number | null;
}

/** Pacote do cliente (GET /clientes/:id/assinaturas, venda e renovação). */
export interface AssinaturaDoCliente {
  id: number;
  clienteId: number;
  pacoteId: number;
  estado: string;
  inicio: string | null;
  fim: string | null;
  comandaVendaId: number | null;
  usos: { servicoId: number; data: string; comandaId: number }[];
  renovacaoDe: number | null;
  /** Estado da renovação deste ciclo (em andamento ou paga), ou null. */
  renovacao: string | null;
  pacote: PacoteDoCatalogo;
  saldo: SaldoDoServico[];
  vigente: boolean;
  aComecar: boolean;
  /** Início do ciclo se renovar agora; null = no dia do pagamento (vencido). */
  renovaEm: string | null;
}

/** POST /assinaturas e /assinaturas/:id/renovar. */
export interface VendaDePacote {
  assinatura: AssinaturaDoCliente;
  comandaId: number;
}

/** POST /assinaturas/:id/pode-usar. */
export interface PodeUsarPacote {
  ok: boolean;
  motivo?: string;
}
