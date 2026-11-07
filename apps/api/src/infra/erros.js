/** Erro com status HTTP e mensagem em pt-BR que o front mostra como está. */
export class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.statusCode = status;
  }
}

export const naoAutenticado = (m = 'Entre com seu e-mail e senha.') =>
  new ErroHttp(401, m);
export const proibido = (m = 'Você não tem permissão para isso.') =>
  new ErroHttp(403, m);
export const naoEncontrado = (m = 'Não encontrado.') => new ErroHttp(404, m);
export const conflito = (m) => new ErroHttp(409, m);
export const invalido = (m) => new ErroHttp(400, m);
