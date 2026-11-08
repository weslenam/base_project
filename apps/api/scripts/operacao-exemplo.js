// Operação de exemplo para simular (planejamentos 0019 e 0020): catálogo, equipe,
// clientes, histórico pago das últimas semanas, agenda de hoje e caixa aberto.
// SÓ PARA DESENVOLVIMENTO. Roda uma vez por barbearia (se ela não tiver serviços).
import {
  fimDe,
  momentoNoFuso,
  paraHora,
  paraMinutos,
} from '@barbertime/dominio';

const PERFIS = {
  'studio-negoboy': {
    servicos: [
      ['Corte degradê', 40, 45],
      ['Corte social', 30, 40],
      ['Barba', 20, 30],
      ['Corte + barba', 50, 70],
      ['Sobrancelha', 10, 15],
      ['Pigmentação', 40, 60],
      ['Platinado', 90, 150],
    ],
    produtos: [
      ['Pomada modeladora', 39.9, 10],
      ['Óleo para barba', 34.9, 10],
      ['Shampoo anticaspa', 29.9, 10],
      ['Minoxidil 5%', 89.9, 8],
    ],
    // [nome, início, fim, comissão, ligar à conta do dono?]
    equipe: [
      ['NegoBoy', '09:00', '20:00', 50, true],
      ['Kaique', '10:00', '21:00', 45, false],
      ['Biel', '09:00', '18:00', 40, false],
    ],
    clientes: [
      'Matheus Oliveira',
      'Lucas Ferreira',
      'Gabriel Santos',
      'Pedro Henrique',
      'Vinícius Almeida',
      'Rafael Moreira',
      'Thiago Ribeiro',
      'Bruno Carvalho',
      'Felipe Araújo',
      'Gustavo Lima',
      'Diego Martins',
      'Caio Rocha',
      'João Pedro Silva',
      'André Nascimento',
    ],
  },
};

const somarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const FORMAS = ['pix', 'dinheiro', 'credito', 'debito', 'pix'];

export const temPerfil = (slug) => Boolean(PERFIS[slug]);

