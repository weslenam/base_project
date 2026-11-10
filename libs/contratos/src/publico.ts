// Contratos de publico (movidos de apps/api/src/app/rotas/publico.ts, planejamento 0040).

import type { ConfigBarbearia } from '@barbertime/dominio';
/** `GET /publico/:slug`: tudo que a página precisa para começar. */
export interface PaginaPublica {
  barbearia: {
    nome: string;
    slug: string;
    contato: ConfigBarbearia['contato'];
    funcionamento: ConfigBarbearia['funcionamento'];
    agendamento: ConfigBarbearia['agendamento'];
  };
  servicos: { id: number; nome: string; duracao: number; preco: number }[];
  barbeiros: { id: number; nome: string; inicio: string; fim: string }[];
  hoje: string;
}

/** `POST /publico/:slug/agendamentos`: só o necessário para a confirmação. */
export interface AgendamentoPublico {
  id: number;
  data: unknown;
  inicio: unknown;
  fim: unknown;
  servicoNome: unknown;
  barbeiroNome: unknown;
  primeiroNome: string | null;
}
