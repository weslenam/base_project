// Contratos de clientes (movidos de apps/api/src/app/rotas/clientes.ts, planejamento 0040).

/** Cliente com o resumo de atendimentos (`GET /clientes` e `/clientes/:id`). */
export interface ClienteComResumo {
  id: number;
  nome: string;
  telefone: string | null;
  cpf: string | null;
  observacoes: string;
  /** Atendimentos finalizados ou pagos. */
  atendimentos: number;
  faltas: number;
  /** Data (AAAA-MM-DD) do último atendimento finalizado ou pago. */
  ultimaVisita: string | null;
}
