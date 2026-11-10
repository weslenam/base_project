import {
  FIDELIDADE_PADRAO,
  creditosDaComanda,
  motivoParaUsarCashback,
  motivoParaUsarPremio,
  saldoDeFidelidade,
  validarConfigFidelidade,
} from '@barbertime/dominio';
import type {
  Comanda,
  ConfigFidelidade,
  ItemComanda,
  SaldoFidelidade,
  Valor,
} from '@barbertime/dominio';
import { sql } from 'kysely';
import { conflito, invalido } from '../infra/erros.ts';
import type { Conexao } from '../infra/banco.ts';
import type {
  CreditoDaComanda,
  MovimentoDoExtrato,
} from './fidelidade.contratos.ts';

// Fidelidade no banco (planejamento 0034, etapa A; regras do 0015). Tudo roda
// no contexto da barbearia (RLS). O extrato só recebe inserções: o saldo é a
// soma, gastando primeiro o crédito que vence antes (domínio).

export async function obterConfig(c: Conexao): Promise<ConfigFidelidade> {
  const r = await c.db
    .selectFrom('fidelidadeConfig')
    .select([
      'selosAtivo',
      'selosNecessarios',
      'selosValidadeMeses',
      'cashbackAtivo',
      'cashbackPercentual',
      'cashbackValidadeDias',
    ])
    // Prêmio de serviço excluído do catálogo volta vazio: a tela pede outro
    // (planejamento 0037).
    .select((eb) =>
      eb
        .case()
        .when(
          eb.exists(
            eb
              .selectFrom('servicos as s')
              .select('s.id')
              .whereRef('s.id', '=', 'fidelidadeConfig.premioServicoId')
              .where('s.excluidoEm', 'is', null),
          ),
        )
        .then(eb.ref('fidelidadeConfig.premioServicoId'))
        .end()
        .as('premioServicoId'),
    )
    .executeTakeFirst();
  if (!r) return structuredClone(FIDELIDADE_PADRAO);
  return {
    selos: {
      ativo: r.selosAtivo,
      necessarios: r.selosNecessarios,
      premioServicoId: r.premioServicoId,
      validadeMeses: r.selosValidadeMeses,
    },
    cashback: {
      ativo: r.cashbackAtivo,
      percentual: r.cashbackPercentual,
      validadeDias: r.cashbackValidadeDias,
    },
  };
}

const inteiroOuNulo = (v: Valor): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

/** Corpo de PUT /fidelidade/config (o schema da rota confere tipo e tamanho). */
export interface DadosDaFidelidade {
  selos?: {
    ativo?: boolean | null;
    necessarios?: Valor;
    premioServicoId?: Valor;
    validadeMeses?: Valor;
  } | null;
  cashback?: {
    ativo?: boolean | null;
    percentual?: Valor;
    validadeDias?: Valor;
  } | null;
}

const sqlAgora = () => sql<Date>`now()`;

