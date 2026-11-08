import { ErroDeNegocio } from './erros.js';

/** Sessão ausente ou expirada (401): o app leva para a tela de entrada. */
export class ErroDeSessao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroDeSessao';
  }
}

let aoExpirar = () => undefined;
/** Quem trata a sessão expirada (registrado no main.js: volta para /entrar). */
export function aoExpirarSessao(fn) {
  aoExpirar = fn;
}

/**
 * Chamada à API (mesma origem; o Vite repassa /api). Recusas (400, 403, 404, 409)
 * viram ErroDeNegocio com a mensagem da API, prontas para o diálogo de negação.
 */
export async function http(metodo, url, corpo) {
  const resposta = await fetch(url, {
    method: metodo,
    credentials: 'same-origin',
    headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const dados =
    resposta.status === 204 ? null : await resposta.json().catch(() => null);
  if (resposta.ok) return dados;
  const mensagem = dados?.mensagem ?? 'Algo deu errado. Tente de novo.';
  if (resposta.status === 401) {
    aoExpirar();
    throw new ErroDeSessao(mensagem);
  }
  if (resposta.status >= 500) throw new Error(mensagem);
  throw new ErroDeNegocio(mensagem);
}
