import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  comoAplicacao,
  comoSuperusuario,
  criarServidor,
  navegador,
  novaBarbearia,
  unico,
} from './apoio.ts';
import type { ServidorDeTeste } from './apoio.ts';
import type { PapelDaBarbearia } from '../app/rotas/papeis.ts';
import type { ModuloDaBarbearia } from '../app/rotas/modulos.ts';

type Navegador = ReturnType<typeof navegador>;

let servidor: ServidorDeTeste;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor?.close());

const papelPorChave = async (dono: Navegador, chave: string) =>
  (await dono.get('/api/papeis')).corpo.find(
    (p: PapelDaBarbearia) => p.chave === chave,
  );

async function convidar(
  dono: Navegador,
  chave: string,
  { email = `${unico(chave)}@teste.dev`, senha = 'senha-segura' } = {},
) {
  const papel = await papelPorChave(dono, chave);
  const r = await dono.post('/api/usuarios', {
    nome: `Usuário ${chave}`,
    email,
    senha,
    papelId: papel.id,
  });
  expect(r.status).toBe(201);
  const n = navegador(servidor);
  expect((await n.post('/api/auth/entrar', { email, senha })).status).toBe(200);
  return { navegador: n, usuario: r.corpo, email };
}

describe('cadastro e login', () => {
  it('cadastro self-service cria a barbearia e já entra como Dono', async () => {
    const { sessao } = await novaBarbearia(servidor, 'Barbearia do Teste');
    expect(sessao.barbearia.nome).toBe('Barbearia do Teste');
    expect(sessao.papel.nome).toBe('Dono');
    expect(sessao.permissoes).toContain('usuarios.gerenciar');
    expect(sessao.modulosAtivos).toEqual(['agendamento_online']);
  });

  it('recusa endereço e e-mail já usados (409)', async () => {
    const { slug, email } = await novaBarbearia(servidor);
    const n = navegador(servidor);
    const dono = {
      nome: 'X',
      email: `${unico('x')}@teste.dev`,
      senha: 'senha-segura',
    };
    expect(
      (await n.post('/api/barbearias', { nome: 'Outra', slug, dono })).status,
    ).toBe(409);
    const r = await n.post('/api/barbearias', {
      nome: 'Outra',
      slug: unico('b'),
      dono: { ...dono, email },
    });
    expect(r.status).toBe(409);
    expect(r.corpo.mensagem).toContain('Já existe uma conta');
  });

  it('senha errada e e-mail inexistente têm a mesma resposta (401)', async () => {
    const { email } = await novaBarbearia(servidor);
    const n = navegador(servidor);
    const a = await n.post('/api/auth/entrar', {
      email,
      senha: 'errada-errada',
    });
    const b = await n.post('/api/auth/entrar', {
      email: 'ninguem@teste.dev',
      senha: 'errada-errada',
    });
    expect([a.status, b.status]).toEqual([401, 401]);
    expect(a.corpo.mensagem).toBe(b.corpo.mensagem);
  });

  it('sem sessão: 401; depois de sair: 401', async () => {
    expect((await navegador(servidor).get('/api/auth/eu')).status).toBe(401);
    const { dono } = await novaBarbearia(servidor);
    expect((await dono.get('/api/auth/eu')).status).toBe(200);
    await dono.post('/api/auth/sair');
    expect((await dono.get('/api/auth/eu')).status).toBe(401);
  });
});

describe('ACL dentro da barbearia', () => {
  it('Recepção não acessa a administração (403)', async () => {
    const { dono } = await novaBarbearia(servidor);
    const { navegador: recepcao } = await convidar(dono, 'recepcao');
    const eu = (await recepcao.get('/api/auth/eu')).corpo;
    expect(eu.papel.nome).toBe('Recepção');
    expect(eu.permissoes).not.toContain('usuarios.gerenciar');
    const r = await recepcao.get('/api/usuarios');
    expect(r.status).toBe(403);
    expect(r.corpo.mensagem).toBe('Você não tem permissão para isso.');
  });

  it('papéis fixos e só leitura: Dono, Gerente, Recepção e Barbeiro (ADR 0010)', async () => {
    const { dono } = await novaBarbearia(servidor);
    const papeis = (await dono.get('/api/papeis')).corpo;
    expect(papeis.map((p: PapelDaBarbearia) => [p.chave, p.nivel])).toEqual([
      ['dono', 1],
      ['gerente', 2],
      ['recepcao', 3],
      ['barbeiro', 4],
    ]);
    expect(
      papeis.find((p: PapelDaBarbearia) => p.chave === 'barbeiro').permissoes,
    ).toEqual([
      'agenda.ver',
      'agenda.ajudar',
      'clientes.ver',
      'clientes.editar',
      'caixa.operar',
    ]);
    // Não se cria, edita nem exclui papel.
    const recepcao = papeis.find(
      (p: PapelDaBarbearia) => p.chave === 'recepcao',
    );
    expect(
      (await dono.post('/api/papeis', { nome: 'Caixa', permissoes: [] }))
        .status,
    ).toBe(404);
    expect(
      (
        await dono.put(`/api/papeis/${recepcao.id}`, {
          nome: 'X',
          permissoes: ['caixa.fechar'],
        })
      ).status,
    ).toBe(404);
    expect((await dono.delete(`/api/papeis/${recepcao.id}`)).status).toBe(404);
  });

  it('nem pelo banco nasce papel fora da hierarquia', async () => {
    const { sessao } = await novaBarbearia(servidor);
    await expect(
      comoSuperusuario((c) =>
        c.query(
          "insert into papeis (barbearia_id, chave, nome) values ($1, 'rh', 'RH')",
          [sessao.barbearia.id],
        ),
      ),
    ).rejects.toThrow(/papeis_hierarquia_fixa/);
  });

  it('ninguém altera o próprio acesso', async () => {
    const { dono, sessao } = await novaBarbearia(servidor);
    const r = await dono.put(`/api/usuarios/${sessao.usuario.id}`, {
      ativo: false,
    });
    expect(r.status).toBe(403);
  });

  it('acesso desativado deixa de valer na hora', async () => {
    const { dono } = await novaBarbearia(servidor);
    const { navegador: recepcao, usuario } = await convidar(dono, 'recepcao');
    await dono.put(`/api/usuarios/${usuario.id}`, { ativo: false });
    expect((await recepcao.get('/api/auth/eu')).status).toBe(403);
  });
});

