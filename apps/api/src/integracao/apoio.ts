import { inject } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { app } from '../app/app.ts';
import { LIMITES_PADRAO } from '../seguranca/limites.ts';
import type { Limite } from '../seguranca/limites.ts';
import type { Mensagem } from '../infra/correio.ts';

/** Servidor de teste: o app de verdade, com os e-mails enviados guardados. */
export type ServidorDeTeste = FastifyInstance & { caixaDeEntrada: Mensagem[] };

/**
 * Resposta de `navegador`. O corpo é o JSON da API, sem tipo: cada teste lê os
 * campos que confere (os contratos tipados chegam com a libs/contratos).
 */
export interface Resposta {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corpo: any;
}

/**
 * Os testes disparam muitas requisições do mesmo IP: por padrão, limites
 * folgados. O seguranca.spec.js passa `limites: LIMITES_PADRAO` para testar os
 * valores reais (planejamento 0022).
 */
export const LIMITES_FOLGADOS = Object.fromEntries(
  Object.entries(LIMITES_PADRAO).map(([k, v]) => [k, { ...v, max: 1_000_000 }]),
);

export async function criarServidor(
  opcoes: {
    limites?: Record<string, Limite>;
  } = {},
): Promise<ServidorDeTeste> {
  const servidor = Fastify() as unknown as ServidorDeTeste;
  const caixaDeEntrada: Mensagem[] = [];
  servidor.register(app, {
    databaseUrl: inject('urlApp'),
    limites: opcoes.limites ?? LIMITES_FOLGADOS,
    // Correio falso: os testes leem os e-mails em `servidor.caixaDeEntrada`.
    correio: {
      enviar: async (msg: Mensagem) => {
        caixaDeEntrada.push(msg);
      },
    },
    appUrl: 'http://app.teste',
  });
  servidor.caixaDeEntrada = caixaDeEntrada;
  await servidor.ready();
  return servidor;
}

/** Cliente como superusuário (faz o papel do super admin nos testes). */
export async function comoSuperusuario<T>(
  fn: (c: pg.Client) => Promise<T>,
): Promise<T> {
  // O papel postgres do Supabase traz o próprio search_path: pede `app` (ADR 0017).
  const c = new pg.Client({
    connectionString: inject('urlMigracao'),
    options: '-c search_path=app,public',
  });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Cliente como barbertime_app (sujeito a RLS). */
export async function comoAplicacao<T>(
  fn: (c: pg.Client) => Promise<T>,
): Promise<T> {
  const c = new pg.Client({ connectionString: inject('urlApp') });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

let seq = 0;
export const unico = (prefixo: string): string =>
  `${prefixo}-${Date.now().toString(36)}-${++seq}`;

/** Requisição com o cookie de sessão de um "navegador". */
export function navegador(servidor: FastifyInstance) {
  let cookie = '';
  const pedir = async (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    payload?: unknown,
  ): Promise<Resposta> => {
    const r = await servidor.inject({
      method,
      url,
      payload: payload as never,
      headers: cookie ? { cookie } : {},
    });
    const novo = r.cookies.find((c) => c.name === 'bt_sessao');
    if (novo) cookie = novo.value ? `bt_sessao=${novo.value}` : '';
    return { status: r.statusCode, corpo: r.body ? r.json() : null };
  };
  return {
    get: (url: string) => pedir('GET', url),
    post: (url: string, corpo?: unknown) => pedir('POST', url, corpo),
    put: (url: string, corpo?: unknown) => pedir('PUT', url, corpo),
    delete: (url: string) => pedir('DELETE', url),
  };
}

/** Cria uma barbearia nova e devolve o navegador do Dono já logado. */
export async function novaBarbearia(
  servidor: FastifyInstance,
  nome = 'Barbearia Teste',
) {
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
