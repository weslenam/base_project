import { calcularComissao, totalDaComanda } from '@barbertime/dominio';
import type { ItemComanda } from '@barbertime/dominio';
import type { Conexao } from '../infra/banco.ts';
import { moduloAtivo } from './estoque.ts';

export interface ComandaParaComissao {
  id: number;
  barbeiroId: number | null;
  desconto: number;
  cashbackUsado: number;
  itens: ItemComanda[];
  caixaId: number;
}

export interface LinhaDeComissao {
  id: number;
  barbeiroId: number;
  barbeiroNome: string;
  comandaId: number;
  dataComanda: string;
  baseCalculo: number;
  taxa: number;
  valor: number;
  observacao: string | null;
  fechamentoId: number | null;
}

export interface FechamentoDeComissao {
  id: number;
  barbeiroId: number;
  barbeiroNome: string;
  de: string;
  ate: string;
  total: number;
  fechadoPor: number | null;
  fechadoEm: string;
}

/** Ao receber a comanda: gera a linha de comissão se o módulo estiver ativo. */
export async function comissaoAoReceber(
  c: Conexao,
  barbeariaId: number,
  cm: ComandaParaComissao,
  dataComanda: string,
): Promise<void> {
  if (!cm.barbeiroId) return;
  if (!(await moduloAtivo(c, 'comissoes'))) return;

  const barbeiro = await c.db
    .selectFrom('barbeiros')
    .select(['comissao'])
    .where('id', '=', cm.barbeiroId)
    .where('barbeariaId', '=', barbeariaId)
    .executeTakeFirst();
  if (!barbeiro) return;

  const taxa = Number(barbeiro.comissao);
  if (taxa <= 0) return;

  const { total } = totalDaComanda({
    itens: cm.itens,
    desconto: cm.desconto,
    cashbackUsado: cm.cashbackUsado,
  });
  const { baseCalculo, valor } = calcularComissao({ total, taxa });

  await c.db
    .insertInto('comissoes')
    .values({
      barbeariaId,
      barbeiroId: cm.barbeiroId,
      comandaId: cm.id,
      dataComanda,
      baseCalculo: baseCalculo.toString(),
      taxa: taxa.toString(),
      valor: valor.toString(),
    })
    .execute();
}

export async function listarComissoes(
  c: Conexao,
  barbeariaId: number,
  de: string,
  ate: string,
  barbeiroId?: number,
): Promise<LinhaDeComissao[]> {
  let q = c.db
    .selectFrom('comissoes as co')
    .innerJoin('barbeiros as b', 'b.id', 'co.barbeiroId')
    .select([
      'co.id',
      'co.barbeiroId',
      'b.nome as barbeiroNome',
      'co.comandaId',
      'co.dataComanda',
      'co.baseCalculo',
      'co.taxa',
      'co.valor',
      'co.observacao',
      'co.fechamentoId',
    ])
    .where('co.barbeariaId', '=', barbeariaId)
    .where('co.dataComanda', '>=', de)
    .where('co.dataComanda', '<=', ate)
    .orderBy('co.dataComanda', 'asc');

  if (barbeiroId) q = q.where('co.barbeiroId', '=', barbeiroId);

  const linhas = await q.execute();
  return linhas.map((l) => ({
    id: l.id,
    barbeiroId: l.barbeiroId,
    barbeiroNome: l.barbeiroNome,
    comandaId: l.comandaId,
    dataComanda: l.dataComanda,
    baseCalculo: Number(l.baseCalculo),
    taxa: Number(l.taxa),
    valor: Number(l.valor),
    observacao: l.observacao,
    fechamentoId: l.fechamentoId,
  }));
}

export async function fecharComissao(
  c: Conexao,
  barbeariaId: number,
  barbeiroId: number,
  de: string,
  ate: string,
  usuarioId: number,
): Promise<FechamentoDeComissao> {
  const linhas = await listarComissoes(c, barbeariaId, de, ate, barbeiroId);
  const abertas = linhas.filter((l) => !l.fechamentoId);
  const total = abertas.reduce((s, l) => s + l.valor, 0);

  const [fechamento] = await c.db
    .insertInto('comissoesFechamentos')
    .values({
      barbeariaId,
      barbeiroId,
      de,
      ate,
      total: total.toString(),
      fechadoPor: usuarioId,
    })
    .returning(['id', 'de', 'ate', 'total', 'fechadoPor', 'fechadoEm'])
    .execute();

  if (abertas.length > 0) {
    await c.db
      .updateTable('comissoes')
      .set({ fechamentoId: fechamento.id })
      .where(
        'id',
        'in',
        abertas.map((l) => l.id),
      )
      .execute();
  }

  const barbeiro = await c.db
    .selectFrom('barbeiros')
    .select('nome')
    .where('id', '=', barbeiroId)
    .executeTakeFirstOrThrow();

  return {
    id: fechamento.id,
    barbeiroId,
    barbeiroNome: barbeiro.nome,
    de: fechamento.de,
    ate: fechamento.ate,
    total: Number(fechamento.total),
    fechadoPor: fechamento.fechadoPor,
    fechadoEm: String(fechamento.fechadoEm),
  };
}
