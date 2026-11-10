// Interface da camada de dados do app (planejamento 0040, etapa 9). As duas
// implementações a cumprem: a API real (apiHttp.ts) e a de memória (api.ts,
// usada nos testes do front e com VITE_DADOS=exemplo). As respostas vêm dos
// contratos da API, como chegam pelo JSON (EmJson).
import type {
  AgendamentoPublico,
  AjusteDeInventario,
  AssinaturaDoCliente,
  AtendimentoNaAgenda,
  Barbeiro,
  BloqueioNaAgenda,
  CaixaComResumo,
  CategoriaFinanceira,
  ClienteComResumo,
  ComandaDoCaixa,
  ComandaRecebida,
  ComandasDoCliente,
  Compra,
  CompraNaLista,
  ConfigDaFidelidade,
  ContaDaBarbearia,
  ContaFinanceira,
  DetalheDoAgendamento,
  EmJson,
  Fornecedor,
  ItemDaAgenda,
  ItemDaFicha,
  MovimentoDeEstoque,
  MovimentoDoExtrato,
  PacoteDoCatalogo,
  PaginaPublica,
  PodeUsarPacote,
  Produto,
  ProdutoNoEstoque,
  ProdutoSemCusto,
  ResumoDoCliente,
  Servico,
  VendaDePacote,
} from '@barbertime/contratos';
import type { SaldoFidelidade, sugestaoDeCompra } from '@barbertime/dominio';

/**
 * Corpo enviado por um formulário. Fica aberto nesta etapa: o formato de cada
 * entrada se firma quando a tela que o monta vira TypeScript.
 */
export type Corpo = Record<string, unknown>;

/** Agendamento novo: clienteId (balcão) ou cliente { nome, telefone } (página pública). */
export interface NovoAgendamento {
  data: string;
  inicio: string;
  barbeiroId: number;
  servicoId: number;
  clienteId?: number | null;
  cliente?: { nome?: string; telefone?: string } | null;
}

/** Bloqueio de horário na agenda. */
export interface NovoBloqueio {
  data: string;
  inicio: string;
  fim: string;
  barbeiroId: number;
  motivo?: string;
}

/** Horário da grade de agendamento. */
export interface HorarioLivre {
  hora: string;
  disponivel: boolean;
}

/** CRUD padrão: listar, salvar (POST/PUT pelo id) e excluir. */
export interface Recurso<T> {
  listar: () => Promise<T[]>;
  salvar: (d: Corpo) => Promise<T>;
  excluir: (id: number) => Promise<unknown>;
}

