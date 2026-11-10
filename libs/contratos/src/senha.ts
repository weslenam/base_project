// Contratos de senha (movidos de apps/api/src/app/rotas/senha.ts, planejamento 0040).

/** Resposta de `POST /auth/esqueci` e `POST /auth/redefinir`. */
export interface RespostaDaSenha {
  ok: true;
  mensagem: string;
}
