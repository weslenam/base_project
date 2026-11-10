// Contratos dos cadastros (planejamento 0019; tipos no planejamento 0040,
// etapa 4): serviços, produtos e equipe como o front os recebe.

export interface Servico {
  id: number;
  nome: string;
  /** Minutos. */
  duracao: number;
  preco: number;
}

/** Produto completo (quem tem `estoque.ver`). */
export interface Produto {
  id: number;
  nome: string;
  /** null no consumível (uso interno). */
  preco: number | null;
  comissao: number;
  tipo: string;
  unidade: string;
  estoqueMinimo: number;
  ultimoCusto: number | null;
  saldo: number;
}

/** Produto sem custo e saldo (quem não vê o estoque, planejamento 0027). */
export type ProdutoSemCusto = Omit<Produto, 'ultimoCusto' | 'saldo'>;

export interface Barbeiro {
  id: number;
  nome: string;
  /** Expediente HH:MM. */
  inicio: string;
  fim: string;
  comissao: number;
  /** Conta ligada (agenda própria). */
  usuarioId: number | null;
  emPausa: boolean;
}

/** Conta da barbearia que pode ser ligada a um barbeiro. */
export interface ContaDaBarbearia {
  id: number;
  nome: string;
  email: string;
}
