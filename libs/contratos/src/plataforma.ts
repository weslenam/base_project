// Contratos do Business Center (planejamento 0028; tipos no planejamento 0040,
// etapa 4): o formato das respostas de /api/plataforma que o app
// business-center consome.

/** Operador como aparece nas respostas (sem token). */
export interface OperadorPublico {
  id: number;
  nome: string;
  email: string;
}

export type SeloDeAtividade = 'nova' | 'ativa' | 'parada' | 'suspensa';

/** Dados da barbearia que o operador vê (sem dado de cliente). */
export interface BarbeariaDaPlataforma {
  id: number;
  nome: string;
  slug: string;
  criadaEm: Date;
  suspensaEm: Date | null;
  motivoSuspensao: string | null;
}

/** Linha de `GET /barbearias` (só agregados). */
export interface BarbeariaNaLista extends BarbeariaDaPlataforma {
  faturamentoMes: number | null;
  /** Data (AAAA-MM-DD) do caixa da última comanda paga. */
  ultimaComandaPaga: string | null;
  modulosPendentes: number | null;
  donoNome: string | null;
  donoEmail: string | null;
  selo: SeloDeAtividade;
}

/** Atual, anterior e variação percentual (null sem base). */
export interface Comparativo {
  atual: number;
  anterior: number;
  variacao: number | null;
}

export interface ItemDoRanking {
  nome: string | undefined;
  quantidade: number;
  valor: number;
}

export interface CaixaDoPainel {
  data: string;
  abertoAs: string;
  valorInicial: number;
  totalRecebido: number;
  dinheiroEsperado: number;
  pagas: number;
  abertas: number;
}

export interface UsuarioDoPainel {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  papelChave: string;
  papelNome: string;
}

export interface ModuloDoPainel {
  chave: string;
  nome: string;
  tipo: string;
  estado: string;
  atualizadoEm: Date | null;
}

/** Indicadores da barbearia lidos no contexto dela (RLS). */
export interface IndicadoresDoPainel {
  mes: { inicio: string; anterior: string; hoje: string };
  faturamento: Comparativo;
  atendimentos: Comparativo;
  ticketMedio: Comparativo;
  clientes: { total: number; novos: number; atendidos: number };
  agendamentos: { marcados: number; noShow: number; cancelados: number };
  topServicos: ItemDoRanking[];
  topProdutos: ItemDoRanking[];
  porDia: { data: string; valor: number }[];
  caixa: CaixaDoPainel | null;
  /** Equipe da barbearia (não são clientes): necessária para transferir o Dono. */
  usuarios: UsuarioDoPainel[];
  modulos: ModuloDoPainel[];
}

export interface RegistroDeAuditoria {
  id: number;
  acao: string;
  motivo: string | null;
  dados: unknown;
  criadaEm: Date;
  operadorNome: string;
}

/** `GET /barbearias/:id`. */
export interface PainelDaBarbearia extends IndicadoresDoPainel {
  barbearia: BarbeariaDaPlataforma & {
    ultimaComandaPaga: string | null;
    selo: SeloDeAtividade;
  };
  auditoria: RegistroDeAuditoria[];
}

/** `POST /barbearias/:id/modulos/:chave/:acao`. */
export interface MudancaDeModulo {
  chave: string;
  de: string;
  para: string;
}

/** `POST /barbearias/:id/dono`. */
export interface TransferenciaDeDono {
  novoDono: number;
  antigosDonos: number[];
}
