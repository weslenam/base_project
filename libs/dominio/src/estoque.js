// Estoque e compras (planejamento 0027, parte 1). Regras puras: a API grava os
// movimentos e o saldo; aqui ficam as contas.
import { somarDias } from './agenda.js';

export const TIPOS_DE_PRODUTO = Object.freeze(['revenda', 'consumivel']);
export const UNIDADES = Object.freeze(['un', 'ml', 'g', 'cx', 'par']);

/** Quantidades com até 3 casas (0,5 un; 12,25 ml) e valores em centavos. */
export const arredondarQuantidade = (n) => Math.round(Number(n) * 1000) / 1000;
const centavos = (v) => Math.round(Number(v) * 100);
const reais = (c) => c / 100;

/**
 * Produtos que pedem compra: saldo no mínimo ou abaixo (com mínimo definido)
 * ou negativo. Sugestão: voltar ao dobro do mínimo (ou ao zero, se não houver mínimo).
 */
export function sugestaoDeCompra(produtos = []) {
  return produtos
    .filter(
      (p) =>
        Number(p.saldo) < 0 ||
        (Number(p.estoqueMinimo) > 0 &&
          Number(p.saldo) <= Number(p.estoqueMinimo)),
    )
    .map((p) => ({
      produtoId: p.id,
      nome: p.nome,
      saldo: Number(p.saldo),
      estoqueMinimo: Number(p.estoqueMinimo),
      negativo: Number(p.saldo) < 0,
      sugerido: arredondarQuantidade(
        Math.max(Number(p.estoqueMinimo) * 2 - Number(p.saldo), 0),
      ),
    }))
    .sort(
      (a, b) => Number(b.negativo) - Number(a.negativo) || a.saldo - b.saldo,
    );
}

/**
 * Baixas de uma comanda paga: revenda vendida e consumíveis da ficha técnica de
 * cada serviço. Linha de ficha com produto que não é (mais) consumível ativo é
 * ignorada. Devolve um movimento por produto e tipo, com quantidade negativa.
 *
 * - itens: [{ tipo: 'servico' | 'produto', refId, quantidade }]
 * - fichas: [{ servicoId, produtoId, quantidade }]
 * - produtos: Map/obj por id com { tipo } dos produtos ativos
 */
export function baixasDaComanda({ itens = [], fichas = [], produtos = {} }) {
  const doProduto = (id) =>
    produtos instanceof Map ? produtos.get(id) : produtos[id];
  const total = new Map();
  const somar = (produtoId, tipo, quantidade) => {
    const chave = `${tipo}:${produtoId}`;
    const atual = total.get(chave) ?? { produtoId, tipo, quantidade: 0 };
    atual.quantidade = arredondarQuantidade(atual.quantidade - quantidade);
    total.set(chave, atual);
  };
  for (const item of itens) {
    const qtd = Math.max(1, Number(item.quantidade) || 1);
    if (item.tipo === 'produto') {
      if (doProduto(item.refId)?.tipo === 'revenda')
        somar(item.refId, 'venda', qtd);
    } else if (item.tipo === 'servico') {
      for (const f of fichas.filter((x) => x.servicoId === item.refId)) {
        if (doProduto(f.produtoId)?.tipo === 'consumivel')
          somar(f.produtoId, 'consumo_servico', qtd * Number(f.quantidade));
      }
    }
  }
  return [...total.values()].filter((m) => m.quantidade !== 0);
}

/** Diferença do inventário (contado − saldo); null quando não muda nada. */
export function ajusteDeInventario(saldo, contado) {
  if (!(Number(contado) >= 0)) return null;
  const diferenca = arredondarQuantidade(Number(contado) - Number(saldo));
  return diferenca === 0 ? null : diferenca;
}

/** Total da compra: itens + frete − desconto; motivo quando não fecha. */
export function totalDaCompra({ itens = [], frete = 0, desconto = 0 }) {
  const subtotal = itens.reduce(
    (s, i) => s + Math.round(centavos(i.custoUnitario) * Number(i.quantidade)),
    0,
  );
  const total = subtotal + centavos(frete) - centavos(desconto);
  return {
    subtotal: reais(subtotal),
    total: reais(total),
    motivo: total < 0 ? 'O desconto não pode ser maior que a compra.' : null,
  };
}

/**
 * Divide o total em parcelas sem perder centavos (a diferença vai na última).
 * Vencimentos: o primeiro em `primeiroVencimento` e os seguintes a cada
 * `intervaloDias`.
 */
export function dividirParcelas(
  total,
  quantidade,
  { primeiroVencimento, intervaloDias = 30 },
) {
  const n = Math.max(1, Math.floor(Number(quantidade) || 1));
  const emCentavos = centavos(total);
  const base = Math.floor(emCentavos / n);
  return Array.from({ length: n }, (_, i) => ({
    parcela: i + 1,
    parcelas: n,
    valor: reais(i === n - 1 ? emCentavos - base * (n - 1) : base),
    vencimento: somarDias(primeiroVencimento, i * Number(intervaloDias)),
  }));
}

/** Parcelas informadas à mão precisam somar o total da compra. */
export function motivoParcelasInvalidas(parcelas = [], total) {
  if (!parcelas.length) return 'Informe ao menos uma parcela.';
  if (parcelas.some((p) => !(Number(p.valor) > 0) || !p.vencimento))
    return 'Cada parcela precisa de valor e vencimento.';
  const soma = parcelas.reduce((s, p) => s + centavos(p.valor), 0);
  if (soma !== centavos(total))
    return 'A soma das parcelas precisa ser igual ao total da compra.';
  return null;
}

/**
 * Documento do fornecedor: vazio (opcional), CPF (11 dígitos) ou CNPJ (14),
 * com os dígitos verificadores conferidos. Recebe só dígitos.
 */
export function documentoValido(digitos) {
  const d = String(digitos ?? '');
  if (!d) return true;
  if (!/^\d+$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = (base, pesos) => {
    const soma = [...base].reduce((t, n, i) => t + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  if (d.length === 11) {
    const p = (n) => Array.from({ length: n }, (_, i) => n + 1 - i);
    return (
      dv(d.slice(0, 9), p(9)) === Number(d[9]) &&
      dv(d.slice(0, 10), p(10)) === Number(d[10])
    );
  }
  if (d.length === 14) {
    const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const p2 = [6, ...p1];
    return (
      dv(d.slice(0, 12), p1) === Number(d[12]) &&
      dv(d.slice(0, 13), p2) === Number(d[13])
    );
  }
  return false;
}