/** Cria a operação de exemplo dentro de uma transação com RLS (c). */
export async function semearOperacao(c, { barbeariaId, slug, donoUsuarioId }) {
  const perfil = PERFIS[slug];
  const ja = await c.query('select 1 from servicos limit 1');
  if (!perfil || ja.rowCount) return false;
  const { data: hoje, hora } = momentoNoFuso();

  const servicos = [];
  for (const [nome, duracao, preco] of perfil.servicos) {
    const { rows } = await c.query(
      'insert into servicos (barbearia_id, nome, duracao, preco) values ($1, $2, $3, $4) returning id, nome, duracao, preco',
      [barbeariaId, nome, duracao, preco],
    );
    servicos.push(rows[0]);
  }
  const produtos = [];
  for (const [nome, preco, comissao] of perfil.produtos) {
    const { rows } = await c.query(
      'insert into produtos (barbearia_id, nome, preco, comissao) values ($1, $2, $3, $4) returning id, nome, preco',
      [barbeariaId, nome, preco, comissao],
    );
    produtos.push(rows[0]);
  }
  const equipe = [];
  for (const [nome, inicio, fim, comissao, doDono] of perfil.equipe) {
    const { rows } = await c.query(
      `insert into barbeiros (barbearia_id, nome, inicio, fim, comissao, usuario_id)
       values ($1, $2, $3, $4, $5, $6) returning id, nome, inicio, fim`,
      [barbeariaId, nome, inicio, fim, comissao, doDono ? donoUsuarioId : null],
    );
    equipe.push(rows[0]);
  }
  const clientes = [];
  for (const [i, nome] of perfil.clientes.entries()) {
    const telefone = `119${String(81234500 + i * 1137).padStart(8, '0')}`;
    const { rows } = await c.query(
      'insert into clientes (barbearia_id, nome, telefone) values ($1, $2, $3) returning id, nome',
      [barbeariaId, nome, telefone],
    );
    clientes.push(rows[0]);
  }

  /** Atendimento + comanda (paga ou aberta) num caixa. */
  async function atendimento({
    data,
    inicio,
    barbeiro,
    servico,
    cliente,
    estado,
    caixaId,
    forma,
    produto,
  }) {
    const fim = fimDe(inicio, servico.duracao);
    const { rows } = await c.query(
      `insert into atendimentos (barbearia_id, origem, canal, data, inicio, fim, duracao, barbeiro_id,
         servico_id, cliente_id, estado, confirmado_em, chegou_em, iniciado_em, finalizado_em)
       values ($1, 'agendamento', 'balcao', $2, $3, $4, $5, $6, $7, $8, $9,
         case when $9 <> 'agendado' then now() end,
         case when $9 in ('pago', 'finalizado') then now() end,
         case when $9 in ('pago', 'finalizado') then now() end,
         case when $9 in ('pago', 'finalizado') then now() end)
       returning id`,
      [
        barbeariaId,
        data,
        inicio,
        fim,
        servico.duracao,
        barbeiro.id,
        servico.id,
        cliente.id,
        estado,
      ],
    );
    if (!caixaId) return;
    const itens = [
      {
        tipo: 'servico',
        refId: servico.id,
        nome: servico.nome,
        preco: servico.preco,
        quantidade: 1,
        barbeiroId: barbeiro.id,
      },
      ...(produto
        ? [
            {
              tipo: 'produto',
              refId: produto.id,
              nome: produto.nome,
              preco: produto.preco,
              quantidade: 1,
              barbeiroId: barbeiro.id,
            },
          ]
        : []),
    ];
    await c.query(
      `insert into comandas (barbearia_id, caixa_id, atendimento_id, cliente_id, barbeiro_id, hora, itens, forma, estado, paga_as)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'paga', $9)`,
      [
        barbeariaId,
        caixaId,
        rows[0].id,
        cliente.id,
        barbeiro.id,
        inicio,
        JSON.stringify(itens),
        forma,
        fim,
      ],
    );
  }

  // Histórico: 3 semanas, 6 atendimentos pagos por dia útil, caixa fechado.
  let n = 0;
  for (let dia = -21; dia < 0; dia++) {
    const data = somarDias(hoje, dia);
    if (new Date(`${data}T12:00:00Z`).getUTCDay() === 0) continue;
    const { rows } = await c.query(
      `insert into caixas (barbearia_id, data, valor_inicial, aberto, aberto_as, fechado_as, dinheiro_contado, diferenca)
       values ($1, $2, 100, false, '09:00', '20:30', 0, 0) returning id`,
      [barbeariaId, data],
    );
    for (let k = 0; k < 6; k++, n++) {
      await atendimento({
        data,
        inicio: paraHora(10 * 60 + k * 75),
        barbeiro: equipe[n % equipe.length],
        servico: servicos[(n * 3) % 4],
        cliente: clientes[(n * 5) % clientes.length],
        estado: 'pago',
        caixaId: rows[0].id,
        forma: FORMAS[n % FORMAS.length],
        produto: n % 4 === 0 ? produtos[n % produtos.length] : null,
      });
    }
  }

  // Hoje: caixa aberto e agendamentos a partir de daqui a 30 min, um por barbeiro a cada hora.
  await c.query(
    'insert into caixas (barbearia_id, data, valor_inicial, aberto_as) values ($1, $2, 100, $3) on conflict do nothing',
    [barbeariaId, hoje, hora],
  );
  const comeco = Math.ceil((paraMinutos(hora) + 30) / 30) * 30;
  let i = 0;
  for (let m = comeco; m <= 19 * 60; m += 60) {
    for (const [j, barbeiro] of equipe.entries()) {
      if ((i + j) % 3 === 2) continue; // deixa buracos para encaixe
      const servico = servicos[(i + j) % servicos.length];
      const inicio = paraHora(m + j * 10);
      if (
        paraMinutos(inicio) < paraMinutos(barbeiro.inicio) ||
        paraMinutos(fimDe(inicio, servico.duracao)) > paraMinutos(barbeiro.fim)
      )
        continue;
      await atendimento({
        data: hoje,
        inicio,
        barbeiro,
        servico,
        cliente: clientes[(i * 3 + j) % clientes.length],
        estado: 'agendado',
      });
    }
    i++;
  }
  // Amanhã: alguns horários já marcados.
  for (const [j, barbeiro] of equipe.entries()) {
    await atendimento({
      data: somarDias(hoje, 1),
      inicio: paraHora(
        Math.max(paraMinutos(barbeiro.inicio), 10 * 60) + j * 30,
      ),
      barbeiro,
      servico: servicos[j],
      cliente: clientes[(j + 7) % clientes.length],
      estado: 'agendado',
    });
  }
  return true;
}
