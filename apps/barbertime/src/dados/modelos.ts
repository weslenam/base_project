// Modelos do app como chegam da API (JSON). As telas tipam o estado com eles
// em vez de repetir EmJson<Contrato> (planejamento 0040, etapa 9).
import type {
  BarbeariaParaConfigurar,
  ModuloDaBarbearia,
  PaginaPublica,
  PapelDaBarbearia,
  UsuarioDaBarbearia,
  AssinaturaDoCliente,
  CategoriaFinanceira,
  Compra as CompraDaApi,
  CompraNaLista,
  ContaFinanceira,
  Fornecedor as FornecedorDaApi,
  ItemDaFicha,
  MovimentoDeEstoque,
  ProdutoNoEstoque,
  AtendimentoNaAgenda,
  BarbeiroNoBalcao,
  Barbeiro as BarbeiroDaApi,
  BloqueioNaAgenda,
  CaixaComResumo,
  ClienteComResumo,
  ComandaDoCaixa,
  ComandaRecebida,
  DetalheDoAgendamento,
  EmJson,
  EncaixeDoBalcao,
  ItemDaAgenda,
  ItemDaFila,
  PacoteDoCatalogo,
  PainelDoBalcao,
  Produto as ProdutoDaApi,
  ProdutoSemCusto,
  ResumoDoCliente,
  Servico as ServicoDaApi,
  ServicoDoBalcao,
} from '@barbertime/contratos';

export type Barbeiro = EmJson<BarbeiroDaApi>;
export type Servico = EmJson<ServicoDaApi>;
/** Saldo e último custo só vêm para quem vê o estoque (planejamento 0027). */
export type Produto = EmJson<ProdutoSemCusto> &
  Partial<Pick<EmJson<ProdutoDaApi>, 'saldo' | 'ultimoCusto'>>;
export type Cliente = EmJson<ClienteComResumo>;
export type Atendimento = EmJson<AtendimentoNaAgenda>;
export type Bloqueio = EmJson<BloqueioNaAgenda>;
export type ItemAgenda = EmJson<ItemDaAgenda>;
export type Detalhe = EmJson<DetalheDoAgendamento>;
export type Caixa = EmJson<CaixaComResumo>;
export type Comanda = EmJson<ComandaDoCaixa>;
export type ComandaPaga = EmJson<ComandaRecebida>;
export type ResumoCliente = EmJson<ResumoDoCliente>;
export type Pacote = EmJson<PacoteDoCatalogo>;
export type Assinatura = EmJson<AssinaturaDoCliente>;
export type Painel = EmJson<PainelDoBalcao>;
export type BarbeiroBalcao = EmJson<BarbeiroNoBalcao>;
export type NaFila = EmJson<ItemDaFila>;
export type Fornecedor = EmJson<FornecedorDaApi>;
export type Compra = EmJson<CompraDaApi>;
export type CompraResumida = EmJson<CompraNaLista>;
export type ProdutoEstoque = EmJson<ProdutoNoEstoque>;
export type MovimentoEstoque = EmJson<MovimentoDeEstoque>;
export type ItemFicha = EmJson<ItemDaFicha>;
export type ContaFin = EmJson<ContaFinanceira>;
export type Categoria = EmJson<CategoriaFinanceira>;
export type Encaixe = EmJson<EncaixeDoBalcao>;
export type ServicoBalcao = EmJson<ServicoDoBalcao>;

/** Renovação em andamento: o pacote fixo e quando o novo ciclo começa. */
export interface Renovacao {
  assinaturaId: number;
  pacoteId: number;
  inicio: string;
}

export type Usuario = EmJson<UsuarioDaBarbearia>;
export type Papel = EmJson<PapelDaBarbearia>;
export type BarbeariaEdicao = EmJson<BarbeariaParaConfigurar>;
export type Modulo = EmJson<ModuloDaBarbearia>;
export type Pagina = EmJson<PaginaPublica>;
