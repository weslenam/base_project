import { inject } from 'vitest';
import Fastify from 'fastify';
import pg from 'pg';
import { app } from '../app/app.js';

export async function criarServidor() {
  const servidor = Fastify();
  servidor.register(app, { databaseUrl: inject('urlApp') });
  await servidor.ready();
  return servidor;
}

/** Cliente como superusuário (faz o papel do super admin nos testes). */
export async function comoSuperusuario(fn) {
  const c = new pg.Client({ connectionString: inject('urlMigracao') });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Cliente como barbertime_app (sujeito a RLS). */
export async function comoAplicacao(fn) {
  const c = new pg.Client({ connectionString: inject('urlApp') });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

let seq = 0;
export const unico = (prefixo) =>
  `${prefixo}-${Date.now().toString(36)}-${++seq}`;

/** Requisição com o cookie de sessão de um "navegador". */
export function navegador(servidor) {
  let cookie = '';
  const pedir = async (method, url, payload) => {
    const r = await servidor.inject({
      method,
      url,
      payload,
      headers: cookie ? { cookie } : {},
    });
    const novo = r.cookies.find((c) => c.name === 'bt_sessao');
    if (novo) cookie = novo.value ? `bt_sessao=${novo.value}` : '';
    return { status: r.statusCode, corpo: r.body ? r.json() : null };
  };
  return {
    get: (url) => pedir('GET', url),
    post: (url, corpo) => pedir('POST', url, corpo),
    put: (url, corpo) => pedir('PUT', url, corpo),
    delete: (url) => pedir('DELETE', url),
  };
}

/** Cria uma barbearia nova e devolve o navegador do Dono já logado. */
export async function novaBarbearia(servidor, nome = 'Barbearia Teste') {
  const slug = unico('b');
  const email = `${unico('dono')}@teste.dev`;
  const dono = navegador(servidor);
  const r = await dono.post('/api/barbearias', {
    nome,
    slug,
    dono: { nome: 'Dono Teste', email, senha: 'senha-segura' },
  });
  if (r.status !== 201)
    throw new Error(`cadastro falhou: ${JSON.stringify(r.corpo)}`);
  return { dono, slug, email, sessao: r.corpo };
}
