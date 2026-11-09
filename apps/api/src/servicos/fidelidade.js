import {
  FIDELIDADE_PADRAO,
  creditosDaComanda,
  motivoParaUsarCashback,
  motivoParaUsarPremio,
  saldoDeFidelidade,
  validarConfigFidelidade,
} from '@barbertime/dominio';
import { conflito, invalido } from '../infra/erros.js';

// Fidelidade no banco (planejamento 0034, etapa A; regras do 0015). Tudo roda
// no contexto da barbearia (RLS). O extrato só recebe inserções: o saldo é a
// soma, gastando primeiro o crédito que vence antes (domínio).

// Prêmio de serviço excluído do catálogo volta vazio: a tela pede outro
// (planejamento 0037).
const SELECT_CONFIG = `
  select selos_ativo, selos_necessarios, selos_validade_meses,
         case when exists (select 1 from servicos s
                            where s.id = premio_servico_id and s.excluido_em is null)
              then premio_servico_id end as premio_servico_id,
         cashback_ativo, cashback_percentual, cashback_validade_dias
    from fidelidade_config`;

const daLinha = (r) =>
  r
    ? {
        selos: {
          ativo: r.selos_ativo,
          necessarios: r.selos_necessarios,
          premioServicoId: r.premio_servico_id,
          validadeMeses: r.selos_validade_meses,
        },
        cashback: {
          ativo: r.cashback_ativo,
          percentual: r.cashback_percentual,
          validadeDias: r.cashback_validade_dias,
        },
      }
    : structuredClone(FIDELIDADE_PADRAO);

export async function obterConfig(c) {
  const {
    rows: [r],
  } = await c.query(SELECT_CONFIG);
  return daLinha(r);
}

const inteiroOuNulo = (v) =>
  v === null || v === undefined || v === '' ? null : Number(v);

export async function salvarConfig(c, barbeariaId, dados = {}) {
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
    const s = await c.query(
      'select 1 from servicos where id = $1 and excluido_em is null',
      [config.selos.premioServicoId],
    );
    if (!s.rowCount) throw invalido('Serviço de prêmio não encontrado.');
  }
  // Com os selos desligados, os campos deles valem o padrão do banco.
  const selos = config.selos;
  const cashback = config.cashback;
  await c.query(
    `insert into fidelidade_config (barbearia_id, selos_ativo, selos_necessarios,
       premio_servico_id, selos_validade_meses, cashback_ativo, cashback_percentual,
       cashback_validade_dias, atualizado_em)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (barbearia_id) do update set
       selos_ativo = excluded.selos_ativo, selos_necessarios = excluded.selos_necessarios,
       premio_servico_id = excluded.premio_servico_id,
       selos_validade_meses = excluded.selos_validade_meses,
       cashback_ativo = excluded.cashback_ativo,
       cashback_percentual = excluded.cashback_percentual,
       cashback_validade_dias = excluded.cashback_validade_dias,
       atualizado_em = now()`,
    [
      barbeariaId,
      selos.ativo,
      selos.ativo ? selos.necessarios : 10,
      selos.ativo ? selos.premioServicoId : null,
      selos.ativo ? selos.validadeMeses : null,
      cashback.ativo,
      cashback.ativo ? cashback.percentual : 5,
      cashback.ativo ? cashback.validadeDias : 90,
    ],
  );
  return obterConfig(c);
}

/** Extrato do cliente, do mais novo para o mais antigo. */
export async function extratoDoCliente(c, clienteId) {
  const { rows } = await c.query(
    `select tipo, valor, data, expira_em as "expiraEm", comanda_id as "comandaId"
       from fidelidade_movimentos where cliente_id = $1
      order by data desc, id desc`,
    [Number(clienteId)],
  );
  return rows;
}

export async function saldoDoCliente(c, clienteId, hoje, config) {
  const movimentos = await extratoDoCliente(c, clienteId);
  return saldoDeFidelidade(movimentos, config ?? (await obterConfig(c)), hoje);
}

/**
 * Confere o resgate pedido na comanda (prêmio e cashback) ao salvar. Devolve o
 * item do prêmio (serviço a R$ 0, nome do catálogo) ou null.
 */
export async function conferirResgate(
  c,
  { clienteId, premioFidelidade, cashbackUsado, itens, desconto },
  { ativo, hoje },
) {
  const querPremio = Boolean(premioFidelidade);
  const cashback = Number(cashbackUsado || 0);
  if (!querPremio && !cashback) return { itemPremio: null };
  if (!ativo)
    throw invalido('O módulo Fidelidade não está ativo nesta barbearia.');
  const config = await obterConfig(c);
  const saldo = clienteId
    ? await saldoDoCliente(c, clienteId, hoje, config)
    : null;
  let itemPremio = null;
  if (querPremio) {
    const motivo = motivoParaUsarPremio({ config, saldo, clienteId });
    if (motivo) throw invalido(motivo);
    const {
      rows: [s],
    } = await c.query(
      'select id, nome from servicos where id = $1 and excluido_em is null',
      [config.selos.premioServicoId],
    );
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

/**
 * Ao receber a comanda (já travada, dentro da transação): trava o cliente para
 * serializar gastos simultâneos, confere de novo o saldo, grava os gastos e os
 * créditos. Devolve os créditos para a tela ("+1 selo", "+R$ 3,50").
 */
export async function fidelidadeAoReceber(c, barbeariaId, cm, { ativo, hoje }) {
  if (!ativo || !cm.clienteId) {
    if (cm.premioFidelidade || cm.cashbackUsado)
      throw invalido(
        'O resgate da fidelidade precisa de cliente e do módulo ativo.',
      );
    return [];
  }
  await c.query('select 1 from clientes where id = $1 for update', [
    cm.clienteId,
  ]);
  const config = await obterConfig(c);
  const saldo = await saldoDoCliente(c, cm.clienteId, hoje, config);
  const gastos = [];
  if (cm.premioFidelidade) {
    const motivo = motivoParaUsarPremio({
      config,
      saldo,
      clienteId: cm.clienteId,
    });
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
    await c.query(
      `insert into fidelidade_movimentos (barbearia_id, cliente_id, tipo, valor, data, expira_em, comanda_id)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [barbeariaId, cm.clienteId, m.tipo, m.valor, hoje, m.expiraEm, cm.id],
    );
  return creditos.map(({ tipo, valor }) => ({ tipo, valor }));
}
