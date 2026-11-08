// Catálogo fechado de permissões (ADR 0010). Front e API usam este mesmo catálogo.

export const PERMISSOES = Object.freeze([
  {
    chave: 'agenda.ver_propria',
    grupo: 'Agenda',
    descricao: 'Ver a própria agenda',
  },
  {
    chave: 'agenda.ver',
    grupo: 'Agenda',
    descricao: 'Ver a agenda de todos os barbeiros',
  },
  {
    chave: 'agenda.gerenciar',
    grupo: 'Agenda',
    descricao: 'Marcar, alterar e cancelar agendamentos e bloqueios',
  },
  {
    chave: 'clientes.ver',
    grupo: 'Clientes',
    descricao: 'Ver clientes e histórico',
  },
  {
    chave: 'clientes.editar',
    grupo: 'Clientes',
    descricao: 'Cadastrar e editar clientes',
  },
  {
    chave: 'clientes.excluir',
    grupo: 'Clientes',
    descricao: 'Excluir clientes',
  },
  {
    chave: 'caixa.operar',
    grupo: 'Caixa',
    descricao: 'Abrir o caixa, lançar e receber comandas',
  },
  { chave: 'caixa.fechar', grupo: 'Caixa', descricao: 'Fechar o caixa do dia' },
  {
    chave: 'catalogo.gerenciar',
    grupo: 'Cadastros',
    descricao: 'Gerenciar serviços e produtos',
  },
  {
    chave: 'equipe.gerenciar',
    grupo: 'Cadastros',
    descricao: 'Gerenciar barbeiros, expediente e comissão',
  },
  {
    chave: 'relatorios.ver',
    grupo: 'Relatórios',
    descricao: 'Ver relatórios e faturamento',
  },
  {
    chave: 'barbearia.configurar',
    grupo: 'Administração',
    descricao: 'Editar dados, horário de funcionamento e regras da barbearia',
  },
  {
    chave: 'usuarios.gerenciar',
    grupo: 'Administração',
    descricao: 'Convidar e remover usuários',
  },
  {
    chave: 'papeis.gerenciar',
    grupo: 'Administração',
    descricao: 'Criar e editar papéis e permissões',
  },
  {
    chave: 'modulos.gerenciar',
    grupo: 'Administração',
    descricao: 'Ativar módulos e solicitar serviços adicionais',
  },
  {
    chave: 'fidelidade.gerenciar',
    grupo: 'Fidelidade',
    descricao: 'Configurar selos e cashback',
    modulo: 'fidelidade',
  },
  {
    chave: 'pacotes.gerenciar',
    grupo: 'Pacotes',
    descricao: 'Montar pacotes de serviços',
    modulo: 'pacotes',
  },
  {
    chave: 'pacotes.vender',
    grupo: 'Pacotes',
    descricao: 'Vender pacotes e usá-los no balcão',
    modulo: 'pacotes',
  },
  {
    chave: 'pagamentos.operar',
    grupo: 'Pagamento online',
    descricao: 'Gerar cobranças online e acompanhar pagamentos',
    modulo: 'pagamentos_online',
  },
]);

export const CHAVES_DE_PERMISSAO = Object.freeze(
  PERMISSOES.map((p) => p.chave),
);

const ADMINISTRACAO = [
  'barbearia.configurar',
  'usuarios.gerenciar',
  'papeis.gerenciar',
  'modulos.gerenciar',
];

/** Papéis criados com toda barbearia nova. O Dono é protegido (não edita nem exclui). */
export const PAPEIS_PADRAO = Object.freeze([
  {
    chave: 'dono',
    nome: 'Dono',
    protegido: true,
    permissoes: [...CHAVES_DE_PERMISSAO],
  },
  {
    chave: 'gerente',
    nome: 'Gerente',
    protegido: false,
    permissoes: CHAVES_DE_PERMISSAO.filter((p) => !ADMINISTRACAO.includes(p)),
  },
  {
    chave: 'recepcao',
    nome: 'Recepção',
    protegido: false,
    permissoes: [
      'agenda.ver',
      'agenda.gerenciar',
      'clientes.ver',
      'clientes.editar',
      'caixa.operar',
      'pacotes.vender',
    ],
  },
  {
    chave: 'barbeiro',
    nome: 'Barbeiro',
    protegido: false,
    permissoes: ['agenda.ver_propria'],
  },
]);

/** Permissões fora do catálogo (para recusar com 400). */
export const permissoesInvalidas = (lista = []) =>
  lista.filter((p) => !CHAVES_DE_PERMISSAO.includes(p));

/**
 * Permissões que valem de fato: as do papel, menos as que dependem de
 * módulo inativo na barbearia.
 */
export function permissoesEfetivas(doPapel = [], modulosAtivos = []) {
  return doPapel.filter((chave) => {
    const p = PERMISSOES.find((x) => x.chave === chave);
    return p && (!p.modulo || modulosAtivos.includes(p.modulo));
  });
}

/**
 * Ninguém concede o que não tem (ADR 0010): devolve as permissões de `alvo`
 * (papel a dar, papel de quem se quer alterar, permissões de um papel a editar)
 * que `deQuemAge` não possui. Vazio: pode. Assim, quem só administra usuários
 * não se torna Dono nem assume a conta de quem tem mais acesso que ele; o Dono,
 * que tem todas, pode tudo.
 */
export const permissoesAlemDasSuas = (deQuemAge = [], alvo = []) =>
  [...new Set(alvo)].filter((p) => !deQuemAge.includes(p));

/** Permissões agrupadas para montar telas (ex.: checklist de papéis). */
export function permissoesPorGrupo() {
  const grupos = new Map();
  for (const p of PERMISSOES) {
    if (!grupos.has(p.grupo)) grupos.set(p.grupo, []);
    grupos.get(p.grupo).push(p);
  }
  return [...grupos].map(([grupo, permissoes]) => ({ grupo, permissoes }));
}