export async function salvarConfig(
  c: Conexao,
  barbeariaId: number,
  dados: DadosDaFidelidade = {},
): Promise<ConfigFidelidade> {
  const config = {
    selos: {
      ativo: Boolean(dados.selos?.ativo),
      necessarios: Number(dados.selos?.necessarios ?? 10),
      premioServicoId: inteiroOuNulo(dados.selos?.premioServicoId),
      validadeMeses: inteiroOuNulo(dados.selos?.validadeMeses),
    },
    cashback: {
      ativo: Boolean(dados.cashback?.ativo),
      percentual: Number(dados.cashback?.percentual ?? 5),
      validadeDias: Number(dados.cashback?.validadeDias ?? 90),
    },
  };
  const motivo = validarConfigFidelidade(config);
  if (motivo) throw invalido(motivo);
  if (config.selos.premioServicoId) {
    // A RLS limita aos serviços desta barbearia; a chave estrangeira não.
    const s = await c.db
      .selectFrom('servicos')
      .select('id')
      .where('id', '=', config.selos.premioServicoId)
      .where('excluidoEm', 'is', null)
      .executeTakeFirst();
    if (!s) throw invalido('Serviço de prêmio não encontrado.');
  }
  // Com os selos desligados, os campos deles valem o padrão do banco.
  const selos = config.selos;
  const cashback = config.cashback;
  await c.db
    .insertInto('fidelidadeConfig')
    .values({
      barbeariaId,
      selosAtivo: selos.ativo,
      selosNecessarios: selos.ativo ? selos.necessarios : 10,
      premioServicoId: selos.ativo ? selos.premioServicoId : null,
      selosValidadeMeses: selos.ativo ? selos.validadeMeses : null,
      cashbackAtivo: cashback.ativo,
      cashbackPercentual: cashback.ativo ? cashback.percentual : 5,
      cashbackValidadeDias: cashback.ativo ? cashback.validadeDias : 90,
      atualizadoEm: sqlAgora(),
    })
    .onConflict((oc) =>
      oc.column('barbeariaId').doUpdateSet((eb) => ({
        selosAtivo: eb.ref('excluded.selosAtivo'),
        selosNecessarios: eb.ref('excluded.selosNecessarios'),
        premioServicoId: eb.ref('excluded.premioServicoId'),
        selosValidadeMeses: eb.ref('excluded.selosValidadeMeses'),
        cashbackAtivo: eb.ref('excluded.cashbackAtivo'),
        cashbackPercentual: eb.ref('excluded.cashbackPercentual'),
        cashbackValidadeDias: eb.ref('excluded.cashbackValidadeDias'),
        atualizadoEm: sqlAgora(),
      })),
    )
    .execute();
  return obterConfig(c);
}

/** Extrato do cliente, do mais novo para o mais antigo. */
export async function extratoDoCliente(
  c: Conexao,
  clienteId: number | string,
): Promise<MovimentoDoExtrato[]> {
  return c.db
    .selectFrom('fidelidadeMovimentos')
    .select(['tipo', 'valor', 'data', 'expiraEm', 'comandaId'])
    .where('clienteId', '=', Number(clienteId))
    .orderBy('data', 'desc')
    .orderBy('id', 'desc')
    .execute();
}

export async function saldoDoCliente(
  c: Conexao,
  clienteId: number | string,
  hoje: string,
  config?: ConfigFidelidade,
): Promise<SaldoFidelidade> {
  const movimentos = await extratoDoCliente(c, clienteId);
  return saldoDeFidelidade(movimentos, config ?? (await obterConfig(c)), hoje);
}

/** Item do prêmio da fidelidade, montado pelo servidor. */
export interface ItemDoPremio {
  tipo: 'servico';
  refId: number;
  nome: string;
  preco: 0;
  quantidade: 1;
  premio: true;
}

/** Fidelidade no pedido: módulo ativo e a data da barbearia. */
export interface FidelidadeNoPedido {
  ativo: boolean;
  hoje: string;
}

/**
 * Confere o resgate pedido na comanda (prêmio e cashback) ao salvar. Devolve o
 * item do prêmio (serviço a R$ 0, nome do catálogo) ou null.
 */
