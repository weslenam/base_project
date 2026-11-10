import { momentoNoFuso, somarMeses } from '@barbertime/dominio';
import { codigoDoPasso, passoAtual } from '../seguranca/totp.ts';
import { criarOperador } from '../servicos/operadores.ts';
import {
  comoAplicacao,
  comoSuperusuario,
  criarServidor,
  navegador,
  novaBarbearia,
  unico,
} from './apoio.ts';
import type { ServidorDeTeste } from './apoio.ts';
import type { PapelDaBarbearia } from '@barbertime/contratos';
import type { ModuloDaBarbearia } from '@barbertime/contratos';
import type {
  BarbeariaNaLista,
  RegistroDeAuditoria,
  UsuarioDoPainel,
} from '@barbertime/contratos';

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE';
type OperadorDeTeste = { email: string; segredo: string };

// Business Center (planejamento 0028, ADR 0018): operadores com TOTP, painel por
// barbearia sem dado pessoal de cliente, ações auditadas e barbearia suspensa.

let servidor: ServidorDeTeste;
beforeAll(async () => {
  servidor = await criarServidor();
});
afterAll(() => servidor.close());

const SENHA = 'senha-de-operador-forte';

async function novoOperador() {
  const email = `${unico('op')}@barbertime.dev`;
  const op = await comoAplicacao((c) =>
    criarOperador(c, { nome: 'Operadora', email, senha: SENHA }),
  );
  return { ...op, email };
}

/** "Navegador" do operador: guarda o cookie bt_operador. */
function painelDoOperador() {
  let cookie = '';
  const pedir = async (
    method: Metodo,
    url: string,
    payload?: unknown,
    extra: Record<string, string> = {},
  ) => {
    const r = await servidor.inject({
      method,
      url,
      payload: payload as never,
      headers: { ...(cookie ? { cookie } : {}), ...extra },
    });
    const novo = r.cookies.find((c) => c.name === 'bt_operador');
    if (novo) cookie = novo.value ? `bt_operador=${novo.value}` : '';
    return { status: r.statusCode, corpo: r.body ? r.json() : null, r };
  };
  return {
    get: (url: string) => pedir('GET', url),
    post: (url: string, corpo?: unknown) => pedir('POST', url, corpo),
    pedir,
    cookie: () => cookie,
  };
}

async function entrarComo(op: OperadorDeTeste, deslocamento = 0) {
  const n = painelDoOperador();
  const r = await n.post('/api/plataforma/auth/entrar', {
    email: op.email,
    senha: SENHA,
    codigo: codigoDoPasso(op.segredo, passoAtual() + deslocamento),
  });
  return { n, r };
}

describe('entrar no Business Center', () => {
  it('exige senha e código TOTP; o mesmo código não vale duas vezes', async () => {
    const op = await novoOperador();
    const semCodigo = await painelDoOperador().post(
      '/api/plataforma/auth/entrar',
      {
        email: op.email,
        senha: SENHA,
      },
    );
    expect(semCodigo.status).toBe(401);
    const senhaErrada = await painelDoOperador().post(
      '/api/plataforma/auth/entrar',
      {
        email: op.email,
        senha: 'outra-senha-qualquer',
        codigo: codigoDoPasso(op.segredo, passoAtual()),
      },
    );
    expect(senhaErrada.status).toBe(401);
    expect(senhaErrada.corpo.mensagem).toBe(semCodigo.corpo.mensagem);

    const { n, r } = await entrarComo(op);
    expect(r.status).toBe(200);
    expect(r.corpo.operador.email).toBe(op.email);
    const cookie = r.r.cookies.find((c) => c.name === 'bt_operador');
    expect(cookie).toMatchObject({
      httpOnly: true,
      path: '/api/plataforma',
      sameSite: 'Strict',
    });
    expect((await n.get('/api/plataforma/auth/eu')).status).toBe(200);

    // Reuso do mesmo código (replay): recusado.
    const { r: denovo } = await entrarComo(op);
    expect(denovo.status).toBe(401);

    await n.post('/api/plataforma/auth/sair');
    expect((await n.get('/api/plataforma/auth/eu')).status).toBe(401);
  });

  it('identidades separadas: usuário de barbearia não entra na plataforma e operador não abre a barbearia', async () => {
    const b = await novaBarbearia(servidor);
    expect((await b.dono.get('/api/plataforma/barbearias')).status).toBe(401);
    // Login de usuário com as credenciais dele no endpoint de operador: recusado.
    const tentativa = await painelDoOperador().post(
      '/api/plataforma/auth/entrar',
      {
        email: b.email,
        senha: 'senha-segura',
        codigo: '000000',
      },
    );
    expect(tentativa.status).toBe(401);

    const op = await novoOperador();
    const { n } = await entrarComo(op);
    const naBarbearia = await n.pedir('GET', '/api/auth/eu');
    expect(naBarbearia.status).toBe(401);
    expect((await n.get('/api/clientes')).status).toBe(401);
  });

  it('operador desativado perde a sessão', async () => {
    const op = await novoOperador();
    const { n } = await entrarComo(op);
    await comoSuperusuario((c) =>
      c.query('update operadores set ativo = false where id = $1', [op.id]),
    );
    expect((await n.get('/api/plataforma/barbearias')).status).toBe(401);
  });
});

