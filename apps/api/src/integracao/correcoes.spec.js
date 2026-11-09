import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { momentoNoFuso, paraHora, paraMinutos } from '@barbertime/dominio';
import {
  comoSuperusuario,
  criarServidor,
  navegador,
  novaBarbearia,
  unico,
} from './apoio.js';

// Planejamento 0026: correções da revisão do PR #3 e achados N3 a N11 do 0025.

let servidor;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor?.close());

const agora = () => momentoNoFuso();
const daqui = (min) =>
  paraHora(Math.min(23 * 60 + 30, paraMinutos(agora().hora) + min));

/** Barbearia com caixa aberto, um corte, um produto e dois barbeiros o dia todo. */
async function balcao() {
  const b = await novaBarbearia(servidor);
  const corte = (
    await b.dono.post('/api/servicos', {
      nome: 'Corte',
      duracao: 30,
      preco: 45,
    })
  ).corpo;
  const pomada = (
    await b.dono.post('/api/produtos', {
      nome: 'Pomada',
      preco: 30,
      comissao: 10,
    })
  ).corpo;
  const barbeiro = (nome) =>
    b.dono
      .post('/api/barbeiros', {
        nome,
        inicio: '00:00',
        fim: '23:59',
        comissao: 40,
      })
      .then((r) => r.corpo);
  const joao = await barbeiro('João');
  const leo = await barbeiro('Léo');
  await b.dono.post('/api/caixa/abrir', { valorInicial: 50 });
  return { ...b, corte, pomada, joao, leo };
}

/** Agendamento confirmado de hoje para o João. */
async function agendado(b, inicio = daqui(60), barbeiroId = b.joao.id) {
  const ag = (
    await b.dono.post('/api/agendamentos', {
      data: agora().data,
      inicio,
      barbeiroId,
      servicoId: b.corte.id,
      cliente: {
        nome: 'Ana Lima',
        telefone: `119${String(Date.now()).slice(-8)}`,
      },
    })
  ).corpo;
  await b.dono.put(`/api/agendamentos/${ag.id}/estado`, {
    estado: 'confirmado',
  });
  return ag;
}

/** Convida um usuário com o papel e devolve o navegador logado e o id. */
async function convidar(dono, chave) {
  const papel = (await dono.get('/api/papeis')).corpo.find(
    (p) => p.chave === chave,
  );
  const email = `${unico(chave)}@teste.dev`;
  await dono.post('/api/usuarios', {
    nome: `Pessoa ${chave}`,
    email,
    senha: 'senha-segura',
    papelId: papel.id,
  });
  const n = navegador(servidor);
  await n.post('/api/auth/entrar', { email, senha: 'senha-segura' });
  const contas = (await dono.get('/api/barbeiros/contas')).corpo;
  return { n, email, usuarioId: contas.find((u) => u.email === email).id };
}

