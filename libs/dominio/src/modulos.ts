// Catálogo fechado de módulos (ADR 0011). "incluso": faz parte do plano; a barbearia
// ativa e desativa. "adicional": serviço contratado; a barbearia solicita e ele só fica
// ativo quando a contratação é confirmada.

/** Módulo do catálogo (ADR 0011). */
export interface Modulo {
  chave: string;
  nome: string;
  descricao: string;
  tipo: 'incluso' | 'adicional' | string;
}

export const MODULOS: readonly Modulo[] = Object.freeze([
  {
    chave: 'agendamento_online',
    nome: 'Agendamento online',
    descricao: 'Página pública para o cliente marcar horário sozinho.',
    tipo: 'incluso',
  },
  {
    chave: 'comissoes',
    nome: 'Comissões',
    descricao: 'Cálculo e fechamento de comissão por barbeiro.',
    tipo: 'incluso',
  },
  {
    chave: 'lembretes',
    nome: 'Lembretes por e-mail',
    descricao: 'Lembrete e confirmação antes do horário.',
    tipo: 'incluso',
  },
  {
    chave: 'fidelidade',
    nome: 'Fidelidade',
    descricao:
      'Selos (a cada N atendimentos, um serviço de prêmio) e/ou cashback em crédito para a próxima visita.',
    tipo: 'adicional',
  },
  {
    chave: 'pacotes',
    nome: 'Pacotes',
    descricao:
      'Pacotes de serviços por quantidade ou livres, recorrentes ou com validade, com controle de uso.',
    tipo: 'adicional',
  },
  {
    chave: 'estoque',
    nome: 'Estoque e compras',
    descricao:
      'Saldo de produtos de revenda e consumíveis, ficha técnica por serviço, inventário, fornecedores e registro de compras com parcelas.',
    tipo: 'adicional',
  },
  {
    chave: 'financeiro',
    nome: 'Financeiro',
    descricao:
      'Contas a pagar e a receber, recorrências, categorias e previsão do fluxo de caixa.',
    tipo: 'adicional',
  },
  {
    chave: 'pagamentos_online',
    nome: 'Pagamento online',
    descricao:
      'Cobrança por Pix, cartão e link de pagamento integrada ao caixa (gateway).',
    tipo: 'adicional',
  },
  {
    chave: 'whatsapp',
    nome: 'WhatsApp',
    descricao: 'Agendamento, lembretes e avisos pelo WhatsApp.',
    tipo: 'adicional',
  },
  {
    chave: 'nfse',
    nome: 'Nota fiscal (NFS-e)',
    descricao: 'Emissão de nota de serviço a partir da comanda.',
    tipo: 'adicional',
  },
]);

export const CHAVES_DE_MODULO = Object.freeze(MODULOS.map((m) => m.chave));
export const ESTADOS_DE_MODULO = Object.freeze([
  'inativo',
  'solicitado',
  'ativo',
]);

export const moduloDoCatalogo = (chave: string): Modulo | null =>
  MODULOS.find((m) => m.chave === chave) ?? null;

/**
 * Próximo estado de um módulo para uma ação, ou { erro } explicando a recusa.
 * Ações: ativar | desativar | solicitar | cancelar_solicitacao | confirmar_contratacao
 */
export function transicaoDeModulo(
  chave: string,
  estadoAtual = 'inativo',
  acao: string,
): { estado?: string; erro?: string } {
  const modulo = moduloDoCatalogo(chave);
  if (!modulo) return { erro: 'Módulo desconhecido.' };
  const adicional = modulo.tipo === 'adicional';
  const tabela: Record<string, () => { estado?: string; erro?: string }> = {
    ativar: () =>
      adicional
        ? {
            erro: `${modulo.nome} é um serviço adicional: solicite a contratação.`,
          }
        : estadoAtual === 'ativo'
          ? { erro: `${modulo.nome} já está ativo.` }
          : { estado: 'ativo' },
    desativar: () =>
      estadoAtual !== 'ativo'
        ? { erro: `${modulo.nome} não está ativo.` }
        : { estado: 'inativo' },
    solicitar: () =>
      !adicional
        ? { erro: `${modulo.nome} faz parte do plano: é só ativar.` }
        : estadoAtual !== 'inativo'
          ? { erro: `${modulo.nome} já foi solicitado ou está ativo.` }
          : { estado: 'solicitado' },
    cancelar_solicitacao: () =>
      estadoAtual !== 'solicitado'
        ? { erro: 'Não há solicitação em andamento.' }
        : { estado: 'inativo' },
    confirmar_contratacao: () =>
      estadoAtual !== 'solicitado'
        ? { erro: 'A contratação só pode ser confirmada depois de solicitada.' }
        : { estado: 'ativo' },
  };
  return tabela[acao]?.() ?? { erro: 'Ação desconhecida.' };
}