export interface Api {
  servicos: Recurso<EmJson<Servico>> & {
    contarFuturos: (id: number) => Promise<number>;
  };
  produtos: Recurso<EmJson<Produto | ProdutoSemCusto>>;
  estoque: {
    obter: () => Promise<{
      produtos: EmJson<ProdutoNoEstoque>[];
      comprar: ReturnType<typeof sugestaoDeCompra>;
    }>;
    movimentos: (filtro?: {
      produtoId?: number;
      limite?: number;
    }) => Promise<EmJson<MovimentoDeEstoque>[]>;
    consumir: (d: Corpo) => Promise<EmJson<ProdutoNoEstoque>>;
    inventario: (
      itens: { produtoId: number; contado: number }[],
    ) => Promise<{ ajustes: EmJson<AjusteDeInventario>[] }>;
  };
  fichas: {
    obter: (servicoId: number) => Promise<EmJson<ItemDaFicha>[]>;
    salvar: (
      servicoId: number,
      itens: Corpo[],
    ) => Promise<EmJson<ItemDaFicha>[]>;
  };
  fornecedores: Recurso<EmJson<Fornecedor>>;
  compras: {
    listar: () => Promise<EmJson<CompraNaLista>[]>;
    obter: (id: number) => Promise<EmJson<Compra>>;
    registrar: (d: Corpo) => Promise<EmJson<Compra>>;
    cancelar: (id: number) => Promise<EmJson<Compra>>;
  };
  barbeiros: Recurso<EmJson<Barbeiro>> & {
    contas: () => Promise<EmJson<ContaDaBarbearia>[]>;
  };
  clientes: Recurso<EmJson<ClienteComResumo>> & {
    listar: (filtro?: {
      busca?: string;
    }) => Promise<EmJson<ClienteComResumo>[]>;
    obter: (id: number) => Promise<EmJson<ClienteComResumo>>;
    resumo: (id: number) => Promise<EmJson<ResumoDoCliente>>;
    comandas: (
      id: number,
      pagina?: { limite?: number; deslocamento?: number },
    ) => Promise<EmJson<ComandasDoCliente>>;
    historico: (id: number) => Promise<EmJson<AtendimentoNaAgenda>[]>;
  };
  agendamentos: {
    listarDoDia: (data: string) => Promise<EmJson<ItemDaAgenda>[]>;
    obter: (id: number) => Promise<EmJson<DetalheDoAgendamento>>;
    horariosLivres: (p: {
      data: string;
      barbeiroId: number;
      servicoId: number;
    }) => Promise<HorarioLivre[]>;
    criar: (d: NovoAgendamento) => Promise<EmJson<AtendimentoNaAgenda>>;
    bloquear: (d: NovoBloqueio) => Promise<EmJson<BloqueioNaAgenda>>;
    alterarEstado: (
      id: number,
      estado: string,
    ) => Promise<EmJson<AtendimentoNaAgenda>>;
  };
  fidelidade: {
    obterConfig: () => Promise<EmJson<ConfigDaFidelidade>>;
    salvarConfig: (
      config: ConfigDaFidelidade,
    ) => Promise<EmJson<ConfigDaFidelidade>>;
    saldo: (clienteId: number) => Promise<EmJson<SaldoFidelidade>>;
    extrato: (clienteId: number) => Promise<EmJson<MovimentoDoExtrato>[]>;
  };
  pacotes: Recurso<EmJson<PacoteDoCatalogo>>;
  assinaturas: {
    doCliente: (clienteId: number) => Promise<EmJson<AssinaturaDoCliente>[]>;
    vender: (d: {
      clienteId: number;
      pacoteId: number;
      barbeiroId?: number | null;
    }) => Promise<EmJson<VendaDePacote>>;
    renovar: (
      id: number,
      d?: { barbeiroId?: number | null },
    ) => Promise<EmJson<VendaDePacote>>;
    podeUsar: (p: {
      assinaturaId: number;
      servicoId: number;
      jaNaComanda?: unknown[];
    }) => Promise<EmJson<PodeUsarPacote>>;
  };
  financeiro: {
    categorias: Recurso<EmJson<CategoriaFinanceira>>;
    contas: {
      listar: (filtros?: Corpo) => Promise<EmJson<ContaFinanceira>[]>;
      salvar: (d: Corpo) => Promise<EmJson<ContaFinanceira>>;
      cancelar: (id: number) => Promise<EmJson<ContaFinanceira>>;
      baixar: (id: number, d: Corpo) => Promise<EmJson<ContaFinanceira>>;
      estornar: (id: number) => Promise<EmJson<ContaFinanceira>>;
    };
  };
  caixa: {
    obterDoDia: () => Promise<EmJson<CaixaComResumo> | null>;
    abrir: (d: Corpo) => Promise<EmJson<CaixaComResumo>>;
    fechar: (d: Corpo) => Promise<EmJson<CaixaComResumo>>;
  };
  comandas: {
    listarDoDia: () => Promise<EmJson<ComandaDoCaixa>[]>;
    obter: (id: number) => Promise<EmJson<ComandaDoCaixa>>;
    salvar: (d: Corpo) => Promise<EmJson<ComandaDoCaixa>>;
    receber: (id: number, d?: Corpo) => Promise<EmJson<ComandaRecebida>>;
    cancelar: (id: number) => Promise<EmJson<ComandaDoCaixa>>;
    abrirDoAgendamento: (id: number) => Promise<EmJson<ComandaDoCaixa>>;
  };
  publico: {
    carregar: (slug: string, codigo?: string) => Promise<EmJson<PaginaPublica>>;
    horarios: (
      slug: string,
      codigo: string | undefined,
      p: { data: string; barbeiroId: number; servicoId: number },
    ) => Promise<HorarioLivre[]>;
    reconhecer: (
      slug: string,
      codigo: string | undefined,
      telefone: string,
    ) => Promise<{ primeiroNome: string } | null>;
    agendar: (
      slug: string,
      codigo: string | undefined,
      d: NovoAgendamento,
    ) => Promise<EmJson<AgendamentoPublico>>;
  };
  /** Só para testes e para o botão "restaurar exemplo" (memória). */
  reiniciar: () => void;
  /** A sessão informa os módulos ativos (a memória credita fidelidade só com o módulo ativo). */
  definirModulosAtivos: (lista?: string[]) => void;
}