describe('agenda e ciclo do atendimento', () => {
  it('cancelar da agenda depois do check-in cancela a comanda aberta', async () => {
    const b = await balcao();
    const ag = await agendado(b);
    const ci = (await b.dono.post(`/api/atendimentos/${ag.id}/checkin`)).corpo;
    expect(ci.comandaEstado).toBe('aberta');
    await b.dono.put(`/api/agendamentos/${ag.id}/estado`, {
      estado: 'cancelado',
    });
    const cm = (await b.dono.get(`/api/comandas/${ci.comandaId}`)).corpo;
    expect(cm.estado).toBe('cancelada');
    // O caixa fecha: não sobrou comanda presa.
    expect(
      (await b.dono.post('/api/caixa/fechar', { dinheiroContado: 50 })).status,
    ).toBe(200);
  });

  it('"atendido" não pula o check-in; depois de chegar, pode', async () => {
    const b = await balcao();
    const ag = await agendado(b);
    const marcar = () =>
      b.dono.put(`/api/agendamentos/${ag.id}/estado`, { estado: 'atendido' });
    expect((await marcar()).status).toBe(400);
    await b.dono.post(`/api/atendimentos/${ag.id}/checkin`);
    expect((await marcar()).corpo.status).toBe('finalizado');
  });

  it('estado com nome de propriedade do objeto dá 400, não 500', async () => {
    const b = await balcao();
    const ag = await agendado(b);
    for (const estado of ['constructor', 'toString', '__proto__', 'valueOf']) {
      const r = await b.dono.put(`/api/agendamentos/${ag.id}/estado`, {
        estado,
      });
      expect(r.status).toBe(400);
    }
  });

  it('N3: data e hora fora do formato dão 400', async () => {
    const b = await balcao();
    for (const data of ['abc', '2026-13-45', '2026-02-31'])
      expect((await b.dono.get(`/api/agendamentos?data=${data}`)).status).toBe(
        400,
      );
    const base = {
      data: agora().data,
      barbeiroId: b.joao.id,
      servicoId: b.corte.id,
      cliente: { nome: 'Bia', telefone: '11933332222' },
    };
    for (const inicio of ['0a:00', '9:00', '24:00', '10:7'])
      expect(
        (await b.dono.post('/api/agendamentos', { ...base, inicio })).status,
      ).toBe(400);
    expect(
      (
        await b.dono.post('/api/agendamentos', {
          ...base,
          data: '2026-02-31',
          inicio: '10:00',
        })
      ).status,
    ).toBe(400);
  });

  it('N6: comanda paga de agendamento confirmado deixa o atendimento pago', async () => {
    const b = await balcao();
    const ag = await agendado(b);
    const cm = (await b.dono.post(`/api/comandas/do-atendimento/${ag.id}`))
      .corpo;
    await b.dono.post(`/api/comandas/${cm.id}/receber`, { forma: 'pix' });
    const a = (await b.dono.get(`/api/agendamentos/${ag.id}`)).corpo;
    expect(a.status).toBe('pago');
    expect(
      (
        await b.dono.put(`/api/agendamentos/${ag.id}/estado`, {
          estado: 'faltou',
        })
      ).status,
    ).toBe(400);
  });

  it('N7: receber e cancelar ao mesmo tempo não deixam estados contraditórios', async () => {
    const b = await balcao();
    const ag = await agendado(b);
    const ci = (await b.dono.post(`/api/atendimentos/${ag.id}/checkin`)).corpo;
    await Promise.all([
      b.dono.post(`/api/comandas/${ci.comandaId}/receber`, { forma: 'pix' }),
      b.dono.post(`/api/atendimentos/${ag.id}/desistir`),
    ]);
    const cm = (await b.dono.get(`/api/comandas/${ci.comandaId}`)).corpo;
    const a = (await b.dono.get(`/api/agendamentos/${ag.id}`)).corpo;
    const coerente =
      (cm.estado === 'paga' && a.status === 'pago') ||
      (cm.estado === 'cancelada' && a.status === 'desistiu');
    expect(coerente).toBe(true);
  });

  it('N8: iniciar o agendamento com outro barbeiro confere a agenda dele', async () => {
    const b = await balcao();
    const ag = await agendado(b, daqui(30));
    await agendado(b, daqui(45), b.leo.id); // Léo ocupado no meio do horário
    await b.dono.post(`/api/atendimentos/${ag.id}/checkin`);
    const r = await b.dono.post(`/api/atendimentos/${ag.id}/iniciar`, {
      barbeiroId: b.leo.id,
    });
    expect(r.status).toBe(409);
    expect(r.corpo.mensagem).toContain('Léo tem o agendamento');
    expect(
      (
        await b.dono.post(`/api/atendimentos/${ag.id}/iniciar`, {
          barbeiroId: b.joao.id,
        })
      ).status,
    ).toBe(200);
  });
});

