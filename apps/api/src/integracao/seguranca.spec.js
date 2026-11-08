import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { momentoNoFuso } from '@barbertime/dominio';
import { LIMITES_PADRAO } from '../seguranca/limites.js';
import { criarServidor, navegador, novaBarbearia, unico } from './apoio.js';

// Planejamento 0022 / ADR 0014: ataques contra a API real, com o banco.
// `preparo` (limites folgados) monta os dados; `alvo` usa os limites REAIS.
// Cada servidor tem seu próprio contador em memória; o banco é o mesmo.

let preparo;
beforeAll(async () => {
  preparo = await criarServidor();
});
afterAll(() => preparo?.close());

let ipSeq = 0;
const novoIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${(ipSeq % 250) + 1}`;

/** Servidor com os limites reais, novo a cada teste (contadores zerados). */
async function comAlvo(fn) {
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
    await comAlvo(async (pedir) => {
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
    await comAlvo(async (pedir) => {
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

  it('e-mail inexistente e senha errada levam o mesmo tempo (sem descoberta de contas)', async () => {
    const { email } = await novaBarbearia(preparo);
    const medir = async (corpo) => {
      const tempos = [];
      for (let i = 0; i < 5; i++) {
        const t = performance.now();
        const r = await preparo.inject({
          method: 'POST',
          url: '/api/auth/entrar',
          payload: corpo,
        });
        tempos.push(performance.now() - t);
        expect(r.statusCode).toBe(401);
        expect(r.json().mensagem).toBe('E-mail ou senha incorretos.');
      }
      return tempos.sort((a, b) => a - b)[2]; // mediana
    };
    const inexistente = await medir({
      email: 'nao-existe@teste.dev',
      senha: 'errada-123',
    });
    const senhaErrada = await medir({ email, senha: 'errada-123' });
    // Sem o hash falso, o inexistente seria ~20x mais rápido (sem scrypt).
    expect(inexistente / senhaErrada).toBeGreaterThan(0.5);
    expect(inexistente / senhaErrada).toBeLessThan(2);
  });
});

describe('cadastro em massa', () => {
  it('o 6º cadastro do mesmo IP na hora recebe 429', async () => {
    await comAlvo(async (pedir) => {
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
    await comAlvo(async (pedir) => {
      const url = (t) => `/api/publico/${slug}/cliente?telefone=119${t}`;
      for (let i = 0; i < LIMITES_PADRAO.reconhecerPorIp.max; i++)
        expect((await pedir('GET', url(String(10000000 + i)))).statusCode).toBe(
          200,
        );
      expect((await pedir('GET', url('87654321'))).statusCode).toBe(429);
    });
  });

  it('distribuída (um IP por consulta): a barbearia tem teto próprio', async () => {
    const { slug } = await publicada();
    await comAlvo(async (pedir) => {
      const url = (t) => `/api/publico/${slug}/cliente?telefone=119${t}`;
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
    await comAlvo(async (pedir) => {
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

describe('escalada de privilégio: ninguém concede o que não tem', () => {
  /** Dono cria um papel personalizado e uma pessoa com ele, já logada. */
  async function comPapel(permissoes) {
    const b = await novaBarbearia(preparo);
    const papel = (
      await b.dono.post('/api/papeis', { nome: unico('Papel'), permissoes })
    ).corpo;
    const email = `${unico('func')}@teste.dev`;
    const criado = await b.dono.post('/api/usuarios', {
      nome: 'Funcionário',
      email,
      senha: 'senha-segura',
      papelId: papel.id,
    });
    expect(criado.status).toBe(201);
    const funcionario = navegador(preparo);
    await funcionario.post('/api/auth/entrar', {
      email,
      senha: 'senha-segura',
    });
    const papeis = (await b.dono.get('/api/papeis')).corpo;
    const usuarios = (await b.dono.get('/api/usuarios')).corpo;
    return {
      ...b,
      papel,
      funcionario,
      papelDono: papeis.find((p) => p.chave === 'dono'),
      idDono: usuarios.find((u) => u.dono).id,
    };
  }

  it('quem só administra usuários não vira Dono nem assume a conta do Dono', async () => {
    const { funcionario, papelDono, idDono, papel, dono, email } =
      await comPapel(['usuarios.gerenciar']);
    const negado =
      'Você não pode dar um papel com permissões que você não tem.';

    const virarDono = await funcionario.post('/api/usuarios', {
      nome: 'Comparsa',
      email: `${unico('comparsa')}@teste.dev`,
      senha: 'senha-segura',
      papelId: papelDono.id,
    });
    expect(virarDono.status).toBe(403);
    expect(virarDono.corpo.mensagem).toBe(negado);

    const senhaDoDono = await funcionario.put(`/api/usuarios/${idDono}/senha`, {
      senha: 'tomei-a-conta',
    });
    expect(senhaDoDono.status).toBe(403);
    expect(
      (await funcionario.put(`/api/usuarios/${idDono}`, { ativo: false }))
        .status,
    ).toBe(403);
    expect((await funcionario.delete(`/api/usuarios/${idDono}`)).status).toBe(
      403,
    );

    // O Dono continua entrando com a senha dele.
    const n = navegador(preparo);
    expect(
      (await n.post('/api/auth/entrar', { email, senha: 'senha-segura' }))
        .status,
    ).toBe(200);

    // Papel com o mesmo acesso (ou menos) continua podendo ser dado.
    const igual = await funcionario.post('/api/usuarios', {
      nome: 'Colega',
      email: `${unico('colega')}@teste.dev`,
      senha: 'senha-segura',
      papelId: papel.id,
    });
    expect(igual.status).toBe(201);
    // E o Dono, que tem tudo, continua podendo tudo.
    expect(
      (
        await dono.put(`/api/usuarios/${igual.corpo.id}`, {
          papelId: papelDono.id,
        })
      ).status,
    ).toBe(200);
  });

  it('quem gerencia papéis não aumenta o próprio papel nem cria um maior', async () => {
    const { funcionario, papel } = await comPapel(['papeis.gerenciar']);
    const proprio = await funcionario.put(`/api/papeis/${papel.id}`, {
      nome: papel.nome,
      permissoes: ['papeis.gerenciar', 'caixa.fechar'],
    });
    expect(proprio.status).toBe(403);
    expect(proprio.corpo.mensagem).toBe(
      'Você não pode dar a um papel permissões que você não tem.',
    );
    expect(
      (
        await funcionario.post('/api/papeis', {
          nome: unico('Maior'),
          permissoes: ['barbearia.configurar'],
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await funcionario.post('/api/papeis', {
          nome: unico('Menor'),
          permissoes: ['papeis.gerenciar'],
        })
      ).status,
    ).toBe(201);
  });
});
