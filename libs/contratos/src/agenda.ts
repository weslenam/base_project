// Contratos da agenda e do balcão (planejamento 0040, etapa 4): o formato das
// respostas que o front consome. A libs/contratos junta tudo na etapa 9.
//
// O serviço da agenda (`agenda.ts`) já foi convertido na etapa 5 e devolve o
// atendimento como `LinhaDeAtendimento` (só id, status e confirmadoEm
// tipados). Aqui fica a linha completa de SELECT_ATENDIMENTO, que as rotas da
// operação usam.

/** Linha de SELECT_ATENDIMENTO com o `estado` da agenda (comEstado). */
export interface AtendimentoNaAgenda {
  id: number;
  data: string;
  inicio: string | null;
  fim: string | null;
  barbeiroId: number | null;
  servicoId: number | null;
  clienteId: number | null;
  /** Status do atendimento (agendado, chegou, na_fila...). */
  status: string;
  origem: string;
  canal: string;
  duracao: number | null;
  confirmadoEm: Date | null;
  chegouAs: string | null;
  iniciadoAs: string | null;
  finalizadoAs: string | null;
  clienteNome: string;
  clienteTelefone: string | null;
  servicoNome: string;
  barbeiroNome: string;
  comandaId: number | null;
  comandaEstado: string | null;
  criadoPor: number | null;
  barbeiroUsuarioId: number | null;
  /** Estado no vocabulário da agenda (pendente, confirmado, atendido...). */
  estado: string;
}

/** Bloqueio no formato da agenda (bloqueioNaAgenda); o id é negativo. */
export interface BloqueioNaAgenda {
  id: number;
  data: string;
  inicio: string;
  fim: string;
  barbeiroId: number;
  servicoId: null;
  clienteId: null;
  estado: string;
  status: string;
  motivo: string;
  clienteNome: string;
  servicoNome: string;
  barbeiroNome: string;
  criadoPor: number | null;
  barbeiroUsuarioId: number | null;
}

/** GET /agendamentos: atendimentos e bloqueios do dia, por horário. */
export type ItemDaAgenda = AtendimentoNaAgenda | BloqueioNaAgenda;

/** GET /agendamentos/:id de um atendimento. */
export type DetalheDoAgendamento = AtendimentoNaAgenda & {
  clienteObservacoes: string;
};
