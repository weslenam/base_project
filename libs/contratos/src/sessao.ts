// Contratos da sessão (movidos de apps/api/src/app/rotas/autenticacao.ts, planejamento 0040).

/** Papel do usuário na barbearia aberta (o mesmo do contexto da requisição). */
export interface PapelDaSessao {
  id: number;
  nome: string;
  chave: string;
}

/** Barbearia que o usuário pode abrir. */
export interface BarbeariaDoUsuario {
  id: number;
  nome: string;
  slug: string;
}

/** Resposta de entrar, `GET /auth/eu` e das trocas de barbearia e perfil. */
export interface DadosDaSessao {
  usuario: { id: number; nome: string; email: string } | undefined;
  barbearia: BarbeariaDoUsuario | undefined;
  barbearias: BarbeariaDoUsuario[];
  papel: PapelDaSessao;
  permissoes: string[];
  modulosAtivos: string[];
}
