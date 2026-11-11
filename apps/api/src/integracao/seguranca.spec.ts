import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { momentoNoFuso } from '@barbertime/dominio';
import { LIMITES_PADRAO } from '../seguranca/limites.ts';
import {
  comoSuperusuario,
  criarServidor,
  navegador,
  novaBarbearia,
  unico,
} from './apoio.ts';
import type { ServidorDeTeste } from './apoio.ts';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import type { Mensagem } from '../infra/correio.ts';
import type { PapelDaBarbearia } from '@barbertime/contratos';

type Navegador = ReturnType<typeof navegador>;
/** Requisição ao servidor com os limites reais, de um IP escolhido. */
type Pedir = (
  method: InjectOptions['method'],
  url: string,
  payload?: InjectOptions['payload'],
  ip?: string,
) => Promise<LightMyRequestResponse>;

// Planejamento 0022 / ADR 0014: ataques contra a API real, com o banco.
// `preparo` (limites folgados) monta os dados; `alvo` usa os limites REAIS.
// Cada servidor tem seu próprio contador em memória; o banco é o mesmo.

let preparo: ServidorDeTeste;
beforeAll(async () => {
  preparo = await criarServidor();
});
afterAll(() => preparo?.close());

let ipSeq = 0;
const novoIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${(ipSeq % 250) + 1}`;

/** Servidor com os limites reais, novo a cada teste (contadores zerados). */
async function comAlvo(fn: (pedir: Pedir) => Promise<void>) {
  const alvo = await criarServidor({ limites: LIMITES_PADRAO });
  try {
    await fn((method, url, payload, ip = '10.9.9.9') =>
      alvo.inject({ method, url, payload, remoteAddress: ip }),
    );
  } finally {
    await alvo.close();
  }
}

function proximaSegunda() {
  const d = new Date(`${momentoNoFuso().data}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 1);
  return d.toISOString().slice(0, 10);
}

/** Barbearia publicada, com serviço, barbeiro e um cliente conhecido. */
async function publicada() {
  const b = await novaBarbearia(preparo, 'Alvo');
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
  return { ...b, servico, barbeiro };
}

describe('força bruta no login', () => {
  it('5 erros na mesma conta: a 6ª tentativa recebe 429, mesmo com a senha certa', async () => {
    const { email } = await novaBarbearia(preparo);
    await comAlvo(async (pedir: Pedir) => {
      for (let i = 0; i < LIMITES_PADRAO.entrarPorEmail.max; i++) {
        // IPs diferentes: o limite é da conta, não só do IP.
        const r = await pedir(
          'POST',
          '/api/auth/entrar',
          { email, senha: 'errada-123' },
          novoIp(),
        );
        expect(r.statusCode).toBe(401);
      }
      const certa = await pedir(
        'POST',
        '/api/auth/entrar',
        { email: email.toUpperCase(), senha: 'senha-segura' },
        novoIp(),
      );
      expect(certa.statusCode).toBe(429);
      expect(certa.json().mensagem).toMatch(/Muitas tentativas/);
      expect(certa.headers['retry-after']).toBeDefined();
    });
  });

  it('um IP tentando muitas contas recebe 429 depois do limite', async () => {
    await comAlvo(async (pedir: Pedir) => {
      for (let i = 0; i < LIMITES_PADRAO.entrarPorIp.max; i++) {
        const r = await pedir('POST', '/api/auth/entrar', {
          email: `ninguem-${i}@teste.dev`,
          senha: 'qualquer-1',
        });
        expect(r.statusCode).toBe(401);
      }
      const r = await pedir('POST', '/api/auth/entrar', {
        email: 'mais-um@teste.dev',
        senha: 'qualquer-1',
      });
      expect(r.statusCode).toBe(429);
    });
  });

  it('login com senha null ou ausente responde 401 sem checar hash (#44)', async () => {
    const { email } = await novaBarbearia(preparo);
    const casos = [
      { email, senha: null },
      { email, senha: undefined },
      { email },
    ];
    for (const corpo of casos) {
      const r = await preparo.inject({
        method: 'POST',
        url: '/api/auth/entrar',
        payload: corpo,
      });
      expect(r.statusCode).toBe(401);
      expect(r.json().mensagem).toBe('E-mail ou senha incorretos.');
    }
  });

  it('e-mail inexistente e senha errada levam o mesmo tempo (sem descoberta de contas)', async () => {
    const { email } = await novaBarbearia(preparo);
    const tentar = (corpo: object) =>
      preparo.inject({
        method: 'POST',
        url: '/api/auth/entrar',
        payload: corpo,
      });
    const medir = async (corpo: object) => {
      const tempos = [];
      for (let i = 0; i < 7; i++) {
        const t = performance.now();
        const r = await tentar(corpo);
        tempos.push(performance.now() - t);
        expect(r.statusCode).toBe(401);
        expect(r.json().mensagem).toBe('E-mail ou senha incorretos.');
      }
      return tempos.sort((a, b) => a - b)[3]; // mediana
    };
    const inexistente = { email: 'nao-existe@teste.dev', senha: 'errada-123' };
    const senhaErrada = { email, senha: 'errada-123' };
    // Aquecimento: a primeira chamada de cada caminho paga JIT e conexões.
    await tentar(inexistente);
    await tentar(senhaErrada);
    const razao = (await medir(inexistente)) / (await medir(senhaErrada));
    // Sem o hash falso, a razão cai para ~0,07 (o inexistente não roda scrypt).
    expect(razao).toBeGreaterThan(0.33);
    expect(razao).toBeLessThan(3);
  });
});

