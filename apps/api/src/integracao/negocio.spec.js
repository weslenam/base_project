import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { momentoNoFuso } from '@barbertime/dominio';
import { criarServidor, navegador, novaBarbearia, unico } from './apoio.js';

// Planejamento 0019 (parte 1): cadastros, clientes, agenda e página pública.

let servidor;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor?.close());

/** Próxima segunda-feira (aberta no horário padrão), no fuso da barbearia. */
function proximaSegunda() {
  const hoje = momentoNoFuso().data;
  const d = new Date(`${hoje}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 1);
  return d.toISOString().slice(0, 10);
}

/** Barbearia com um serviço e um barbeiro, pronta para agendar. */
async function montada(nome) {
  const b = await novaBarbearia(servidor, nome);
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
  // Página pública começa desativada (padrão); aqui ela é aberta.
  const cfg = (await b.dono.get('/api/barbearia')).corpo;
  cfg.configuracoes.paginaPublica.modo = 'publica';
  await b.dono.put('/api/barbearia', cfg);
  return { ...b, servico, barbeiro };
}

describe('cadastros', () => {
  it('serviços, produtos e equipe: cria, lista, recusa nome repetido', async () => {
    const { dono, servico, barbeiro } = await montada();
    expect(servico).toMatchObject({ nome: 'Corte', duracao: 30, preco: 45 });
    expect(barbeiro).toMatchObject({
      nome: 'Marcos',
      inicio: '09:00',
      comissao: 40,
    });
    const rep = await dono.post('/api/servicos', {
      nome: 'corte',
      duracao: 20,
      preco: 30,
    });
    expect(rep.status).toBe(409);
    expect(rep.corpo.mensagem).toBe('Já existe um serviço chamado "Corte".');
    const p = await dono.post('/api/produtos', { nome: 'Pomada', preco: 39.9 });
    expect(p.corpo).toMatchObject({ preco: 39.9, comissao: 0 });
    expect((await dono.get('/api/produtos')).corpo).toHaveLength(1);
  });

  it('isolamento: outra barbearia não vê nem altera os serviços (RLS)', async () => {
    const a = await montada();
    const b = await novaBarbearia(servidor);
    expect((await b.dono.get('/api/servicos')).corpo).toEqual([]);
    const r = await b.dono.put(`/api/servicos/${a.servico.id}`, {
      nome: 'Invadido',
      duracao: 10,
      preco: 1,
    });
    expect(r.status).toBe(404);
  });

  it('serviço com agendamento futuro não sai; sem, sai e some da lista', async () => {
    const { dono, servico, barbeiro } = await montada();
    const cliente = (
      await dono.post('/api/clientes', { nome: 'Ana', telefone: '11911112222' })
    ).corpo;
    await dono.post('/api/agendamentos', {
      data: proximaSegunda(),
      inicio: '10:00',
      barbeiroId: barbeiro.id,
      servicoId: servico.id,
      clienteId: cliente.id,
    });
    const r = await dono.delete(`/api/servicos/${servico.id}`);
    expect(r.status).toBe(409);
    expect(r.corpo.mensagem).toContain('há 1 agendamento futuro');
    const barba = (
      await dono.post('/api/servicos', {
        nome: 'Barba',
        duracao: 20,
        preco: 30,
      })
    ).corpo;
    expect((await dono.delete(`/api/servicos/${barba.id}`)).status).toBe(204);
    expect((await dono.get('/api/servicos')).corpo.map((s) => s.nome)).toEqual([
      'Corte',
    ]);
  });
});

describe('clientes e agenda', () => {
  it('telefone repetido cita o dono do número; busca por nome e telefone', async () => {
    const { dono } = await montada();
    await dono.post('/api/clientes', {
      nome: 'Rafael Souza',
      telefone: '11987654321',
    });
    const r = await dono.post('/api/clientes', {
      nome: 'Outro',
      telefone: '(11) 98765-4321',
    });
    expect(r.status).toBe(409);
    expect(r.corpo.mensagem).toBe(
      'O telefone (11) 98765-4321 já está no cadastro de Rafael Souza.',
    );
    expect((await dono.get('/api/clientes?busca=rafa')).corpo).toHaveLength(1);
    expect((await dono.get('/api/clientes?busca=4321')).corpo[0].nome).toBe(
      'Rafael Souza',
    );
  });

  it('agenda: cria, recusa conflito e fora do expediente, muda estado', async () => {
    const { dono, servico, barbeiro } = await montada();
    const dia = proximaSegunda();
    const base = { data: dia, barbeiroId: barbeiro.id, servicoId: servico.id };
    const novo = await dono.post('/api/agendamentos', {
      ...base,
      inicio: '10:00',
      cliente: { nome: 'Bruno Lima', telefone: '11976543210' },
    });
    expect(novo.status).toBe(201);
    expect(novo.corpo).toMatchObject({
      fim: '10:30',
      estado: 'pendente',
      clienteNome: 'Bruno Lima',
    });

    const conflito = await dono.post('/api/agendamentos', {
      ...base,
      inicio: '10:15',
      clienteId: novo.corpo.clienteId,
    });
    expect(conflito.status).toBe(409);
    const fora = await dono.post('/api/agendamentos', {
      ...base,
      inicio: '18:45',
      clienteId: novo.corpo.clienteId,
    });
    expect(fora.corpo.mensagem).toContain('Marcos atende das 09:00 às 19:00');

    const livres = (
      await dono.get(
        `/api/agendamentos/horarios?data=${dia}&barbeiroId=${barbeiro.id}&servicoId=${servico.id}`,
      )
    ).corpo;
    expect(livres.find((h) => h.hora === '10:00').disponivel).toBe(false);
    expect(livres.find((h) => h.hora === '10:30').disponivel).toBe(true);

    const id = novo.corpo.id;
    expect(
      (await dono.put(`/api/agendamentos/${id}/estado`, { estado: 'atendido' }))
        .status,
    ).toBe(400);
    expect(
      (
        await dono.put(`/api/agendamentos/${id}/estado`, {
          estado: 'confirmado',
        })
      ).corpo.estado,
    ).toBe('confirmado');
    expect(
      (await dono.get(`/api/agendamentos?data=${dia}`)).corpo,
    ).toHaveLength(1);
  });

  it('recepção agenda; barbeiro não (403)', async () => {
    const { dono } = await montada();
    const convidar = async (chave) => {
      const papel = (await dono.get('/api/papeis')).corpo.find(
        (p) => p.chave === chave,
      );
      const email = `${unico(chave)}@teste.dev`;
      await dono.post('/api/usuarios', {
        nome: chave,
        email,
        senha: 'senha-segura',
        papelId: papel.id,
      });
      const n = navegador(servidor);
      await n.post('/api/auth/entrar', { email, senha: 'senha-segura' });
      return n;
    };
    const barbeiro = await convidar('barbeiro');
    // Agendar ele pode (planejamento 0035, agendaBarbeiro.spec.js).
    expect(
      (
        await barbeiro.post('/api/servicos', {
          nome: 'X',
          duracao: 10,
          preco: 1,
        })
      ).status,
    ).toBe(403);
    expect(
      (await barbeiro.get(`/api/agendamentos?data=${proximaSegunda()}`)).status,
    ).toBe(200);
  });
});

describe('página pública', () => {
  const publico = navegador; // sem login

  it('modo pública: carrega, mostra horários, reconhece e agenda', async () => {
    const { slug, servico, barbeiro, dono } = await montada('Studio Teste');
    const p = publico(servidor);
    const pagina = await p.get(`/api/publico/${slug}`);
    expect(pagina.status).toBe(200);
    expect(pagina.corpo.barbearia.nome).toBe('Studio Teste');
    expect(pagina.corpo.servicos.map((s) => s.nome)).toEqual(['Corte']);
    expect(pagina.corpo.barbeiros[0]).not.toHaveProperty('comissao');

    const dia = proximaSegunda();
    const q = `data=${dia}&barbeiroId=${barbeiro.id}&servicoId=${servico.id}`;
    expect(
      (await p.get(`/api/publico/${slug}/horarios?${q}`)).corpo[0].hora,
    ).toBe('09:00');

    await dono.post('/api/clientes', {
      nome: 'Rafael Souza',
      telefone: '11987654321',
    });
    expect(
      (await p.get(`/api/publico/${slug}/cliente?telefone=11987654321`)).corpo,
    ).toEqual({ primeiroNome: 'Rafael' });
    expect(
      (await p.get(`/api/publico/${slug}/cliente?telefone=11900000000`)).corpo,
    ).toBeNull();

    const r = await p.post(`/api/publico/${slug}/agendamentos`, {
      data: dia,
      inicio: '09:00',
      barbeiroId: barbeiro.id,
      servicoId: servico.id,
      cliente: { nome: 'Carlos Novo', telefone: '11955554444' },
    });
    expect(r.status).toBe(201);
    expect(r.corpo).toEqual({
      id: expect.any(Number),
      data: dia,
      inicio: '09:00',
      fim: '09:30',
      servicoNome: 'Corte',
      barbeiroNome: 'Marcos',
      primeiroNome: 'Carlos',
    });
    const agenda = (await dono.get(`/api/agendamentos?data=${dia}`)).corpo;
    expect(agenda[0]).toMatchObject({
      canal: 'publico',
      clienteNome: 'Carlos Novo',
    });
  });

  it('domingo (fechado) não tem horários e não aceita agendamento online', async () => {
    const { slug, servico, barbeiro } = await montada();
    const seg = proximaSegunda();
    const d = new Date(`${seg}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 6);
    const domingo = d.toISOString().slice(0, 10);
    const p = publico(servidor);
    expect(
      (
        await p.get(
          `/api/publico/${slug}/horarios?data=${domingo}&barbeiroId=${barbeiro.id}&servicoId=${servico.id}`,
        )
      ).corpo,
    ).toEqual([]);
    const r = await p.post(`/api/publico/${slug}/agendamentos`, {
      data: domingo,
      inicio: '10:00',
      barbeiroId: barbeiro.id,
      servicoId: servico.id,
      cliente: { nome: 'X', telefone: '11955554444' },
    });
    expect(r.status).toBe(400);
  });

  it('só com o link: exige o código; trocar o código invalida o antigo; desativada some', async () => {
    const { dono, slug } = await montada();
    const cfg = (await dono.get('/api/barbearia')).corpo;
    cfg.configuracoes.paginaPublica.modo = 'com_link';
    await dono.put('/api/barbearia', cfg);
    const p = publico(servidor);
    expect((await p.get(`/api/publico/${slug}`)).status).toBe(404);
    expect((await p.get(`/api/publico/${slug}?c=errado`)).status).toBe(404);
    expect(
      (await p.get(`/api/publico/${slug}?c=${cfg.tokenPublico}`)).status,
    ).toBe(200);

    const novo = (await dono.post('/api/barbearia/token')).corpo.tokenPublico;
    expect(novo).not.toBe(cfg.tokenPublico);
    expect(
      (await p.get(`/api/publico/${slug}?c=${cfg.tokenPublico}`)).status,
    ).toBe(404);
    expect((await p.get(`/api/publico/${slug}?c=${novo}`)).status).toBe(200);

    cfg.configuracoes.paginaPublica.modo = 'desativada';
    await dono.put('/api/barbearia', cfg);
    const r = await p.get(`/api/publico/${slug}?c=${novo}`);
    expect(r.status).toBe(404);
    expect(r.corpo.mensagem).toBe(
      (await p.get('/api/publico/nao-existe')).corpo.mensagem,
    );
  });
});

describe('trava geral da página pública', () => {
  it('bloqueada no sistema: nenhuma página abre, nem no modo pública', async () => {
    const travado = await criarServidor({ paginaPublicaLiberada: false });
    try {
      const b = await novaBarbearia(travado);
      const cfg = (await b.dono.get('/api/barbearia')).corpo;
      expect(cfg.paginaPublicaLiberada).toBe(false);
      cfg.configuracoes.paginaPublica.modo = 'publica';
      await b.dono.put('/api/barbearia', cfg);
      expect(
        (await navegador(travado).get(`/api/publico/${b.slug}`)).status,
      ).toBe(404);
    } finally {
      await travado.close();
    }
  });
});