export async function conferirResgate(
  c: Conexao,
  {
    clienteId,
    premioFidelidade,
    cashbackUsado,
    itens,
    desconto,
  }: {
    clienteId: number | null;
    premioFidelidade: boolean;
    cashbackUsado: number;
    itens: ItemComanda[];
    desconto: number;
  },
  { ativo, hoje }: FidelidadeNoPedido,
): Promise<{ itemPremio: ItemDoPremio | null }> {
  const querPremio = Boolean(premioFidelidade);
  const cashback = Number(cashbackUsado || 0);
  if (!querPremio && !cashback) return { itemPremio: null };
  if (!ativo)
    throw invalido('O módulo Fidelidade não está ativo nesta barbearia.');
  const config = await obterConfig(c);
  const saldo = clienteId
    ? await saldoDoCliente(c, clienteId, hoje, config)
    : null;
  let itemPremio: ItemDoPremio | null = null;
  if (querPremio) {
    const motivo = motivoParaUsarPremio({ config, saldo, clienteId });
    if (motivo) throw invalido(motivo);
    // motivoParaUsarPremio já recusou o prêmio sem serviço configurado.
    const premioServicoId = config.selos.premioServicoId;
    const s =
      premioServicoId == null
        ? undefined
        : await c.db
            .selectFrom('servicos')
            .select(['id', 'nome'])
            .where('id', '=', premioServicoId)
            .where('excluidoEm', 'is', null)
            .executeTakeFirst();
    if (!s) throw invalido('O serviço do prêmio não está mais no catálogo.');
    itemPremio = {
      tipo: 'servico',
      refId: s.id,
      nome: s.nome,
      preco: 0,
      quantidade: 1,
      premio: true,
    };
  }
  const comanda = {
    clienteId,
    itens: itemPremio ? [...itens, itemPremio] : itens,
    desconto,
  };
  const motivo = motivoParaUsarCashback({ valor: cashback, saldo, comanda });
  if (motivo) throw invalido(motivo);
  return { itemPremio };
}

/** O que a fidelidade lê da comanda ao receber. */
export type ComandaParaFidelidade = Comanda & {
  id: number;
  clienteId: number | null;
  premioFidelidade: boolean;
  cashbackUsado: number;
};

/**
 * Ao receber a comanda (já travada, dentro da transação): trava o cliente para
 * serializar gastos simultâneos, confere de novo o saldo, grava os gastos e os
 * créditos. Devolve os créditos para a tela ("+1 selo", "+R$ 3,50").
 */
export async function fidelidadeAoReceber(
  c: Conexao,
  barbeariaId: number,
  cm: ComandaParaFidelidade,
  { ativo, hoje }: FidelidadeNoPedido,
): Promise<CreditoDaComanda[]> {
  if (!ativo || !cm.clienteId) {
    if (cm.premioFidelidade || cm.cashbackUsado)
      throw invalido(
        'O resgate da fidelidade precisa de cliente e do módulo ativo.',
      );
    return [];
  }
  const clienteId = cm.clienteId;
  await c.db
    .selectFrom('clientes')
    .select('id')
    .where('id', '=', clienteId)
    .forUpdate()
    .execute();
  const config = await obterConfig(c);
  const saldo = await saldoDoCliente(c, clienteId, hoje, config);
  const gastos: { tipo: string; valor: number }[] = [];
  if (cm.premioFidelidade) {
    const motivo = motivoParaUsarPremio({ config, saldo, clienteId });
    if (motivo) throw conflito(`Não deu para usar o prêmio: ${motivo}`);
    gastos.push({ tipo: 'resgate_selos', valor: config.selos.necessarios });
  }
  if (cm.cashbackUsado) {
    const motivo = motivoParaUsarCashback({
      valor: cm.cashbackUsado,
      saldo,
      comanda: cm,
    });
    if (motivo) throw conflito(`Não deu para usar o cashback: ${motivo}`);
    gastos.push({ tipo: 'uso_cashback', valor: cm.cashbackUsado });
  }
  const { movimentos: creditos } = creditosDaComanda(
    { ...cm, estado: 'paga' },
    config,
    hoje,
  );
  for (const m of [
    ...gastos.map((g) => ({ ...g, data: hoje, expiraEm: null })),
    ...creditos,
  ])
    await c.db
      .insertInto('fidelidadeMovimentos')
      .values({
        barbeariaId,
        clienteId,
        tipo: m.tipo,
        valor: m.valor,
        data: hoje,
        expiraEm: m.expiraEm ?? null,
        comandaId: cm.id,
      })
      .execute();
  return creditos.map(({ tipo, valor }) => ({ tipo, valor }));
}
