// Contratos do estoque e das compras (planejamento 0040, etapa 4): o formato
// das respostas que o front consome. A libs/contratos junta tudo na etapa 9.

/** Produto com saldo (GET /estoque e o retorno de cada movimento). */
export interface ProdutoNoEstoque {
  id: number;
  nome: string;
  tipo: string;
  unidade: string;
  preco: number | null;
  estoqueMinimo: number;
  ultimoCusto: number | null;
  saldo: number;
}

/** Linha de GET /estoque/movimentos. */
export interface MovimentoDeEstoque {
  id: number;
  produtoId: number;
  produtoNome: string;
  unidade: string;
  tipo: string;
  quantidade: number;
  custoUnitario: number | null;
  motivo: string;
  comandaId: number | null;
  compraId: number | null;
  criadoEm: Date;
  usuarioNome: string;
}

/** Item da ficha técnica de um serviço (GET/PUT /servicos/:id/ficha). */
export interface ItemDaFicha {
  produtoId: number;
  nome: string;
  unidade: string;
  quantidade: number;
  valido: boolean;
}

/** Ajuste feito pelo inventário (POST /estoque/inventario). */
export interface AjusteDeInventario {
  produtoId: number;
  nome: string;
  anterior: number;
  contado: number;
  diferenca: number;
}

export interface Fornecedor {
  id: number;
  nome: string;
  documento: string | null;
  telefone: string | null;
  observacoes: string;
}

/** Linha de GET /compras. */
export interface CompraNaLista {
  id: number;
  data: string;
  fornecedorId: number;
  fornecedorNome: string;
  total: number;
  cancelada: boolean;
  parcelas: number;
  quitadas: number;
}

/** Compra com itens e parcelas (GET /compras/:id, registrar e cancelar). */
export interface Compra {
  id: number;
  data: string;
  fornecedorId: number;
  fornecedorNome: string;
  frete: number;
  desconto: number;
  total: number;
  observacao: string;
  cancelada: boolean;
  itens: {
    produtoId: number;
    nome: string;
    unidade: string;
    quantidade: number;
    custoUnitario: number;
  }[];
  parcelas: {
    id: number;
    parcela: number | null;
    parcelas: number | null;
    valor: number;
    vencimento: string;
    situacao: string;
    pagoEm: string | null;
  }[];
}
