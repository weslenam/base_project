// Movimento de exemplo para o Business Center (planejamento 0028). SÓ DESENVOLVIMENTO.
// Cria uns 60 dias de operação na barbearia modelo:
//  - caixas fechados;
//  - comandas pagas de serviços e produtos;
//  - agendamentos com faltas e cancelamentos;
//  - clientes novos ao longo do tempo;
//  - o caixa de hoje aberto.
// Na negoboy, uma venda há 10 dias e nada depois (vira "Parada" depois dos 14 dias de "Nova").
// Só roda onde ainda não há caixa: rodar de novo não duplica nada.
import { somarDias } from '@barbertime/dominio';

const DIAS = 60;
const FORMAS = ['pix', 'pix', 'credito', 'debito', 'dinheiro'];
const NOMES = [
  'Lucas',
  'Pedro',
  'Gabriel',
  'Mateus',
  'Rafael',
  'Felipe',
  'Gustavo',
  'Caio',
  'Vinícius',
  'André',
  'Henrique',
  'Samuel',
  'Igor',
  'Daniel',
  'Murilo',
];
const SOBRENOMES = [
  'Silva',
  'Santos',
  'Oliveira',
  'Pereira',
  'Costa',
  'Rocha',
  'Almeida',
  'Ribeiro',
  'Carvalho',
  'Gomes',
];

