// Catálogo fechado de permissões e hierarquia fixa de papéis (ADR 0010).
// Front e API usam este mesmo catálogo; as permissões de cada papel vêm daqui,
// não do banco.

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
    descricao: 'Convidar, trocar o papel e remover quem está abaixo de você',
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

/** Só do Dono: configurar a barbearia e contratar módulos. */
const SO_DO_DONO = ['barbearia.configurar', 'modulos.gerenciar'];

/**
 * Os quatro papéis fixos, do nível 1 (topo) ao 4 (ADR 0010, planejamento 0023).
 * Não há papéis personalizados.
 */
export const PAPEIS_PADRAO = Object.freeze([
  {
    chave: 'dono',
    nome: 'Dono',
    nivel: 1,
    protegido: true,
    permissoes: [...CHAVES_DE_PERMISSAO],
  },
  {
    chave: 'gerente',
    nome: 'Gerente',
    nivel: 2,
    protegido: true,
    permissoes: CHAVES_DE_PERMISSAO.filter((p) => !SO_DO_DONO.includes(p)),
  },
  {
    chave: 'recepcao',
    nome: 'Recepção',
    nivel: 3,
    protegido: true,
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
    nivel: 4,
    protegido: true,
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

const papelFixo = (chave) => PAPEIS_PADRAO.find((p) => p.chave === chave);

/** Nível do papel (1 = Dono, 4 = Barbeiro). Chave desconhecida: null. */
export const nivelDoPapel = (chave) => papelFixo(chave)?.nivel ?? null;

/**
 * Permissões fixas do papel, pela chave (vazio se desconhecida). A API usa
 * isto, e não a coluna do banco: nem um dado adulterado dá acesso.
 */
export const permissoesDoPapel = (chave) => [
  ...(papelFixo(chave)?.permissoes ?? []),
];

/**
 * Hierarquia estrita (ADR 0010): só se age sobre quem está ABAIXO, nunca acima
 * nem na lateral. Vale para convidar, dar papel, trocar papel, desativar e
 * remover. Ninguém dá o papel Dono (não há nível acima de 1).
 */
export function podeAgirSobre(chaveDeQuemAge, chaveDoAlvo) {
  const eu = nivelDoPapel(chaveDeQuemAge);
  const alvo = nivelDoPapel(chaveDoAlvo);
  return eu !== null && alvo !== null && alvo > eu;
}

/** Papéis que quem tem `chave` pode dar (os de nível abaixo do seu). */
export const papeisAbaixoDe = (chave) =>
  PAPEIS_PADRAO.filter((p) => podeAgirSobre(chave, p.chave)).map(
    (p) => p.chave,
  );

/** Permissões agrupadas para montar telas (ex.: checklist de papéis). */
export function permissoesPorGrupo() {
  const grupos = new Map();
  for (const p of PERMISSOES) {
    if (!grupos.has(p.grupo)) grupos.set(p.grupo, []);
    grupos.get(p.grupo).push(p);
  }
  return [...grupos].map(([grupo, permissoes]) => ({ grupo, permissoes }));
}
