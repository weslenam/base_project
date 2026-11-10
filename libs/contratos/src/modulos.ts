// Contratos de modulos (movidos de apps/api/src/app/rotas/modulos.ts, planejamento 0040).

import type { Modulo } from '@barbertime/dominio';
/** Módulo do catálogo com o estado nesta barbearia (`GET /modulos`). */
export interface ModuloDaBarbearia extends Modulo {
  estado: string;
  atualizadoEm: Date | null;
}
