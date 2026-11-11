// Contratos de barbearia (movidos de apps/api/src/app/rotas/barbearia.ts, planejamento 0040).

import type { ConfigBarbearia } from '@barbertime/dominio';
/** Barbearia atual como a tela de configurações a recebe. */
export interface BarbeariaConfigurada {
  id: number;
  nome: string;
  slug: string;
  configuracoes: ConfigBarbearia;
  /** Código do link da página no modo "só com o link" (ADR 0013). */
  tokenPublico: string;
}

/** `GET /barbearia`: avisa também se a página pública está travada no sistema. */
export type BarbeariaParaConfigurar = BarbeariaConfigurada & {
  paginaPublicaLiberada: boolean;
};
