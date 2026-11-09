// Como cada estado de agendamento aparece no DsSelo (sempre com palavra).
const SELOS = {
  pendente: { estado: 'pendente', texto: 'Pendente' },
  confirmado: { estado: 'confirmado', texto: 'Confirmado' },
  atendido: { estado: 'neutro', texto: 'Atendido' },
  faltou: { estado: 'faltou', texto: 'Faltou' },
  cancelado: { estado: 'neutro', texto: 'Cancelado' },
  bloqueado: { estado: 'neutro', texto: 'Bloqueado' },
};
export const seloDoEstado = (estado) => SELOS[estado] ?? SELOS.pendente;