describe('painel da barbearia', () => {
  async function barbeariaComMovimento() {
    const b = await novaBarbearia(servidor, 'Barbearia Painel');
    const corte = (
      await b.dono.post('/api/servicos', {
        nome: 'Corte',
        preco: 50,
        duracao: 30,
      })
    ).corpo;
    const barba = (
      await b.dono.post('/api/servicos', {
        nome: 'Barba',
        preco: 30,
        duracao: 20,
      })
    ).corpo;
    const pomada = (
      await b.dono.post('/api/produtos', { nome: 'Pomada', preco: 40 })
    ).corpo;
    const joao = (
      await b.dono.post('/api/barbeiros', {
        nome: 'João',
        inicio: '00:00',
        fim: '23:59',
        comissao: 40,
      })
    ).corpo;
    const cliente = (
      await b.dono.post('/api/clientes', {
        nome: 'Cliente Secreto',
        telefone: '11999990000',
      })
    ).corpo;
    await b.dono.post('/api/caixa/abrir', { valorInicial: 100 });
    const pagar = async (itens: unknown[], clienteId: number | null = null) => {
      const cm = (
        await b.dono.post('/api/comandas', {
          barbeiroId: joao.id,
          clienteId,
          itens,
        })
      ).corpo;
      const r = await b.dono.post(`/api/comandas/${cm.id}/receber`, {
        forma: 'dinheiro',
      });
      expect(r.status).toBe(200);
    };
    // Mês atual: 3 comandas pagas = 50 + (50 + 30) + (30 + 2×40) = 240.
    await pagar([{ tipo: 'servico', refId: corte.id }], cliente.id);
    await pagar([
      { tipo: 'servico', refId: corte.id },
      { tipo: 'servico', refId: barba.id },
    ]);
    await pagar([
      { tipo: 'servico', refId: barba.id },
      { tipo: 'produto', refId: pomada.id, quantidade: 2 },
    ]);
    // Uma aberta, que não conta no faturamento.
    await b.dono.post('/api/comandas', {
      barbeiroId: joao.id,
      itens: [{ tipo: 'servico', refId: corte.id }],
    });
    // Mês anterior: 1 comanda de 120, direto no banco.
    const id = b.sessao.barbearia.id;
    const hoje = momentoNoFuso(new Date()).data;
    const mesPassado = somarMeses(`${hoje.slice(0, 7)}-01`, -1);
    await comoSuperusuario(async (c) => {
      const {
        rows: [cx],
      } = await c.query(
        `insert into caixas (barbearia_id, data, aberto, aberto_as, fechado_as)
         values ($1, $2, false, '09:00', '18:00') returning id`,
        [id, mesPassado],
      );
      await c.query(
        `insert into comandas (barbearia_id, caixa_id, hora, itens, forma, estado, paga_as)
         values ($1, $2, '10:00', $3, 'pix', 'paga', '10:30')`,
        [
          id,
          cx.id,
          JSON.stringify([
            {
              tipo: 'servico',
              refId: corte.id,
              nome: 'Corte',
              preco: 120,
              quantidade: 1,
            },
          ]),
        ],
      );
      // Agendamentos: uma falta hoje conta; um marcado para o dia 1º do mês
      // seguinte não entra no mês atual.
      const marcar = (data: string, estado: string) =>
        c.query(
          `insert into atendimentos (barbearia_id, data, inicio, fim, barbeiro_id, servico_id, estado, origem)
           values ($1, $2, '08:00', '08:30', $3, $4, $5, 'agendamento')`,
          [id, data, joao.id, corte.id, estado],
        );
      await marcar(hoje, 'no_show');
      await marcar(somarMeses(`${hoje.slice(0, 7)}-01`, 1), 'agendado');
    });
    return { ...b, id };
  }

  it('mostra os números do mês sem nenhum dado pessoal de cliente, e audita a abertura', async () => {
    const b = await barbeariaComMovimento();
    const op = await novoOperador();
    const { n } = await entrarComo(op);

    const lista = (await n.get('/api/plataforma/barbearias')).corpo;
    const naLista = lista.find((x: BarbeariaNaLista) => x.id === b.id);
    expect(naLista).toMatchObject({
      faturamentoMes: 240,
      selo: 'ativa',
      donoEmail: b.email,
      modulosPendentes: 0,
    });

    const r = await n.get(`/api/plataforma/barbearias/${b.id}`);
    expect(r.status).toBe(200);
    const p = r.corpo;
    expect(p.barbearia.selo).toBe('ativa');
    expect(p.faturamento).toEqual({ atual: 240, anterior: 120, variacao: 100 });
    expect(p.atendimentos).toEqual({ atual: 3, anterior: 1, variacao: 200 });
    expect(p.ticketMedio).toEqual({
      atual: 80,
      anterior: 120,
      variacao: -33.3,
    });
    expect(p.clientes).toMatchObject({ total: 1, novos: 1, atendidos: 1 });
    expect(p.agendamentos).toEqual({ marcados: 1, noShow: 1, cancelados: 0 });
    expect(p.topServicos).toEqual([
      { nome: 'Corte', quantidade: 2, valor: 100 },
      { nome: 'Barba', quantidade: 2, valor: 60 },
    ]);
    expect(p.topProdutos).toEqual([
      { nome: 'Pomada', quantidade: 2, valor: 80 },
    ]);
    expect(p.caixa).toMatchObject({
      valorInicial: 100,
      totalRecebido: 240,
      dinheiroEsperado: 340,
      pagas: 3,
      abertas: 1,
    });
    expect(p.porDia).toHaveLength(1);
    expect(p.porDia[0].valor).toBe(240);
    expect(p.modulos.length).toBeGreaterThan(5);

    // LGPD: nada do cliente final aparece em nenhuma resposta da plataforma.
    const tudo = JSON.stringify(lista) + r.r.body;
    expect(tudo).not.toContain('Cliente Secreto');
    expect(tudo).not.toContain('11999990000');

    // A abertura fica auditada, mas não ocupa o histórico mostrado no painel.
    const {
      rows: [vistas],
    } = await comoSuperusuario((c) =>
      c.query(
        "select count(*)::int as n from auditoria_plataforma where barbearia_id = $1 and acao = 'ver_painel'",
        [b.id],
      ),
    );
    expect(vistas.n).toBe(1);
    expect(p.auditoria.map((a: RegistroDeAuditoria) => a.acao)).not.toContain(
      'ver_painel',
    );
  });

  // Planejamento 0037: o cashback abate como desconto também no painel.
  it('cashback usado sai do faturamento e do dinheiro esperado', async () => {
    const b = await barbeariaComMovimento();
    await comoSuperusuario((c) =>
      c.query(
        `update comandas set cashback_usado = 10
          where id = (select min(cm.id) from comandas cm
                        join caixas cx on cx.id = cm.caixa_id
                       where cm.barbearia_id = $1 and cm.estado = 'paga' and cx.aberto)`,
        [b.id],
      ),
    );
    const op = await novoOperador();
    const { n } = await entrarComo(op);
    const lista = (await n.get('/api/plataforma/barbearias')).corpo;
    expect(
      lista.find((x: BarbeariaNaLista) => x.id === b.id).faturamentoMes,
    ).toBe(230);
    const p = (await n.get(`/api/plataforma/barbearias/${b.id}`)).corpo;
    expect(p.faturamento.atual).toBe(230);
    expect(p.caixa).toMatchObject({
      totalRecebido: 230,
      dinheiroEsperado: 330,
    });
  });

  it('#26: a gaveta no painel desconta as saídas do financeiro', async () => {
    const b = await barbeariaComMovimento();
    await comoSuperusuario((c) =>
      c.query(
        `insert into movimentos_caixa (barbearia_id, caixa_id, tipo, valor, descricao)
         select $1, id, 'saida', 40, 'Conta de luz' from caixas
          where barbearia_id = $1 and aberto`,
        [b.id],
      ),
    );
    const op = await novoOperador();
    const { n } = await entrarComo(op);
    const p = (await n.get(`/api/plataforma/barbearias/${b.id}`)).corpo;
    expect(p.caixa.dinheiroEsperado).toBe(300);
  });

  it('barbearia inexistente: 404', async () => {
    const op = await novoOperador();
    const { n } = await entrarComo(op);
    expect((await n.get('/api/plataforma/barbearias/999999')).status).toBe(404);
  });
});

