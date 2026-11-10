import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarServidor, navegador, novaBarbearia, unico } from './apoio.ts';
import type { ServidorDeTeste } from './apoio.ts';
import type { PapelDaBarbearia } from '@barbertime/contratos';

type Navegador = ReturnType<typeof navegador>;

// Planejamento 0017: configurações da barbearia, perfil e troca de senha.
// Planejamento 0023: a senha provisória definida pelo Dono saiu.

let servidor: ServidorDeTeste;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor?.close());

async function convidar(
  dono: Navegador,
  chave: string,
  email = `${unico(chave)}@teste.dev`,
) {
  const papel = (await dono.get('/api/papeis')).corpo.find(
    (p: PapelDaBarbearia) => p.chave === chave,
  );
  const r = await dono.post('/api/usuarios', {
    nome: `Usuário ${chave}`,
    email,
    senha: 'senha-segura',
    papelId: papel.id,
  });
  expect(r.status).toBe(201);
  const n = navegador(servidor);
  await n.post('/api/auth/entrar', { email, senha: 'senha-segura' });
  return { navegador: n, usuario: r.corpo, email };
}

describe('configurações da barbearia', () => {
  it('Dono lê os padrões e salva dados, horário e regras', async () => {
    const { dono, slug } = await novaBarbearia(servidor, 'Barbearia Config');
    const lida = await dono.get('/api/barbearia');
    expect(lida.status).toBe(200);
    expect(lida.corpo).toMatchObject({ nome: 'Barbearia Config', slug });
    expect(lida.corpo.configuracoes.funcionamento).toHaveLength(7);

    const configuracoes = lida.corpo.configuracoes;
    configuracoes.contato.telefone = '11987654321';
    configuracoes.funcionamento[0] = {
      dia: 0,
      aberto: true,
      abre: '10:00',
      fecha: '14:00',
    };
    configuracoes.agendamento.diasAFrente = 60;
    const novoSlug = unico('novo');
    const r = await dono.put('/api/barbearia', {
      nome: 'Barbearia Nova',
      slug: novoSlug,
      configuracoes,
    });
    expect(r.status).toBe(200);
    expect((await dono.get('/api/auth/eu')).corpo.barbearia).toMatchObject({
      nome: 'Barbearia Nova',
      slug: novoSlug,
    });
    const relida = (await dono.get('/api/barbearia')).corpo.configuracoes;
    expect(relida.funcionamento[0]).toMatchObject({
      aberto: true,
      abre: '10:00',
    });
    expect(relida.agendamento.diasAFrente).toBe(60);
  });

  it('recusa horário inválido (400) e endereço de outra barbearia (409)', async () => {
    const { dono } = await novaBarbearia(servidor);
    const { slug: deOutra } = await novaBarbearia(servidor);
    const { corpo } = await dono.get('/api/barbearia');
    const ruim = structuredClone(corpo.configuracoes);
    ruim.funcionamento[1] = {
      dia: 1,
      aberto: true,
      abre: '19:00',
      fecha: '09:00',
    };
    const a = await dono.put('/api/barbearia', {
      ...corpo,
      configuracoes: ruim,
    });
    expect(a.status).toBe(400);
    expect(a.corpo.mensagem).toContain('Segunda');
    const b = await dono.put('/api/barbearia', { ...corpo, slug: deOutra });
    expect(b.status).toBe(409);
  });

  it('gerente não configura a barbearia (403)', async () => {
    const { dono } = await novaBarbearia(servidor);
    const { navegador: gerente } = await convidar(dono, 'gerente');
    expect((await gerente.get('/api/barbearia')).status).toBe(403);
  });
});

describe('meu perfil e senha', () => {
  it('troca o nome', async () => {
    const { dono } = await novaBarbearia(servidor);
    const r = await dono.put('/api/auth/perfil', { nome: '  Zé Renomeado ' });
    expect(r.status).toBe(200);
    expect(r.corpo.usuario.nome).toBe('Zé Renomeado');
    expect((await dono.put('/api/auth/perfil', { nome: ' ' })).status).toBe(
      400,
    );
  });

  it('troca a senha com a atual; outras sessões caem e a atual continua', async () => {
    const { dono, email } = await novaBarbearia(servidor);
    const outro = navegador(servidor);
    await outro.post('/api/auth/entrar', { email, senha: 'senha-segura' });
    expect((await outro.get('/api/auth/eu')).status).toBe(200);

    const errada = await dono.put('/api/auth/senha', {
      senhaAtual: 'nao-e-essa',
      novaSenha: 'outra-senha-boa',
    });
    expect(errada.status).toBe(400);
    expect(errada.corpo.mensagem).toBe('A senha atual não confere.');
    const curta = await dono.put('/api/auth/senha', {
      senhaAtual: 'senha-segura',
      novaSenha: '123',
    });
    expect(curta.status).toBe(400);

    const ok = await dono.put('/api/auth/senha', {
      senhaAtual: 'senha-segura',
      novaSenha: 'outra-senha-boa',
    });
    expect(ok.corpo).toEqual({ ok: true, sessoesEncerradas: 1 });
    expect((await dono.get('/api/auth/eu')).status).toBe(200);
    expect((await outro.get('/api/auth/eu')).status).toBe(401);

    const n = navegador(servidor);
    expect(
      (await n.post('/api/auth/entrar', { email, senha: 'senha-segura' }))
        .status,
    ).toBe(401);
    expect(
      (await n.post('/api/auth/entrar', { email, senha: 'outra-senha-boa' }))
        .status,
    ).toBe(200);
  });
});

describe('senha de outra pessoa (planejamento 0023)', () => {
  it('não existe rota para trocar a senha de outra pessoa', async () => {
    const { dono } = await novaBarbearia(servidor);
    const { navegador: rec, usuario } = await convidar(dono, 'recepcao');
    const r = await dono.put(`/api/usuarios/${usuario.id}/senha`, {
      senha: 'provisoria-1',
    });
    expect(r.status).toBe(404);
    // A sessão da pessoa continua, e a senha dela também.
    expect((await rec.get('/api/auth/eu')).status).toBe(200);
  });
});