describe('isolamento entre barbearias (RLS)', () => {
  it('a API só enxerga a própria barbearia', async () => {
    const a = await novaBarbearia(servidor, 'A');
    const b = await novaBarbearia(servidor, 'B');
    const papelDeB = await papelPorChave(b.dono, 'recepcao');
    const papeisVistosPorA = (await a.dono.get('/api/papeis')).corpo.map(
      (p: PapelDaBarbearia) => p.id,
    );
    expect(papeisVistosPorA).not.toContain(papelDeB.id);
    const r = await a.dono.put(`/api/papeis/${papelDeB.id}`, {
      nome: 'Invadido',
      permissoes: [],
    });
    expect(r.status).toBe(404);
  });

  it('mesmo uma consulta sem filtro não vaza: o banco recusa (RLS forçado)', async () => {
    const a = await novaBarbearia(servidor, 'A');
    const b = await novaBarbearia(servidor, 'B');
    await comoAplicacao(async (c) => {
      await c.query('begin');
      await c.query("select set_config('app.barbearia_id', $1, true)", [
        String(a.sessao.barbearia.id),
      ]);
      const { rows } = await c.query(
        'select distinct barbearia_id from papeis',
      );
      expect(rows.map((r) => r.barbearia_id)).toEqual([a.sessao.barbearia.id]);
      await expect(
        c.query(
          "insert into papeis (barbearia_id, nome) values ($1, 'Intruso')",
          [b.sessao.barbearia.id],
        ),
      ).rejects.toThrow(/row-level security/);
      await c.query('rollback');
      // Sem barbearia definida, não se vê nada.
      const { rows: nada } = await c.query('select * from papeis');
      expect(nada).toEqual([]);
    });
  });
});

describe('módulos e serviço adicional', () => {
  it('incluso ativa; adicional precisa ser solicitado e confirmado', async () => {
    const { dono } = await novaBarbearia(servidor);
    const lista = (await dono.get('/api/modulos')).corpo;
    expect(
      lista.find((m: ModuloDaBarbearia) => m.chave === 'pagamentos_online'),
    ).toMatchObject({
      tipo: 'adicional',
      estado: 'inativo',
    });

    expect(
      (await dono.post('/api/modulos/comissoes/ativar')).corpo.estado,
    ).toBe('ativo');
    const direto = await dono.post('/api/modulos/pagamentos_online/ativar');
    expect(direto.status).toBe(400);
    expect(direto.corpo.mensagem).toContain('serviço adicional');
    expect(
      (await dono.post('/api/modulos/pagamentos_online/solicitar')).corpo
        .estado,
    ).toBe('solicitado');
    expect(
      (await dono.post('/api/modulos/pagamentos_online/confirmar_contratacao'))
        .status,
    ).toBe(403);
  });

  it('rotas do gateway só funcionam com o módulo ativo e a permissão', async () => {
    const { dono, sessao } = await novaBarbearia(servidor);
    const cobranca = { valor: 70, descricao: 'Corte + barba' };
    const inativo = await dono.post('/api/pagamentos/cobrancas', cobranca);
    expect(inativo.status).toBe(403);
    expect(inativo.corpo.mensagem).toContain('não está ativo');
    expect((await dono.get('/api/auth/eu')).corpo.permissoes).not.toContain(
      'pagamentos.operar',
    );

    // Equipe BarberTime confirma a contratação (super admin).
    await dono.post('/api/modulos/pagamentos_online/solicitar');
    await comoSuperusuario((c) =>
      c.query(
        "update barbearia_modulos set estado = 'ativo' where barbearia_id = $1 and modulo = 'pagamentos_online'",
        [sessao.barbearia.id],
      ),
    );

    expect((await dono.get('/api/auth/eu')).corpo.permissoes).toContain(
      'pagamentos.operar',
    );
    const criada = await dono.post('/api/pagamentos/cobrancas', cobranca);
    expect(criada.status).toBe(201);
    expect(criada.corpo).toMatchObject({ valor: 70, status: 'pendente' });

    const { navegador: recepcao } = await convidar(dono, 'recepcao');
    expect(
      (await recepcao.post('/api/pagamentos/cobrancas', cobranca)).status,
    ).toBe(403);
  });
});