describe('ações do operador', () => {
  it('confirma um pedido de módulo, com motivo obrigatório e auditoria', async () => {
    const b = await novaBarbearia(servidor);
    const id = b.sessao.barbearia.id;
    await b.dono.post('/api/modulos/estoque/solicitar');
    const op = await novoOperador();
    const { n } = await entrarComo(op);
    const lista = (await n.get('/api/plataforma/barbearias')).corpo;
    expect(
      lista.find((x: BarbeariaNaLista) => x.id === id).modulosPendentes,
    ).toBe(1);

    const semMotivo = await n.post(
      `/api/plataforma/barbearias/${id}/modulos/estoque/confirmar_contratacao`,
      {},
    );
    expect(semMotivo.status).toBe(400);
    const r = await n.post(
      `/api/plataforma/barbearias/${id}/modulos/estoque/confirmar_contratacao`,
      { motivo: 'Contrato assinado por e-mail' },
    );
    expect(r.corpo).toEqual({
      chave: 'estoque',
      de: 'solicitado',
      para: 'ativo',
    });
    const mods = (await b.dono.get('/api/modulos')).corpo;
    expect(
      mods.find((m: ModuloDaBarbearia) => m.chave === 'estoque').estado,
    ).toBe('ativo');

    const invalida = await n.post(
      `/api/plataforma/barbearias/${id}/modulos/estoque/solicitar`,
      { motivo: 'x x x' },
    );
    expect(invalida.status).toBe(400);

    const painel = (await n.get(`/api/plataforma/barbearias/${id}`)).corpo;
    expect(painel.auditoria.map((a: RegistroDeAuditoria) => a.acao)).toContain(
      'modulo_confirmar_contratacao',
    );
  });

  it('suspender bloqueia login, sessões e página pública; reativar libera', async () => {
    const b = await novaBarbearia(servidor);
    const id = b.sessao.barbearia.id;
    await b.dono.post('/api/modulos/agendamento_online/ativar');
    await b.dono.put('/api/barbearia', {
      nome: 'Barbearia Teste',
      slug: b.slug,
      configuracoes: { paginaPublica: { modo: 'publica' } },
    });
    expect(
      (await navegador(servidor).get(`/api/publico/${b.slug}`)).status,
    ).toBe(200);

    const op = await novoOperador();
    const { n } = await entrarComo(op);
    const s = await n.post(`/api/plataforma/barbearias/${id}/suspender`, {
      motivo: 'Uso indevido',
    });
    expect(s.status).toBe(200);
    expect(s.corpo.suspensaEm).toBeTruthy();

    // A sessão aberta do Dono caiu.
    expect((await b.dono.get('/api/auth/eu')).status).toBe(401);
    // Entrar de novo: recusado com a mensagem de suspensão.
    const entrar = await navegador(servidor).post('/api/auth/entrar', {
      email: b.email,
      senha: 'senha-segura',
    });
    expect(entrar.status).toBe(403);
    expect(entrar.corpo.mensagem).toMatch(/suspensa/);
    expect(
      (await navegador(servidor).get(`/api/publico/${b.slug}`)).status,
    ).toBe(404);
    // O operador ainda vê o painel.
    expect((await n.get(`/api/plataforma/barbearias/${id}`)).status).toBe(200);

    const r = await n.post(`/api/plataforma/barbearias/${id}/reativar`, {
      motivo: 'Regularizado',
    });
    expect(r.corpo.suspensaEm).toBeNull();
    const deNovo = navegador(servidor);
    expect(
      (
        await deNovo.post('/api/auth/entrar', {
          email: b.email,
          senha: 'senha-segura',
        })
      ).status,
    ).toBe(200);
    expect(
      (await navegador(servidor).get(`/api/publico/${b.slug}`)).status,
    ).toBe(200);
  });

  it('transfere o Dono para um usuário ativo; o antigo vira Gerente', async () => {
    const b = await novaBarbearia(servidor);
    const id = b.sessao.barbearia.id;
    const papeis = (await b.dono.get('/api/papeis')).corpo;
    const email = `${unico('ger')}@teste.dev`;
    const convite = await b.dono.post('/api/usuarios', {
      nome: 'Novo Dono',
      email,
      senha: 'senha-segura',
      papelId: papeis.find((p: PapelDaBarbearia) => p.chave === 'recepcao').id,
    });
    expect(convite.status).toBe(201);

    const op = await novoOperador();
    const { n } = await entrarComo(op);
    const antes = (await n.get(`/api/plataforma/barbearias/${id}`)).corpo;
    const alvo = antes.usuarios.find((u: UsuarioDoPainel) => u.email === email);
    const dono = antes.usuarios.find(
      (u: UsuarioDoPainel) => u.papelChave === 'dono',
    );

    expect(
      (
        await n.post(`/api/plataforma/barbearias/${id}/dono`, {
          usuarioId: alvo.id,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await n.post(`/api/plataforma/barbearias/${id}/dono`, {
          usuarioId: 999999,
          motivo: 'Venda da barbearia',
        })
      ).status,
    ).toBe(400);
    const r = await n.post(`/api/plataforma/barbearias/${id}/dono`, {
      usuarioId: alvo.id,
      motivo: 'Venda da barbearia',
    });
    expect(r.status).toBe(200);

    const depois = (await n.get(`/api/plataforma/barbearias/${id}`)).corpo;
    const donos = depois.usuarios.filter(
      (u: UsuarioDoPainel) => u.papelChave === 'dono',
    );
    expect(donos.map((u: UsuarioDoPainel) => u.id)).toEqual([alvo.id]);
    expect(
      depois.usuarios.find((u: UsuarioDoPainel) => u.id === dono.id).papelChave,
    ).toBe('gerente');
    expect(depois.auditoria.map((a: RegistroDeAuditoria) => a.acao)).toContain(
      'transferir_dono',
    );
  });

  it('a auditoria não pode ser alterada nem apagada pela aplicação', async () => {
    await expect(
      comoAplicacao((c) => c.query('delete from auditoria_plataforma')),
    ).rejects.toThrow(/permission denied/);
    await expect(
      comoAplicacao((c) =>
        c.query("update auditoria_plataforma set motivo = 'x'"),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
