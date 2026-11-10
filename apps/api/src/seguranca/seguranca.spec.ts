import Fastify from 'fastify';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { app } from '../app/app.ts';
import { problemaDeForma, LIMITES_DE_ENTRADA } from './entrada.ts';
import { conferirSenha, hashFalso } from './senha.ts';

// Proteções da API sem banco (ADR 0014, planejamento 0022). Tudo aqui é barrado
// antes do handler, então nenhuma requisição chega ao Postgres.

let servidor: FastifyInstance;
beforeEach(async () => {
  servidor = Fastify();
  servidor.register(app);
  await servidor.ready();
});
afterEach(() => servidor.close());

const pedir = (opcoes: InjectOptions) => servidor.inject(opcoes);

describe('cabeçalhos de segurança', () => {
  it('toda resposta traz os cabeçalhos do helmet', async () => {
    const r = await pedir({ method: 'GET', url: '/api/saude' });
    expect(r.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['strict-transport-security']).toMatch(/max-age=/);
    expect(r.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(r.headers['referrer-policy']).toBe('no-referrer');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });

  it('sem CORS: outra origem não recebe Access-Control-Allow-Origin', async () => {
    const origem = { origin: 'https://site-malicioso.example' };
    const get = await pedir({
      method: 'GET',
      url: '/api/saude',
      headers: origem,
    });
    expect(get.headers['access-control-allow-origin']).toBeUndefined();
    const preflight = await pedir({
      method: 'OPTIONS',
      url: '/api/auth/entrar',
      headers: { ...origem, 'access-control-request-method': 'POST' },
    });
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    expect(
      preflight.headers['access-control-allow-credentials'],
    ).toBeUndefined();
  });
});

describe('entrada malformada não chega ao banco', () => {
  it('id não numérico ou com SQL vira 400, não 500', async () => {
    for (const id of ['abc', '1;drop table clientes', '1%20or%201=1']) {
      const r = await pedir({ method: 'GET', url: `/api/clientes/${id}` });
      expect(r.statusCode).toBe(400);
      expect(r.json().mensagem).toMatch(/Dados inválidos \(endereço: id\)/);
    }
  });

  it('slug da página pública com caracteres fora do formato vira 400', async () => {
    const r = await pedir({
      method: 'GET',
      url: "/api/publico/x'%20or%20'1'='1",
    });
    expect(r.statusCode).toBe(400);
  });

  it('corpo acima de 64 KB é recusado (413) em pt-BR', async () => {
    const r = await pedir({
      method: 'POST',
      url: '/api/auth/entrar',
      payload: { email: 'a@b.c', senha: 'x'.repeat(70 * 1024) },
    });
    expect(r.statusCode).toBe(413);
    expect(r.json().mensagem).toBe('Os dados enviados são grandes demais.');
  });

  it('JSON inválido e __proto__ são recusados sem ecoar a entrada', async () => {
    const quebrado = await pedir({
      method: 'POST',
      url: '/api/auth/entrar',
      headers: { 'content-type': 'application/json' },
      payload: '{"email": <script>',
    });
    expect(quebrado.statusCode).toBe(400);
    expect(quebrado.json().mensagem).toBe('Dados inválidos.');

    const poluido = await pedir({
      method: 'POST',
      url: '/api/auth/entrar',
      headers: { 'content-type': 'application/json' },
      payload: '{"email":"a@b.c","__proto__":{"admin":true}}',
    });
    expect(poluido.statusCode).toBe(400);
    expect(({} as { admin?: unknown }).admin).toBeUndefined();
  });

  it('schema: tipo errado e texto longo demais no login viram 400', async () => {
    const objeto = await pedir({
      method: 'POST',
      url: '/api/auth/entrar',
      payload: { email: { $ne: null }, senha: 'x' },
    });
    expect(objeto.statusCode).toBe(400);
    expect(objeto.json().mensagem).toBe('Dados inválidos (email).');

    const longo = await pedir({
      method: 'POST',
      url: '/api/auth/entrar',
      payload: { email: `${'a'.repeat(300)}@b.c`, senha: 'x' },
    });
    expect(longo.statusCode).toBe(400);
  });

  it('guarda de forma: aninhamento, listas e textos gigantes', async () => {
    let fundo: unknown = 'x';
    for (let i = 0; i < 20; i++) fundo = { a: fundo };
    const r = await pedir({
      method: 'POST',
      url: '/api/clientes',
      payload: fundo as object,
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().mensagem).toBe(
      'Dados inválidos (estrutura aninhada demais).',
    );

    expect(problemaDeForma({ itens: Array(501).fill(1) })).toBe(
      'lista grande demais',
    );
    expect(
      problemaDeForma({ obs: 'x'.repeat(LIMITES_DE_ENTRADA.texto + 1) }),
    ).toBe('texto longo demais');
    expect(problemaDeForma({ nome: 'Ana', itens: [{ id: 1 }] })).toBeNull();
  });

  it('query gigante também é barrada', async () => {
    const r = await pedir({
      method: 'GET',
      url: `/api/clientes?busca=${'a'.repeat(LIMITES_DE_ENTRADA.texto + 1)}`,
    });
    expect(r.statusCode).toBe(400);
  });
});

describe('limite de requisições', () => {
  it('excedeu o global: 429 em pt-BR com retry-after', async () => {
    const s = Fastify();
    s.register(app, { limites: { global: { max: 2, janela: 60_000 } } });
    await s.ready();
    try {
      for (let i = 0; i < 2; i++)
        expect((await s.inject({ url: '/api/saude' })).statusCode).toBe(200);
      const r = await s.inject({ url: '/api/saude' });
      expect(r.statusCode).toBe(429);
      expect(r.json().mensagem).toMatch(/Muitas tentativas/);
      expect(r.headers['retry-after']).toBeDefined();
    } finally {
      await s.close();
    }
  });
});

describe('senha', () => {
  it('hash falso tem o mesmo formato e custo e nunca confere', async () => {
    const h = await hashFalso();
    expect(h).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await hashFalso()).toBe(h);
    expect(await conferirSenha('qualquer', h)).toBe(false);
  });
});

describe('#33: hash de senha corrompido', () => {
  it('#33: hash truncado ou vazio nunca confere', async () => {
    for (const guardado of [
      'scrypt$16384$8$1',
      'scrypt$16384$8$1$$',
      'scrypt$16384$8$1$c2Fs$',
      'scrypt$16384$8$1$$aGFzaA==',
      '',
    ])
      expect(await conferirSenha('qualquer-coisa', guardado)).toBe(false);
  });
});
