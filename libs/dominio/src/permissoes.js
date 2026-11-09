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
    chave: 'agenda.ajudar',
    grupo: 'Agenda',
    descricao:
      'Marcar e bloquear horários; mexer só no que marcou e no próprio atendimento',
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
  {
    chave: 'caixa.abrir',
    grupo: 'Caixa',
    descricao: 'Abrir o caixa do dia (troco inicial)',
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
    chave: 'estoque.ver',
    grupo: 'Estoque e compras',
    descricao: 'Ver saldos, movimentos e compras',
    modulo: 'estoque',
  },
  {
    chave: 'estoque.gerenciar',
    grupo: 'Estoque e compras',
    descricao:
      'Registrar consumo, inventário, fornecedores, compras e ficha técnica',
    modulo: 'estoque',
  },
  {
    chave: 'financeiro.gerenciar',
    grupo: 'Financeiro',
    descricao: 'Contas a pagar e a receber, recorrências e previsão',
    modulo: 'financeiro',
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
      'caixa.abrir',
      'pacotes.vender',
      'estoque.ver',
    ],
  },
  {
    chave: 'barbeiro',
    nome: 'Barbeiro',
    nivel: 4,
    protegido: true,
    // Sem menu lateral: abas Balcão e Agenda (planejamentos 0035 e 0036).
    semMenu: true,
    permissoes: [
      'agenda.ver',
      'agenda.ajudar',
      'clientes.ver',
      'clientes.editar',
      'caixa.operar',
    ],
  },
]);

/** Pode marcar agendamentos e bloquear horários (em qualquer coluna)? */
export const podeMarcarNaAgenda = (permissoes = []) =>
  permissoes.includes('agenda.gerenciar') ||
  permissoes.includes('agenda.ajudar');

/**
 * Pode levar este item da agenda para `estado` (confirmado, atendido, faltou,
 * cancelado)? Planejamento 0035. Com `agenda.gerenciar`, sempre. Com
 * `agenda.ajudar`: confirmar, cancelar e remover bloqueio só no que a pessoa
 * criou; faltou também nos atendimentos em que ela é o barbeiro; atendido só
 * nos próprios atendimentos, como "finalizar" no Balcão (planejamento 0037).
 * Se a transição em si é válida, quem decide é o ciclo do atendimento.
 *
 * @param {{ usuarioId: number, permissoes: string[] }} quem
 * @param {{ bloqueio?: boolean, criadoPor?: number|null, barbeiroUsuarioId?: number|null }} item
 */
export function podeAgirNaAgenda(quem, item, estado) {
  const permissoes = quem?.permissoes ?? [];
  if (permissoes.includes('agenda.gerenciar')) return true;
  if (!permissoes.includes('agenda.ajudar') || quem.usuarioId == null)
    return false;
  const criou = item?.criadoPor != null && item.criadoPor === quem.usuarioId;
  if (item?.bloqueio) return criou;
  if (estado === 'confirmado' || estado === 'cancelado') return criou;
  const naColuna =
    item?.barbeiroUsuarioId != null &&
    item.barbeiroUsuarioId === quem.usuarioId;
  if (estado === 'atendido') return naColuna;
  if (estado === 'faltou') return criou || naColuna;
  return false;
}

/**
 * Pode fazer `acao` no Balcão (planejamento 0036)? Com `agenda.gerenciar`,
 * tudo. Só com `caixa.operar` (Barbeiro): ver, check-in, avulso e receber em
 * qualquer atendimento; iniciar só consigo, e só o que já é dele ou avulso sem
 * barbeiro ("Primeiro livre", planejamento 0037); finalizar e pausa só os
 * próprios; desistência e falta na própria coluna ou no que criou.
 *
 * @param {{ usuarioId: number, permissoes: string[] }} quem
 * @param {'ver'|'checkin'|'avulso'|'receber'|'iniciar'|'finalizar'|'desistir'|'no_show'|'pausa'} acao
 * @param {{ barbeiroId?: number|null, barbeiroUsuarioId?: number|null, criadoPor?: number|null, destinoUsuarioId?: number|null }} alvo
 *   barbeiroId/barbeiroUsuarioId: barbeiro atual do atendimento (null = sem
 *   barbeiro); destinoUsuarioId: conta de quem vai atender (iniciar).
 */
export function podeAgirNoBalcao(quem, acao, alvo = {}) {
  const permissoes = quem?.permissoes ?? [];
  if (permissoes.includes('agenda.gerenciar')) return true;
  if (!permissoes.includes('caixa.operar') || quem.usuarioId == null)
    return false;
  const eu = (id) => id != null && id === quem.usuarioId;
  switch (acao) {
    case 'ver':
    case 'checkin':
    case 'avulso':
    case 'receber':
      return true;
    case 'iniciar':
      return (
        eu(alvo.destinoUsuarioId) &&
        (alvo.barbeiroId == null || eu(alvo.barbeiroUsuarioId))
      );
    case 'finalizar':
    case 'pausa':
      return eu(alvo.barbeiroUsuarioId);
    case 'desistir':
    case 'no_show':
      return eu(alvo.barbeiroUsuarioId) || eu(alvo.criadoPor);
    default:
      return false;
  }
}

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

/** O papel usa o app sem menu (só a Agenda e o Perfil)? */
export const papelSemMenu = (chave) => Boolean(papelFixo(chave)?.semMenu);

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
