// BarberTime Business Center (planejamento 0028, ADR 0018): regras dos indicadores
// que a equipe da plataforma acompanha. Só números agregados, nunca dado de cliente.

import { moduloDoCatalogo, transicaoDeModulo } from './modulos.ts';

export const SELOS_DE_ATIVIDADE = Object.freeze([
  'nova',
  'ativa',
  'parada',
  'suspensa',
]);

/** Dias sem comanda paga para a barbearia ser considerada parada. */
export const DIAS_PARA_PARADA = 7;
/** Dias desde a criação em que a barbearia ainda é nova. */
export const DIAS_DE_NOVA = 14;

const DIA_MS = 86_400_000;
type Instante = Date | string | number;
const dias = (de: Instante, ate: Instante): number =>
  (new Date(ate).getTime() - new Date(de).getTime()) / DIA_MS;

/**
 * Selo de saúde da barbearia na lista do Business Center.
 * Suspensa vence tudo. Com movimento nos últimos 7 dias, ativa. Sem movimento,
 * nova se foi criada há menos de 14 dias; parada se não.
 */
export function seloDeAtividade({
  criadaEm,
  ultimaComandaPaga = null,
  suspensaEm = null,
  agora = new Date(),
}: {
  criadaEm: Instante;
  ultimaComandaPaga?: Instante | null;
  suspensaEm?: Instante | null;
  agora?: Instante;
}): 'nova' | 'ativa' | 'parada' | 'suspensa' {
  if (suspensaEm) return 'suspensa';
  if (ultimaComandaPaga && dias(ultimaComandaPaga, agora) < DIAS_PARA_PARADA)
    return 'ativa';
  if (dias(criadaEm, agora) < DIAS_DE_NOVA) return 'nova';
  return 'parada';
}

const centavos = (v: number | string | null | undefined): number =>
  Math.round(Number(v) * 100);

/** Faturamento dividido pelos atendimentos pagos, em reais com 2 casas. */
export function ticketMedio(
  faturamento: number | string | null | undefined,
  quantidade: number,
): number {
  if (!quantidade) return 0;
  return Math.round(centavos(faturamento) / quantidade) / 100;
}

/**
 * Variação percentual do mês atual sobre o anterior, com 1 casa.
 * null quando não há base (mês anterior zerado): a tela mostra "novo" em vez de ∞.
 */
export function variacao(atual: number, anterior: number): number | null {
  if (!Number(anterior)) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

export const ACOES_DE_MODULO_DA_PLATAFORMA = Object.freeze([
  'confirmar_contratacao',
  'ativar',
  'desativar',
]);

/**
 * Ações da equipe BarberTime sobre um módulo (ADR 0011: sem cobrança no MVP, a
 * contratação é confirmada à mão). Diferente da barbearia, o operador ativa um
 * adicional sem pedido e desativa também o que está só solicitado.
 */
export function transicaoPelaPlataforma(
  chave: string,
  estadoAtual = 'inativo',
  acao: string,
): { estado?: string; erro?: string } {
  const modulo = moduloDoCatalogo(chave);
  if (!modulo) return { erro: 'Módulo desconhecido.' };
  if (acao === 'confirmar_contratacao')
    return transicaoDeModulo(chave, estadoAtual, acao);
  if (acao === 'ativar')
    return estadoAtual === 'ativo'
      ? { erro: `${modulo.nome} já está ativo.` }
      : { estado: 'ativo' };
  if (acao === 'desativar')
    return estadoAtual === 'inativo'
      ? { erro: `${modulo.nome} já está inativo.` }
      : { estado: 'inativo' };
  return { erro: 'Ação desconhecida.' };
}
