// Contratos de papeis (movidos de apps/api/src/app/rotas/papeis.ts, planejamento 0040).

/** Papel como a tela de usuários e papéis o recebe (`GET /papeis`). */
export interface PapelDaBarbearia {
  id: number;
  chave: string;
  nome: string;
  /** Quantas pessoas têm o papel nesta barbearia. */
  usuarios: number;
  nivel: number | null;
  protegido: true;
  permissoes: string[];
}