describe('caixa e comandas', () => {
  it('preço e nome vêm do catálogo; desconto inválido e item excluído dão 400', async () => {
    const b = await balcao();
    const cm = (
      await b.dono.post('/api/comandas', {
        barbeiroId: b.joao.id,
        itens: [
          { tipo: 'servico', refId: b.corte.id, preco: '-80', nome: 'Grátis' },
          { tipo: 'produto', refId: b.pomada.id, preco: '0' },
        ],
      })
    ).corpo;
    expect(cm.itens.map((i) => [i.nome, i.preco])).toEqual([
      ['Corte', 45],
      ['Pomada', 30],
    ]);
    expect(cm.total).toBe(75);
    const desconto = await b.dono.post('/api/comandas', {
      barbeiroId: b.joao.id,
      itens: [{ tipo: 'servico', refId: b.corte.id }],
      desconto: 'abc',
    });
    expect(desconto.status).toBe(400);
    await b.dono.delete(`/api/produtos/${b.pomada.id}`);
    const excluido = await b.dono.post('/api/comandas', {
      barbeiroId: b.joao.id,
      itens: [{ tipo: 'produto', refId: b.pomada.id }],
    });
    expect(excluido.status).toBe(400);
  });

  it('atendimento e barbeiro do item de outra barbearia são recusados (N11)', async () => {
    const a = await balcao();
    const outra = await balcao();
    const agOutra = await agendado(outra);
    const r = await a.dono.post('/api/comandas', {
      barbeiroId: a.joao.id,
      atendimentoId: agOutra.id,
      itens: [{ tipo: 'servico', refId: a.corte.id }],
    });
    expect(r.status).toBe(400);
    // O check-in da outra barbearia segue funcionando.
    expect(
      (await outra.dono.post(`/api/atendimentos/${agOutra.id}/checkin`)).status,
    ).toBe(200);
    const item = await a.dono.post('/api/comandas', {
      barbeiroId: a.joao.id,
      itens: [{ tipo: 'servico', refId: a.corte.id, barbeiroId: outra.leo.id }],
    });
    expect(item.status).toBe(400);
  });

  it('N5: comanda esquecida num caixa de outro dia é recebida no caixa de hoje', async () => {
    const b = await balcao();
    const cm = (
      await b.dono.post('/api/comandas', {
        barbeiroId: b.joao.id,
        itens: [{ tipo: 'servico', refId: b.corte.id }],
      })
    ).corpo;
    // O caixa vira o de ontem (esquecido aberto) e o de hoje é aberto.
    await comoSuperusuario((c) =>
      c.query('update caixas set data = data - 1 where id = $1', [cm.caixaId]),
    );
    const hoje = (await b.dono.post('/api/caixa/abrir', { valorInicial: 0 }))
      .corpo;
    const pago = (
      await b.dono.post(`/api/comandas/${cm.id}/receber`, { forma: 'dinheiro' })
    ).corpo;
    expect(pago).toMatchObject({ estado: 'paga', caixaId: hoje.id });
    const caixa = (await b.dono.get('/api/caixa')).corpo;
    expect(caixa.resumo.dinheiroEsperado).toBe(45);
  });

  it('balcão conta vendas só dos últimos 90 dias', async () => {
    const b = await balcao();
    const cm = (
      await b.dono.post('/api/comandas', {
        barbeiroId: b.joao.id,
        itens: [{ tipo: 'servico', refId: b.corte.id }],
      })
    ).corpo;
    await b.dono.post(`/api/comandas/${cm.id}/receber`, { forma: 'pix' });
    const vendas = async () =>
      (await b.dono.get('/api/balcao')).corpo.servicos.find(
        (s) => s.id === b.corte.id,
      ).vendas;
    expect(await vendas()).toBe(1);
    await comoSuperusuario((c) =>
      c.query('update caixas set data = data - 120 where id = $1', [
        cm.caixaId,
      ]),
    );
    expect(await vendas()).toBe(0);
  });
});

describe('clientes, equipe e permissões', () => {
  it('N4: excluir cliente anonimiza e mantém o histórico', async () => {
    const b = await balcao();
    const ag = await agendado(b);
    const ci = (await b.dono.post(`/api/atendimentos/${ag.id}/checkin`)).corpo;
    await b.dono.post(`/api/comandas/${ci.comandaId}/receber`, {
      forma: 'pix',
    });
    expect((await b.dono.delete(`/api/clientes/${ag.clienteId}`)).status).toBe(
      204,
    );
    expect((await b.dono.get(`/api/clientes/${ag.clienteId}`)).status).toBe(
      404,
    );
    expect((await b.dono.get('/api/clientes?busca=Ana')).corpo).toEqual([]);
    const a = (await b.dono.get(`/api/agendamentos/${ag.id}`)).corpo;
    expect(a).toMatchObject({
      status: 'pago',
      clienteNome: 'Cliente removido',
    });
    expect(a.clienteTelefone).toBeNull();
    const cm = (await b.dono.get(`/api/comandas/${ci.comandaId}`)).corpo;
    expect(cm).toMatchObject({
      estado: 'paga',
      clienteNome: 'Cliente removido',
    });
  });

  it('N9: o barbeiro pode ser ligado a uma conta desta barbearia', async () => {
    const b = await balcao();
    const outra = await balcao();
    const { n, usuarioId } = await convidar(b.dono, 'barbeiro');
    const ligar = (dono, id, uid) =>
      dono.put(`/api/barbeiros/${id}`, {
        nome: 'Léo',
        inicio: '00:00',
        fim: '23:59',
        comissao: 40,
        usuarioId: uid,
      });
    expect((await ligar(outra.dono, outra.leo.id, usuarioId)).status).toBe(400);
    expect((await ligar(b.dono, b.leo.id, usuarioId)).corpo.usuarioId).toBe(
      usuarioId,
    );
    expect((await ligar(b.dono, b.joao.id, usuarioId)).status).toBe(409);
    // Ligado, o barbeiro vê a própria agenda.
    const ag = await agendado(b, daqui(60), b.leo.id);
    const agenda = (await n.get(`/api/agendamentos?data=${agora().data}`))
      .corpo;
    expect(agenda.map((x) => x.id)).toEqual([ag.id]);
  });

  // Planejamento 0035: o Barbeiro vê a agenda de todos (agenda.ver), mas não
  // remove o bloqueio que outra pessoa criou.
  it('N10: barbeiro lê o bloqueio de colega, mas não remove', async () => {
    const b = await balcao();
    const { n, usuarioId } = await convidar(b.dono, 'barbeiro');
    await b.dono.put(`/api/barbeiros/${b.leo.id}`, {
      nome: 'Léo',
      inicio: '00:00',
      fim: '23:59',
      comissao: 40,
      usuarioId,
    });
    const k = (
      await b.dono.post('/api/agendamentos/bloqueios', {
        data: agora().data,
        inicio: '23:00',
        fim: '23:30',
        barbeiroId: b.joao.id,
        motivo: 'Consulta médica',
      })
    ).corpo;
    expect(k.id).toBeLessThan(0);
    expect((await n.get(`/api/agendamentos/${k.id}`)).status).toBe(200);
    expect(
      (await n.put(`/api/agendamentos/${k.id}/estado`, { estado: 'cancelado' }))
        .status,
    ).toBe(403);
  });
});

