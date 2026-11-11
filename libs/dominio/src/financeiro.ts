// Contas a pagar e a receber e recorrências (planejamento 0027, parte 2).
// Valores em reais; comparações em centavos para não errar no arredondamento.

import { inicioDaSemana, somarDias } from './agenda.ts';

export interface SemanaDePrevisao {
  inicio: string;
  fim: string;
  pagar: number;
  receber: number;
  saldo: number;
}

/**
 * Datas das próximas 3 ocorrências do dia `dia` (1–28) a partir de `hoje`
 * (exclusive). Mês e ano são derivados de `hoje` em diante.
 */
export function datasDeRecorrencia(dia: number, hoje: string): string[] {
  const datas: string[] = [];
  const [ano, mes] = hoje.split('-').map(Number);
  for (let i = 0; datas.length < 3; i++) {
    const totalMes = mes - 1 + i;
    const a = ano + Math.floor(totalMes / 12);
    const m = (totalMes % 12) + 1;
    const data = `${a}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (data > hoje) datas.push(data);
  }
  return datas;
}

/** Conta mínima para a previsão (open). */
export interface ContaParaPrevisao {
  tipo: string;
  valor: number;
  vencimento: string;
  situacao: string;
  categoriaNome: string;
}

/**
 * Agrupa contas abertas (vencidas e futuras) para a previsão de fluxo de
 * caixa. Vencidas: `vencimento < hoje`. Futuras: dentro de `dias` dias.
 * As semanas usam segunda-feira como início (via `inicioDaSemana`).
 */
export function agruparPrevisaoPorSemana(
  contas: ContaParaPrevisao[],
  hoje: string,
  dias: number,
): {
  semanas: SemanaDePrevisao[];
  vencidaPagar: number;
  vencidaReceber: number;
  totalPagar: number;
  totalReceber: number;
  saldoPrevisto: number;
  categorias: { nome: string; tipo: string; total: number }[];
} {
  const limite = somarDias(hoje, dias);
  const abertas = contas.filter((c) => c.situacao === 'aberta');

  let vencidaPagar = 0;
  let vencidaReceber = 0;

  // Mapa de semana → { pagar, receber } para contas futuras.
  const mapaSemanaPagar: Map<string, number> = new Map();
  const mapaSemanaReceber: Map<string, number> = new Map();
  const mapaCat: Map<string, { nome: string; tipo: string; total: number }> =
    new Map();

  for (const c of abertas) {
    const v = Math.round(c.valor * 100);
    if (c.vencimento < hoje) {
      if (c.tipo === 'pagar') vencidaPagar += v;
      else vencidaReceber += v;
      // Vencidas não entram nas semanas mas entram em categorias.
    } else if (c.vencimento <= limite) {
      const semana = inicioDaSemana(c.vencimento);
      if (c.tipo === 'pagar') {
        mapaSemanaPagar.set(semana, (mapaSemanaPagar.get(semana) ?? 0) + v);
      } else {
        mapaSemanaReceber.set(
          semana,
          (mapaSemanaReceber.get(semana) ?? 0) + v,
        );
      }
    } else {
      continue;
    }
    // Totais por categoria (vencidas + futuras no período).
    const chave = `${c.tipo}|${c.categoriaNome}`;
    const cat = mapaCat.get(chave) ?? {
      nome: c.categoriaNome,
      tipo: c.tipo,
      total: 0,
    };
    cat.total += v;
    mapaCat.set(chave, cat);
  }

  // Monta as semanas ordenadas.
  const semanas: SemanaDePrevisao[] = [];
  const todasSemanas = new Set([
    ...mapaSemanaPagar.keys(),
    ...mapaSemanaReceber.keys(),
  ]);
  for (const inicio of [...todasSemanas].sort()) {
    const pagar = (mapaSemanaPagar.get(inicio) ?? 0) / 100;
    const receber = (mapaSemanaReceber.get(inicio) ?? 0) / 100;
    semanas.push({
      inicio,
      fim: somarDias(inicio, 6),
      pagar,
      receber,
      saldo: receber - pagar,
    });
  }

  const totalPagar =
    semanas.reduce((acc, s) => acc + s.pagar, 0) + vencidaPagar / 100;
  const totalReceber =
    semanas.reduce((acc, s) => acc + s.receber, 0) + vencidaReceber / 100;

  const categorias = [...mapaCat.values()].map((c) => ({
    ...c,
    total: c.total / 100,
  }));

  return {
    semanas,
    vencidaPagar: vencidaPagar / 100,
    vencidaReceber: vencidaReceber / 100,
    totalPagar,
    totalReceber,
    saldoPrevisto: totalReceber - totalPagar,
    categorias,
  };
}

export const TIPOS_DE_CONTA: readonly string[] = Object.freeze([
  'pagar',
  'receber',
]);

/** Formas de baixa. Só `dinheiro_caixa` mexe na gaveta do caixa de hoje. */
export const FORMAS_DE_BAIXA = Object.freeze([
  { valor: 'dinheiro_caixa', rotulo: 'Dinheiro do caixa' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'banco', rotulo: 'Banco (transferência ou boleto)' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'outro', rotulo: 'Outro' },
]);

import type { Valor } from './caixa.ts';

const centavos = (v: Valor): number => Math.round(Number(v) * 100);
// Até R$ 999.999.999,99: cabe no numeric(12,2) do banco (issue #29).
const LIMITE_CENTAVOS = 99_999_999_999;
const valorValido = (v: Valor): boolean => {
  const c = centavos(v);
  return Number.isFinite(c) && c > 0 && c <= LIMITE_CENTAVOS;
};
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Situação para a tela: a guardada (aberta, quitada, cancelada), com "vencida"
 * calculada para a aberta com vencimento antes de hoje (não é guardada).
 */
/** Conta a pagar ou a receber (o que as regras usam dela). */
export interface Conta {
  tipo?: 'pagar' | 'receber' | string;
  descricao?: string;
  categoriaId?: number | null;
  valor: Valor;
  vencimento?: string;
  situacao?: 'aberta' | 'quitada' | 'cancelada' | string;
  /** Situação já calculada pela API (data da barbearia). */
  situacaoAtual?: string;
  valorPago?: Valor;
}

export interface BaixaDeConta {
  data?: string | null;
  valorPago: Valor;
  forma?: string | null;
}

export function situacaoDaConta(
  conta: Pick<Conta, 'situacao' | 'vencimento'>,
  hoje: string,
): string | undefined {
  if (
    conta.situacao === 'aberta' &&
    conta.vencimento != null &&
    conta.vencimento < hoje
  )
    return 'vencida';
  return conta.situacao;
}

/** Motivo de conta inválida (lançamento manual ou edição), ou null. */
export function validarConta(conta: Conta): string | null {
  if (!TIPOS_DE_CONTA.includes(conta.tipo ?? ''))
    return 'Escolha se a conta é a pagar ou a receber.';
  if (!String(conta.descricao ?? '').trim()) return 'Informe a descrição.';
  if (!conta.categoriaId) return 'Escolha a categoria.';
  if (!valorValido(conta.valor)) return 'Informe o valor da conta.';
  if (!DATA.test(conta.vencimento ?? '')) return 'Informe o vencimento.';
  return null;
}

/** Motivo de baixa inválida, ou null. */
export function validarBaixa({
  data,
  valorPago,
  forma,
}: BaixaDeConta): string | null {
  if (!DATA.test(data ?? '')) return 'Informe a data do pagamento.';
  if (!valorValido(valorPago)) return 'Informe o valor pago.';
  if (!FORMAS_DE_BAIXA.some((f) => f.valor === forma))
    return 'Escolha a forma de pagamento.';
  return null;
}

/**
 * Movimento de caixa de uma baixa em dinheiro da gaveta: pagar é saída,
 * receber é entrada. Outras formas não mexem no caixa (null).
 */
export function movimentoDaBaixa(
  conta: Pick<Conta, 'tipo' | 'descricao'>,
  { forma, valorPago }: BaixaDeConta,
): { tipo: 'saida' | 'entrada'; valor: number; descricao: string } | null {
  if (forma !== 'dinheiro_caixa') return null;
  return {
    tipo: conta.tipo === 'pagar' ? 'saida' : 'entrada',
    valor: centavos(valorPago) / 100,
    descricao: conta.descricao ?? '',
  };
}

/** Totais de uma lista de contas para o rodapé da tela: aberto, vencido e quitado. */
export function totaisDasContas(contas: Conta[], hoje: string) {
  const soma = { aberto: 0, vencido: 0, quitado: 0 };
  for (const c of contas) {
    // A situação já calculada pela API (data da barbearia) tem preferência.
    const s = c.situacaoAtual ?? situacaoDaConta(c, hoje);
    if (s === 'aberta') soma.aberto += centavos(c.valor);
    else if (s === 'vencida') soma.vencido += centavos(c.valor);
    else if (s === 'quitada') soma.quitado += centavos(c.valorPago ?? c.valor);
  }
  return {
    aberto: soma.aberto / 100,
    vencido: soma.vencido / 100,
    quitado: soma.quitado / 100,
  };
}