/** Gerador determinístico (mulberry32): a semente produz sempre os mesmos dados. */
function aleatorio(semente) {
  let a = semente;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hhmm = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export async function semearMovimento(c, { barbeariaId, hoje }) {
  const ja = await c.query('select 1 from caixas limit 1');
  if (ja.rowCount) return false;

  const r = aleatorio(barbeariaId * 7919);
  const escolher = (lista) => lista[Math.floor(r() * lista.length)];
  const { rows: servicos } = await c.query(
    'select id, nome, preco, duracao from servicos where excluido_em is null order by id',
  );
  const { rows: produtos } = await c.query(
    "select id, nome, preco from produtos where excluido_em is null and tipo = 'revenda' order by id",
  );
  const { rows: barbeiros } = await c.query(
    'select id from barbeiros where excluido_em is null order by id',
  );
  if (!servicos.length || !barbeiros.length) return false;

  // Clientes novos espalhados nos 60 dias (nomes e telefones fictícios).
  const inicio = somarDias(hoje, -DIAS);
  for (let i = 0; i < 30; i++) {
    const dia = somarDias(inicio, Math.floor(r() * DIAS));
    await c.query(
      `insert into clientes (barbearia_id, nome, telefone, criado_em)
       values ($1, $2, $3, $4::date + time '10:00')`,
      [
        barbeariaId,
        `${escolher(NOMES)} ${escolher(SOBRENOMES)}`,
        `1190000${String(1000 + i).slice(-4)}`,
        dia,
      ],
    );
  }
  const { rows: clientes } = await c.query(
    'select id, criado_em from clientes order by id',
  );

  for (let d = DIAS; d >= 0; d--) {
    const data = somarDias(hoje, -d);
    const deHoje = d === 0;
    // Fecha domingo; o caixa de hoje abre sempre, para o painel ter "caixa atual".
    if (!deHoje && new Date(`${data}T12:00:00`).getDay() === 0) continue;
    const {
      rows: [caixa],
    } = await c.query(
      `insert into caixas (barbearia_id, data, valor_inicial, aberto, aberto_as, fechado_as)
       values ($1, $2, 100, $3, '09:00', $4) returning id`,
      [barbeariaId, data, deHoje, deHoje ? null : '19:00'],
    );
    // Movimento cresce um pouco ao longo do período (o mês atual vence o anterior).
    const vendas = deHoje ? 4 : 4 + Math.floor(r() * 6 + (DIAS - d) / 12);
    let minuto = 9 * 60;
    for (let v = 0; v < vendas; v++) {
      minuto += 30 + Math.floor(r() * 30);
      const servico = escolher(servicos);
      const barbeiroId = escolher(barbeiros).id;
      const elegiveis = clientes.filter(
        (x) => new Date(x.criado_em) <= new Date(`${data}T23:59:59`),
      );
      const clienteId =
        elegiveis.length && r() < 0.8 ? escolher(elegiveis).id : null;
      const itens = [
        {
          tipo: 'servico',
          refId: servico.id,
          nome: servico.nome,
          preco: Number(servico.preco),
          quantidade: 1,
          barbeiroId,
        },
      ];
      if (produtos.length && r() < 0.25) {
        const p = escolher(produtos);
        itens.push({
          tipo: 'produto',
          refId: p.id,
          nome: p.nome,
          preco: Number(p.preco),
          quantidade: r() < 0.2 ? 2 : 1,
          barbeiroId,
        });
      }
      const agendado = r() < 0.6;
      let atendimentoId = null;
      if (agendado) {
        const {
          rows: [a],
        } = await c.query(
          `insert into atendimentos (barbearia_id, data, inicio, fim, barbeiro_id, servico_id, cliente_id, estado, origem)
           values ($1, $2, $3, $4, $5, $6, $7, 'pago', 'agendamento') returning id`,
          [
            barbeariaId,
            data,
            hhmm(minuto),
            hhmm(minuto + servico.duracao),
            barbeiroId,
            servico.id,
            clienteId,
          ],
        );
        atendimentoId = a.id;
      }
      const aberta = deHoje && v === vendas - 1;
      await c.query(
        `insert into comandas (barbearia_id, caixa_id, atendimento_id, cliente_id, barbeiro_id, hora, itens, desconto, forma, estado, paga_as)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          barbeariaId,
          caixa.id,
          atendimentoId,
          clienteId,
          barbeiroId,
          hhmm(minuto),
          JSON.stringify(itens),
          r() < 0.1 ? 5 : 0,
          aberta ? null : escolher(FORMAS),
          aberta ? 'aberta' : 'paga',
          aberta ? null : hhmm(minuto + servico.duracao),
        ],
      );
    }
    // Agendamentos que não viraram venda: faltas e cancelamentos.
    for (const estado of ['no_show', 'cancelado']) {
      if (r() < 0.35) {
        const servico = escolher(servicos);
        await c.query(
          `insert into atendimentos (barbearia_id, data, inicio, fim, barbeiro_id, servico_id, cliente_id, estado, origem)
           values ($1, $2, '18:00', $3, $4, $5, $6, $7, 'agendamento')`,
          [
            barbeariaId,
            data,
            hhmm(18 * 60 + servico.duracao),
            escolher(barbeiros).id,
            servico.id,
            escolher(clientes).id,
            estado,
          ],
        );
      }
    }
  }
  // Um pedido de módulo pendente, para testar a confirmação no Business Center.
  await c.query(
    `insert into barbearia_modulos (barbearia_id, modulo, estado) values ($1, 'estoque', 'solicitado')
     on conflict (barbearia_id, modulo) do nothing`,
    [barbeariaId],
  );
  return true;
}

/** Uma venda há 10 dias e nada depois: "Parada" assim que deixar de ser "Nova". */
export async function semearVendaAntiga(c, { barbeariaId, hoje }) {
  const ja = await c.query('select 1 from caixas limit 1');
  if (ja.rowCount) return false;
  const data = somarDias(hoje, -10);
  const {
    rows: [caixa],
  } = await c.query(
    `insert into caixas (barbearia_id, data, valor_inicial, aberto, aberto_as, fechado_as)
     values ($1, $2, 0, false, '10:00', '18:00') returning id`,
    [barbeariaId, data],
  );
  await c.query(
    `insert into comandas (barbearia_id, caixa_id, hora, itens, forma, estado, paga_as)
     values ($1, $2, '11:00', $3, 'pix', 'paga', '11:40')`,
    [
      barbeariaId,
      caixa.id,
      JSON.stringify([
        {
          tipo: 'servico',
          refId: null,
          nome: 'Corte',
          preco: 50,
          quantidade: 1,
        },
      ]),
    ],
  );
  return true;
}