describe('cadastro em massa', () => {
  it('o 6º cadastro do mesmo IP na hora recebe 429', async () => {
    await comAlvo(async (pedir: Pedir) => {
      for (let i = 0; i < LIMITES_PADRAO.cadastroPorIp.max; i++)
        expect((await pedir('POST', '/api/barbearias', {})).statusCode).toBe(
          400,
        );
      expect((await pedir('POST', '/api/barbearias', {})).statusCode).toBe(429);
    });
  });
});

describe('varredura de telefones na página pública', () => {
  it('um IP: depois de 10 consultas, 429', async () => {
    const { slug } = await publicada();
    await comAlvo(async (pedir: Pedir) => {
      const url = (t: string) =>
        `/api/publico/${slug}/cliente?telefone=119${t}`;
      for (let i = 0; i < LIMITES_PADRAO.reconhecerPorIp.max; i++)
        expect((await pedir('GET', url(String(10000000 + i)))).statusCode).toBe(
          200,
        );
      expect((await pedir('GET', url('87654321'))).statusCode).toBe(429);
    });
  });

  it('distribuída (um IP por consulta): a barbearia tem teto próprio', async () => {
    const { slug } = await publicada();
    await comAlvo(async (pedir: Pedir) => {
      const url = (t: string) =>
        `/api/publico/${slug}/cliente?telefone=119${t}`;
      for (let i = 0; i < LIMITES_PADRAO.reconhecerPorBarbearia.max; i++)
        expect(
          (await pedir('GET', url(String(20000000 + i)), undefined, novoIp()))
            .statusCode,
        ).toBe(200);
      const r = await pedir('GET', url('87654321'), undefined, novoIp());
      expect(r.statusCode).toBe(429);
      // Varrer não revela nada além do primeiro nome, e só até o teto.
      expect(r.json()).not.toHaveProperty('primeiroNome');
    });
  });

  it('agendar com o mesmo telefone: 3 por hora, mesmo vindo de IPs diferentes', async () => {
    const { slug, servico, barbeiro } = await publicada();
    await comAlvo(async (pedir: Pedir) => {
      const corpo = {
        data: '2000-01-03', // passado: recusado pela regra, mas conta no limite
        inicio: '09:00',
        barbeiroId: barbeiro.id,
        servicoId: servico.id,
        cliente: { nome: 'Spam', telefone: '(11) 95555-4444' },
      };
      const url = `/api/publico/${slug}/agendamentos`;
      for (let i = 0; i < LIMITES_PADRAO.agendarPorTelefone.max; i++)
        expect((await pedir('POST', url, corpo, novoIp())).statusCode).toBe(
          400,
        );
      const r = await pedir(
        'POST',
        url,
        { ...corpo, cliente: { nome: 'Spam', telefone: '11955554444' } },
        novoIp(),
      );
      expect(r.statusCode).toBe(429);
    });
  });
});

describe('injeção e confusão de tipo nas rotas reais', () => {
  it('objeto no lugar de texto, SQL no texto e lista no lugar de objeto', async () => {
    const { dono, slug } = await publicada();
    const tipoErrado = await dono.post('/api/clientes', {
      nome: ['Ana'],
      telefone: '11911112222',
    });
    expect(tipoErrado.status).toBe(400);
    expect(tipoErrado.corpo.mensagem).toBe('Dados inválidos (nome).');

    // SQL vira só texto: parametrizado, gravado literalmente.
    const sql = "Robert'); drop table clientes;--";
    const salvo = await dono.post('/api/clientes', {
      nome: sql,
      telefone: '11933334444',
    });
    expect(salvo.status).toBe(201);
    expect(salvo.corpo.nome).toBe(sql);
    expect((await dono.get('/api/clientes')).status).toBe(200);

    const publico = await preparo.inject({
      method: 'POST',
      url: `/api/publico/${slug}/agendamentos`,
      payload: { data: proximaSegunda(), inicio: '09:00', cliente: [] },
    });
    expect(publico.statusCode).toBe(400);
  });

  it('comanda com itens demais é recusada antes do banco', async () => {
    const { dono } = await publicada();
    const r = await dono.post('/api/comandas', {
      barbeiroId: 1,
      itens: Array.from({ length: 300 }, () => ({ tipo: 'servico', refId: 1 })),
    });
    expect(r.status).toBe(400);
  });
});

