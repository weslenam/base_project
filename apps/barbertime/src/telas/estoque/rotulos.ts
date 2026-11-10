// Rótulos e formatos do estoque (planejamento 0027, parte 1).

export const TIPOS = [
  { valor: 'revenda', rotulo: 'Revenda' },
  { valor: 'consumivel', rotulo: 'Consumível' },
];
export const ROTULO_DO_TIPO: Record<string, string> = Object.fromEntries(
  TIPOS.map((t) => [t.valor, t.rotulo]),
);

export const UNIDADES = [
  { valor: 'un', rotulo: 'Unidade (un)' },
  { valor: 'ml', rotulo: 'Mililitro (ml)' },
  { valor: 'g', rotulo: 'Grama (g)' },
  { valor: 'cx', rotulo: 'Caixa (cx)' },
  { valor: 'par', rotulo: 'Par' },
];

export const ROTULO_DO_MOVIMENTO: Record<string, string> = {
  compra: 'Compra',
  venda: 'Venda',
  consumo_servico: 'Consumo no serviço',
  consumo_manual: 'Consumo manual',
  ajuste_inventario: 'Inventário',
  estorno_compra: 'Compra cancelada',
};

const quantidade = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 3,
});

/** 12,5 ml · -1 un */
export const formatarQuantidade = (v: unknown, unidade = 'un') =>
  `${quantidade.format(Number(v ?? 0))} ${unidade}`;

/** '2026-11-08' → '08/11/2026' (data sem hora, sem conversão de fuso). */
export const formatarDataIso = (iso: string | null | undefined) =>
  iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '';
