// Tabelas da camada de dados em memória (api.ts, planejamento 0040). São as
// linhas guardadas, não as respostas: a api.ts as completa no formato da Api.
import type {
  ConfigBarbeariaGravada,
  ConfigFidelidade,
  ItemComanda,
  MovimentoFidelidade,
  UsoDePacote,
} from '@barbertime/dominio';

export interface BarbeariaNoBanco {
  id: number;
  slug: string;
  nome: string;
  configuracoes: ConfigBarbeariaGravada;
}

export interface BarbeiroNoBanco {
  id: number;
  nome: string;
  inicio: string;
  fim: string;
  comissao: number;
  usuarioId?: number | null;
  emPausa?: boolean;
}

export interface ServicoNoBanco {
  id: number;
  nome: string;
  duracao: number;
  preco: number;
}

export interface ProdutoNoBanco {
  id: number;
  nome: string;
  preco: number | null;
  comissao: number;
  tipo: string;
  unidade: string;
  estoqueMinimo: number;
  ultimoCusto: number | null;
  saldo: number;
}

export interface FornecedorNoBanco {
  id: number;
  nome: string;
  documento: string | null;
  telefone: string | null;
  observacoes: string;
}

export interface ParcelaNoBanco {
  id: number;
  parcela: number | null;
  parcelas: number | null;
  valor: number;
  vencimento: string;
  situacao: string;
  pagoEm: string | null;
}

export interface CompraNoBanco {
  id: number;
  fornecedorId: number;
  data: string;
  frete: number;
  desconto: number;
  total: number;
  observacao: string;
  cancelada: boolean;
  itens: { produtoId: number; quantidade: number; custoUnitario: number }[];
  parcelas: ParcelaNoBanco[];
}

export interface MovimentoDeEstoqueNoBanco {
  id: number;
  produtoId: number;
  tipo: string;
  quantidade: number;
  custoUnitario: number | null;
  motivo: string;
  comandaId: number | null;
  compraId: number | null;
  criadoEm: string;
  usuarioNome: string;
}

export interface CategoriaNoBanco {
  id: number;
  tipo: string;
  nome: string;
  ativa: boolean;
}

export interface ContaNoBanco {
  id: number;
  tipo: string;
  descricao: string;
  categoriaId: number;
  valor: number;
  vencimento: string;
  fornecedorId: number | null;
  clienteId: number | null;
  compraId: number | null;
  recorrenciaId?: number | null;
  parcela?: number | null;
  parcelas?: number | null;
  origem: string;
  situacao: string;
  pagoEm: string | null;
  valorPago: number | null;
  forma: string | null;
}

export interface RecorrenciaNoBanco {
  id: number;
  tipo: string;
  descricao: string;
  categoriaId: number;
  valor: number;
  diaDoMes: number;
  fornecedorId: number | null;
  encerradaEm: string | null;
}

export interface MovimentoDeCaixaNoBanco {
  id: number;
  caixaId: number;
  contaId: number | null;
  tipo: string;
  valor: number;
  descricao?: string;
  estornado?: boolean;
  [campo: string]: unknown;
}

export interface FichaNoBanco {
  servicoId: number;
  produtoId: number;
  quantidade: number;
}

export interface ClienteNoBanco {
  id: number;
  nome: string;
  telefone: string;
  cpf: string | null;
  observacoes: string;
}

/** Movimento do extrato de fidelidade, com o cliente. */
export type MovimentoDeFidelidadeNoBanco = MovimentoFidelidade & {
  clienteId: number | null;
};

export interface PacoteNoBanco {
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
  excluido?: true;
}

export interface AssinaturaNoBanco {
  id: number;
  clienteId: number;
  pacoteId: number;
  estado: string;
  comandaVendaId: number | null;
  inicio: string | null;
  fim: string | null;
  usos: (UsoDePacote & { comandaId?: number | null })[];
  renovacaoDe?: number | null;
}

export interface CaixaNoBanco {
  id: number;
  data: string;
  valorInicial: number;
  aberto: boolean;
  abertoAs: string;
  fechadoAs?: string;
  dinheiroContado?: number;
  diferenca?: number;
}

export interface ComandaNoBanco {
  id: number;
  caixaId: number;
  hora: string;
  clienteId: number | null;
  barbeiroId: number | null;
  agendamentoId: number | null;
  itens: ItemComanda[];
  desconto: number;
  forma: string | null;
  estado: string;
  cashbackUsado?: number;
  premioFidelidade?: boolean;
  pagaAs?: string | null;
}

export interface AgendamentoNoBanco {
  id: number;
  data: string;
  inicio: string;
  fim: string;
  barbeiroId: number;
  servicoId: number | null;
  clienteId: number | null;
  estado: string;
  motivo?: string;
}

export interface ComissaoNoBanco {
  id: number;
  barbeiroId: number;
  comandaId: number;
  dataComanda: string;
  baseCalculo: number;
  taxa: number;
  valor: number;
  observacao: string | null;
  fechamentoId: number | null;
}

export interface ComissaoFechamentoNoBanco {
  id: number;
  barbeiroId: number;
  de: string;
  ate: string;
  total: number;
  fechadoPor: number | null;
  fechadoEm: string;
}

/** O "banco" em memória inteiro. */
export interface Banco {
  barbearia: BarbeariaNoBanco;
  barbeiros: BarbeiroNoBanco[];
  servicos: ServicoNoBanco[];
  produtos: ProdutoNoBanco[];
  fornecedores: FornecedorNoBanco[];
  compras: CompraNoBanco[];
  movimentosEstoque: MovimentoDeEstoqueNoBanco[];
  categoriasFinanceiras: CategoriaNoBanco[];
  contas: ContaNoBanco[];
  recorrencias: RecorrenciaNoBanco[];
  movimentosCaixa: MovimentoDeCaixaNoBanco[];
  fichas: FichaNoBanco[];
  clientes: ClienteNoBanco[];
  fidelidade: ConfigFidelidade;
  extratoFidelidade: MovimentoDeFidelidadeNoBanco[];
  pacotes: PacoteNoBanco[];
  assinaturas: AssinaturaNoBanco[];
  caixas: CaixaNoBanco[];
  comandas: ComandaNoBanco[];
  agendamentos: AgendamentoNoBanco[];
  comissoes: ComissaoNoBanco[];
  comissoesFechamentos: ComissaoFechamentoNoBanco[];
}

/** Tabelas com `id`, para o `buscar` e o `proximoId`. */
export type TabelaComId = {
  [K in keyof Banco]: Banco[K] extends { id: number }[] ? K : never;
}[keyof Banco];