describe('escalada de privilégio: hierarquia fixa (ADR 0010)', () => {
  /** Barbearia com uma pessoa de cada papel, cada uma logada. */
  async function equipe() {
    const b = await novaBarbearia(preparo);
    const papeis = Object.fromEntries(
      (await b.dono.get('/api/papeis')).corpo.map((p: PapelDaBarbearia) => [
        p.chave,
        p.id,
      ]),
    );
    const pessoas: Record<string, { id: number; n: Navegador; email: string }> =
      {};
    for (const chave of ['gerente', 'recepcao', 'barbeiro']) {
      const email = `${unico(chave)}@teste.dev`;
      const r = await b.dono.post('/api/usuarios', {
        nome: chave,
        email,
        senha: 'senha-segura',
        papelId: papeis[chave],
      });
      expect(r.status).toBe(201);
      const n = navegador(preparo);
      await n.post('/api/auth/entrar', { email, senha: 'senha-segura' });
      pessoas[chave] = { id: r.corpo.id, n, email };
    }
    const idDono = (await b.dono.get('/api/auth/eu')).corpo.usuario.id;
    return { ...b, papeis, pessoas, idDono };
  }

  it('ninguém dá o papel Dono, nem o próprio Dono', async () => {
    const { dono, papeis, pessoas } = await equipe();
    const promover = await dono.put(`/api/usuarios/${pessoas.gerente.id}`, {
      papelId: papeis.dono,
    });
    expect(promover.status).toBe(403);
    expect(promover.corpo.mensagem).toBe(
      'Você só pode dar papéis abaixo do seu.',
    );
    const convidarDono = await dono.post('/api/usuarios', {
      nome: 'Sócio',
      email: `${unico('socio')}@teste.dev`,
      senha: 'senha-segura',
      papelId: papeis.dono,
    });
    expect(convidarDono.status).toBe(403);
  });

  it('Gerente gerencia só Recepção e Barbeiro: nada acima nem na lateral', async () => {
    const { pessoas, papeis, idDono, dono } = await equipe();
    const g = pessoas.gerente.n;
    // Para baixo: pode.
    expect(
      (
        await g.put(`/api/usuarios/${pessoas.barbeiro.id}`, {
          papelId: papeis.recepcao,
        })
      ).status,
    ).toBe(200);
    // Lateral: não convida outro Gerente nem promove alguém a Gerente.
    expect(
      (
        await g.post('/api/usuarios', {
          nome: 'Outro gerente',
          email: `${unico('g2')}@teste.dev`,
          senha: 'senha-segura',
          papelId: papeis.gerente,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await g.put(`/api/usuarios/${pessoas.recepcao.id}`, {
          papelId: papeis.gerente,
        })
      ).status,
    ).toBe(403);
    // Acima: não desativa, rebaixa nem remove o Dono.
    const contraODono = await g.put(`/api/usuarios/${idDono}`, {
      ativo: false,
    });
    expect(contraODono.status).toBe(403);
    expect(contraODono.corpo.mensagem).toBe(
      'Você só pode alterar o acesso de quem está abaixo de você.',
    );
    expect(
      (await g.put(`/api/usuarios/${idDono}`, { papelId: papeis.barbeiro }))
        .status,
    ).toBe(403);
    expect((await g.delete(`/api/usuarios/${idDono}`)).status).toBe(403);
    // O Dono continua Dono e ativo.
    expect((await dono.get('/api/auth/eu')).corpo.papel.chave).toBe('dono');
  });

  it('Recepção e Barbeiro não gerenciam ninguém', async () => {
    const { pessoas } = await equipe();
    for (const chave of ['recepcao', 'barbeiro']) {
      const r = await pessoas[chave].n.put(
        `/api/usuarios/${pessoas.barbeiro.id}`,
        {
          ativo: false,
        },
      );
      expect(r.status).toBe(403);
      expect((await pessoas[chave].n.get('/api/papeis')).status).toBe(403);
    }
  });

  it('permissões vêm do código: adulterar a coluna do banco não dá acesso', async () => {
    const { pessoas, sessao } = await equipe();
    await comoSuperusuario((c) =>
      c.query(
        "update papeis set permissoes = array['barbearia.configurar','modulos.gerenciar'] where barbearia_id = $1 and chave = 'barbeiro'",
        [sessao.barbearia.id],
      ),
    );
    const eu = (await pessoas.barbeiro.n.get('/api/auth/eu')).corpo;
    expect(eu.permissoes).toEqual([
      'agenda.ver',
      'agenda.ajudar',
      'clientes.ver',
      'clientes.editar',
      'caixa.operar',
    ]);
    expect((await pessoas.barbeiro.n.get('/api/barbearia')).status).toBe(403);
  });
});

describe('esqueci a senha (planejamento 0023)', () => {
  const tokenDoEmail = (msg: Mensagem | undefined) =>
    msg!.texto.match(/#t=([\w-]+)/)![1];
  /** Token e e-mail saem depois da resposta: espera o próximo e-mail chegar. */
  const esperarNovo = async (antes: number) => {
    for (let i = 0; i < 150 && preparo.caixaDeEntrada.length <= antes; i++)
      await new Promise((r) => setTimeout(r, 20));
  };

  it('mesma resposta exista o e-mail ou não; só a conta real recebe o link', async () => {
    const { email } = await novaBarbearia(preparo);
    const antes = preparo.caixaDeEntrada.length;
    const pedir = (e: string) =>
      preparo.inject({
        method: 'POST',
        url: '/api/auth/esqueci',
        payload: { email: e },
      });
    const real = await pedir(email.toUpperCase());
    const falso = await pedir('ninguem-aqui@teste.dev');
    expect(real.statusCode).toBe(200);
    expect(falso.statusCode).toBe(200);
    expect(real.json()).toEqual(falso.json());
    await esperarNovo(antes);
    const novos = preparo.caixaDeEntrada.slice(antes);
    expect(novos.map((m: Mensagem) => m.para)).toEqual([email]);
    expect(novos[0].texto).toContain('http://app.teste/redefinir-senha#t=');
  });

  it('o link cria a senha nova uma vez só, derruba as sessões e o anterior deixa de valer', async () => {
    const { email, dono } = await novaBarbearia(preparo);
    const pedir = () =>
      preparo.inject({
        method: 'POST',
        url: '/api/auth/esqueci',
        payload: { email },
      });
    let antes = preparo.caixaDeEntrada.length;
    await pedir();
    await esperarNovo(antes);
    const antigo = tokenDoEmail(preparo.caixaDeEntrada.at(-1));
    antes = preparo.caixaDeEntrada.length;
    await pedir();
    await esperarNovo(antes);
    const token = tokenDoEmail(preparo.caixaDeEntrada.at(-1));
    const redefinir = (t: string, senha = 'senha-nova-123') =>
      preparo.inject({
        method: 'POST',
        url: '/api/auth/redefinir',
        payload: { token: t, senha },
      });

    expect((await redefinir(antigo)).statusCode).toBe(400); // substituído
    expect((await redefinir(token, 'curta')).statusCode).toBe(400); // não queima o link
    const ok = await redefinir(token);
    expect(ok.statusCode).toBe(200);
    expect((await redefinir(token)).statusCode).toBe(400); // uso único
    expect((await dono.get('/api/auth/eu')).status).toBe(401); // sessões caíram

    const n = navegador(preparo);
    expect(
      (await n.post('/api/auth/entrar', { email, senha: 'senha-segura' }))
        .status,
    ).toBe(401);
    expect(
      (await n.post('/api/auth/entrar', { email, senha: 'senha-nova-123' }))
        .status,
    ).toBe(200);
  });

  it('link expirado ou inventado não funciona', async () => {
    const { email } = await novaBarbearia(preparo);
    const antes = preparo.caixaDeEntrada.length;
    await preparo.inject({
      method: 'POST',
      url: '/api/auth/esqueci',
      payload: { email },
    });
    await esperarNovo(antes);
    const token = tokenDoEmail(preparo.caixaDeEntrada.at(-1));
    await comoSuperusuario((c) =>
      c.query(
        "update redefinicoes_senha set expira_em = now() - interval '1 minute'",
      ),
    );
    for (const t of [token, 'inventado', '']) {
      const r = await preparo.inject({
        method: 'POST',
        url: '/api/auth/redefinir',
        payload: { token: t, senha: 'senha-nova-123' },
      });
      expect(r.statusCode).toBe(400);
      expect(r.json().mensagem).toContain('inválido ou expirou');
    }
  });

  it('pedidos em massa para a mesma conta: 429 depois de 3 por hora', async () => {
    const { email } = await novaBarbearia(preparo);
    await comAlvo(async (pedir: Pedir) => {
      for (let i = 0; i < LIMITES_PADRAO.esqueciPorEmail.max; i++)
        expect(
          (await pedir('POST', '/api/auth/esqueci', { email }, novoIp()))
            .statusCode,
        ).toBe(200);
      expect(
        (await pedir('POST', '/api/auth/esqueci', { email }, novoIp()))
          .statusCode,
      ).toBe(429);
    });
  });
});
