// Papéis contados como histórias (planejamento 0033): "o que eu vou poder fazer?".
// A interface mostra estas frases, nunca as chaves técnicas das permissões.
// "pode" sai das permissões efetivas do papel, então nunca promete o que a
// pessoa não vai conseguir fazer.
import {
  PAPEIS_PADRAO,
  PERMISSOES,
  permissoesDoPapel,
  permissoesEfetivas,
} from './permissoes.ts';

/** Cada permissão como ação do dia a dia, no infinitivo ("Vai poder: …"). */
export const ACOES_DAS_PERMISSOES: Readonly<Record<string, string>> =
  Object.freeze({
    'agenda.ver_propria': 'Ver a própria agenda e os clientes do dia',
    'agenda.ver': 'Ver a agenda de todos os barbeiros',
    'agenda.gerenciar':
      'Marcar, remarcar e cancelar horários, e receber quem chega na fila do balcão',
    'agenda.ajudar':
      'Ajudar na agenda: marcar e bloquear horários, e cancelar só o que você marcou',
    'clientes.ver': 'Consultar os clientes e o histórico de cada um',
    'clientes.editar': 'Cadastrar clientes e atualizar os dados',
    'clientes.excluir': 'Excluir clientes do cadastro',
    'caixa.operar': 'Lançar e receber as comandas',
    'caixa.abrir': 'Abrir o caixa do dia',
    'caixa.fechar': 'Fechar o caixa no fim do dia',
    'catalogo.gerenciar': 'Cuidar dos serviços, produtos e preços',
    'equipe.gerenciar': 'Cuidar da equipe: expediente e comissão dos barbeiros',
    'relatorios.ver': 'Acompanhar relatórios e o faturamento',
    'barbearia.configurar':
      'Configurar a barbearia: dados, horário de funcionamento e regras',
    'usuarios.gerenciar':
      'Convidar pessoas e ajustar o acesso de quem está abaixo na equipe',
    'modulos.gerenciar': 'Ativar módulos e contratar serviços adicionais',
    'fidelidade.gerenciar': 'Definir as regras de selos e cashback',
    'pacotes.gerenciar': 'Montar os pacotes de serviços',
    'pacotes.vender': 'Vender e renovar os pacotes dos clientes',
    'estoque.ver': 'Conferir o estoque e as compras',
    'estoque.gerenciar':
      'Registrar compras, consumo, inventário e fornecedores',
    'financeiro.gerenciar': 'Cuidar das contas a pagar e a receber',
    'pagamentos.operar': 'Gerar cobranças online e acompanhar os pagamentos',
  });

/**
 * Resumo de uma linha e limites escolhidos a dedo (até 4): o que mais faz
 * diferença saber que fica de fora, para a lista não virar um catálogo.
 */
const ROTEIROS: Readonly<
  Record<string, { resumo: string; limites: string[] }>
> = Object.freeze({
  dono: {
    resumo: 'Comanda tudo: a barbearia, a equipe, o dinheiro e os módulos',
    limites: [],
  },
  gerente: {
    resumo: 'Cuida da operação do dia a dia no lugar do Dono',
    limites: ['barbearia.configurar', 'modulos.gerenciar'],
  },
  recepcao: {
    resumo: 'Recebe os clientes, cuida da agenda e cobra no balcão',
    limites: [
      'caixa.fechar',
      'relatorios.ver',
      'catalogo.gerenciar',
      'equipe.gerenciar',
    ],
  },
  barbeiro: {
    resumo: 'Atende os clientes e ajuda a cuidar da agenda',
    limites: [
      'caixa.abrir',
      'caixa.fechar',
      'clientes.excluir',
      'relatorios.ver',
    ],
  },
});

const moduloAtivo = (chave: string, modulosAtivos: readonly string[]) => {
  const p = PERMISSOES.find((x) => x.chave === chave);
  return Boolean(p) && (!p?.modulo || modulosAtivos.includes(p.modulo));
};

/**
 * História do papel nesta barbearia: { chave, nome, resumo, pode, naoPode }.
 * Permissão de módulo inativo não entra em nenhuma das listas.
 * Papel desconhecido: null.
 */
export function historiaDoPapel(
  chave: string,
  modulosAtivos: readonly string[] = [],
): {
  chave: string;
  nome: string;
  resumo: string;
  pode: string[];
  naoPode: string[];
} | null {
  const papel = PAPEIS_PADRAO.find((p) => p.chave === chave);
  const roteiro = ROTEIROS[chave];
  if (!papel || !roteiro) return null;
  const doPapel = permissoesDoPapel(chave);
  // Quem vê a agenda de todos não precisa ler que vê a própria; quem gerencia
  // a agenda não precisa ler que ajuda nela.
  const efetivas = permissoesEfetivas(doPapel, modulosAtivos).filter(
    (p) =>
      !(p === 'agenda.ver_propria' && doPapel.includes('agenda.ver')) &&
      !(p === 'agenda.ajudar' && doPapel.includes('agenda.gerenciar')),
  );
  return {
    chave,
    nome: papel.nome,
    resumo: roteiro.resumo,
    // Toda permissão do catálogo tem frase (historias.spec confere).
    pode: efetivas.map((p) => ACOES_DAS_PERMISSOES[p] as string),
    naoPode: roteiro.limites
      .filter((p) => !doPapel.includes(p) && moduloAtivo(p, modulosAtivos))
      .map((p) => ACOES_DAS_PERMISSOES[p] as string),
  };
}

/** Resumo de uma linha do papel (cartões de escolha). */
export const resumoDoPapel = (chave: string): string =>
  ROTEIROS[chave]?.resumo ?? '';
