/** Recusa de regra de negócio. A mensagem vai direto para o diálogo de negação. */
export class ErroDeNegocio extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroDeNegocio';
  }
}
