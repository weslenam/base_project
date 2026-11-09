// Rótulos e estados visuais do Business Center (o selo nunca é só cor).
export const SELOS = Object.freeze({
  nova: { rotulo: 'Nova', estado: 'assinante' },
  ativa: { rotulo: 'Ativa', estado: 'confirmado' },
  parada: { rotulo: 'Parada', estado: 'pendente' },
  suspensa: { rotulo: 'Suspensa', estado: 'faltou' },
});

export const ESTADOS_DE_MODULO = Object.freeze({
  ativo: { rotulo: 'Ativo', estado: 'confirmado' },
  solicitado: { rotulo: 'Solicitado', estado: 'pendente' },
  inativo: { rotulo: 'Inativo', estado: 'neutro' },
});

export const ACOES_DE_AUDITORIA = Object.freeze({
  entrar: 'Entrou',
  ver_painel: 'Abriu o painel',
  modulo_confirmar_contratacao: 'Confirmou contratação de módulo',
  modulo_ativar: 'Ativou módulo',
  modulo_desativar: 'Desativou módulo',
  suspender: 'Suspendeu a barbearia',
  reativar: 'Reativou a barbearia',
  transferir_dono: 'Transferiu o Dono',
});
