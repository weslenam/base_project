import fp from 'fastify-plugin';
import type { FastifyError } from 'fastify';
import { ErroHttp, invalido } from '../infra/erros.ts';

/**
 * Guarda de entrada (ADR 0014, planejamento 0022), em toda rota:
 *  - corpo até 64 KB;
 *  - parâmetros de rota tipados (`:id` inteiro, `:slug`, `:chave` e `:acao` com
 *    formato e tamanho), para que lixo vire 400 e não chegue ao banco;
 *  - forma do corpo e da query limitada (profundidade, textos, listas, chaves).
 * O JSON com __proto__/constructor já é recusado pelo parser do Fastify.
 * Regra de negócio não fica aqui: continua no domínio e nas rotas.
 */
export const LIMITES_DE_ENTRADA = Object.freeze({
  bytes: 64 * 1024,
  profundidade: 8,
  texto: 5000,
  lista: 500,
  chaves: 200,
});

const PARAMETROS: Record<string, Record<string, unknown>> = {
  id: {
    type: 'integer',
    minimum: -9007199254740991,
    maximum: 9007199254740991,
  },
  slug: {
    type: 'string',
    minLength: 1,
    maxLength: 80,
    pattern: '^[a-z0-9-]+$',
  },
  chave: { type: 'string', minLength: 1, maxLength: 40, pattern: '^[a-z_]+$' },
  acao: { type: 'string', minLength: 1, maxLength: 40, pattern: '^[a-z_]+$' },
};

/** Primeiro problema de forma encontrado, ou null. */
export function problemaDeForma(
  valor: unknown,
  l: typeof LIMITES_DE_ENTRADA = LIMITES_DE_ENTRADA,
  nivel = 0,
): string | null {
  if (typeof valor === 'string')
    return valor.length > l.texto ? 'texto longo demais' : null;
  if (valor === null || typeof valor !== 'object') return null;
  if (nivel >= l.profundidade) return 'estrutura aninhada demais';
  if (Array.isArray(valor)) {
    if (valor.length > l.lista) return 'lista grande demais';
    for (const v of valor) {
      const p: string | null = problemaDeForma(v, l, nivel + 1);
      if (p) return p;
    }
    return null;
  }
  const chaves = Object.keys(valor);
  if (chaves.length > l.chaves) return 'campos demais';
  for (const k of chaves) {
    if (k.length > 100) return 'nome de campo longo demais';
    const p: string | null = problemaDeForma(
      (valor as Record<string, unknown>)[k],
      l,
      nivel + 1,
    );
    if (p) return p;
  }
  return null;
}

/** Erro de schema do Fastify → mensagem em pt-BR, sem ecoar a entrada. */
export function mensagemDeValidacao(erro: FastifyError): string {
  const [v] = erro.validation ?? [];
  const partes: Record<string, string> = {
    body: '',
    querystring: '',
    params: 'endereço: ',
  };
  const parte = partes[erro.validationContext ?? ''] ?? '';
  const campo =
    (v?.params as { missingProperty?: string } | undefined)?.missingProperty ??
    (v?.instancePath ?? '').replace(/^\//, '').replace(/\//g, '.');
  return campo ? `Dados inválidos (${parte}${campo}).` : 'Dados inválidos.';
}

/** Mensagens em pt-BR para os erros do próprio Fastify (4xx). */
export function mensagemDeErro(erro: FastifyError, status: number): string {
  if (erro instanceof ErroHttp) return erro.message;
  if (erro.validation) return mensagemDeValidacao(erro);
  if (status === 413) return 'Os dados enviados são grandes demais.';
  if (status === 415) return 'Formato de dados não aceito.';
  if (status === 404) return 'Não encontrado.';
  return 'Dados inválidos.';
}

export default fp(async function entrada(fastify) {
  fastify.addHook('onRoute', (rota) => {
    rota.bodyLimit ??= LIMITES_DE_ENTRADA.bytes;
    const nomes = [...rota.url.matchAll(/:([a-zA-Z]+)/g)].map((m) => m[1]);
    if (!nomes.length) return;
    rota.schema ??= {};
    if (rota.schema.params) return;
    rota.schema.params = {
      type: 'object',
      properties: Object.fromEntries(
        nomes.map((n) => [
          n,
          PARAMETROS[n] ?? { type: 'string', maxLength: 100 },
        ]),
      ),
    };
  });

  fastify.addHook('preValidation', async (req) => {
    // POST/PUT sem corpo: os handlers já tratam como {}; o schema também.
    if (req.body === undefined && ['POST', 'PUT', 'PATCH'].includes(req.method))
      req.body = {};
    const p = problemaDeForma(req.body) ?? problemaDeForma(req.query);
    if (p) throw invalido(`Dados inválidos (${p}).`);
  });
});