describe('página pública', () => {
  /** Próxima segunda-feira (aberta no horário padrão). */
  function proximaSegunda() {
    const d = new Date(`${agora().data}T12:00:00Z`);
    do d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() !== 1);
    return d.toISOString().slice(0, 10);
  }

  it('não revela o nome do cadastro e só aceita horários da grade', async () => {
    const b = await novaBarbearia(servidor);
    const servico = (
      await b.dono.post('/api/servicos', {
        nome: 'Corte',
        duracao: 30,
        preco: 45,
      })
    ).corpo;
    const barbeiro = (
      await b.dono.post('/api/barbeiros', {
        nome: 'Marcos',
        inicio: '09:00',
        fim: '19:00',
        comissao: 40,
      })
    ).corpo;
    const cfg = (await b.dono.get('/api/barbearia')).corpo;
    cfg.configuracoes.paginaPublica.modo = 'publica';
    await b.dono.put('/api/barbearia', cfg);
    await b.dono.post('/api/clientes', {
      nome: 'Rafael Souza',
      telefone: '11987654321',
    });

    const p = navegador(servidor);
    const agendar = (inicio, nome) =>
      p.post(`/api/publico/${b.slug}/agendamentos`, {
        data: proximaSegunda(),
        inicio,
        barbeiroId: barbeiro.id,
        servicoId: servico.id,
        cliente: { nome, telefone: '11987654321' },
      });
    const fora = await agendar('09:10', '');
    expect(fora.status).toBe(400);
    const r = await agendar('09:00', '');
    expect(r.status).toBe(201);
    expect(r.corpo.primeiroNome).toBeNull(); // não devolve "Rafael"
    expect((await agendar('10:00', 'Rafa Teste')).corpo.primeiroNome).toBe(
      'Rafa',
    );
  });
});

describe('sessão', () => {
  const expiracao = (email) =>
    comoSuperusuario(async (c) =>
      (
        await c.query(
          `select s.expira_em from sessoes s join usuarios u on u.id = s.usuario_id
            where u.email = $1`,
          [email],
        )
      ).rows[0].expira_em.getTime(),
    );
  const definir = (email, intervalo) =>
    comoSuperusuario((c) =>
      c.query(
        `update sessoes set expira_em = now() + $2::interval
          where usuario_id = (select id from usuarios where email = $1)`,
        [email, intervalo],
      ),
    );

  it('renova só depois da metade do prazo', async () => {
    const b = await novaBarbearia(servidor);
    await definir(b.email, '20 days');
    const antes = await expiracao(b.email);
    expect((await b.dono.get('/api/auth/eu')).status).toBe(200);
    expect(await expiracao(b.email)).toBe(antes); // sem escrita
    await definir(b.email, '2 days');
    expect((await b.dono.get('/api/auth/eu')).status).toBe(200);
    expect(await expiracao(b.email)).toBeGreaterThan(
      Date.now() + 25 * 86_400_000,
    );
  });
});
