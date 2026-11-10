// Contratos de usuarios (movidos de apps/api/src/app/rotas/usuarios.ts, planejamento 0040).

/** Pessoa com acesso à barbearia (`GET /usuarios` e respostas das ações). */
export interface UsuarioDaBarbearia {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  papelId: number;
  papelNome: string;
  papelChave: string;
  dono: boolean;
}
