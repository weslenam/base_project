import { createRouter, createWebHistory } from 'vue-router';
import type { RouteMeta, RouteRecordRaw } from 'vue-router';
import type { NomeDoIcone } from '@barbertime/ui';
import {
  ROTAS_SEM_MENU,
  carregarSessao,
  moduloAtivo,
  podeAlguma,
  semMenu,
  sessaoCarregada,
  temSessao,
} from '../sessao/sessao.ts';

/**
 * Rotas. meta:
 *  - publica: página do cliente final, sem login e sem menu
 *  - semLayout: entrar e cadastro (sem login, sem menu)
 *  - permissoes: basta uma delas (ADR 0010); modulo: precisa estar ativo (ADR 0011)
 *  - menu: { titulo, icone, grupo } para aparecer no menu lateral (grupo vira subtítulo)
 */
declare module 'vue-router' {
  interface RouteMeta {
    publica?: boolean;
    semLayout?: boolean;
    permissoes?: string[];
    modulo?: string;
    menu?: { titulo: string; icone: NomeDoIcone; grupo?: string };
  }
}

export const rotas: RouteRecordRaw[] = [
  { path: '/', redirect: '/agenda' },
  {
    // Balcão (planejamento 0020): avulso + agendado, fila e encaixe.
    path: '/balcao',
    component: () => import('../telas/balcao/BalcaoView.vue'),
    meta: {
      permissoes: ['agenda.gerenciar', 'caixa.operar'],
      menu: { titulo: 'Balcão', icone: 'fila', grupo: 'Operação' },
    },
  },
  {
    path: '/agenda',
    component: () => import('../telas/agenda/AgendaView.vue'),
    meta: {
      permissoes: ['agenda.ver', 'agenda.ver_propria'],
      menu: { titulo: 'Agenda', icone: 'agenda', grupo: 'Operação' },
    },
  },
  {
    path: '/caixa',
    component: () => import('../telas/caixa/CaixaView.vue'),
    meta: {
      permissoes: ['caixa.operar'],
      menu: { titulo: 'Caixa', icone: 'caixa', grupo: 'Operação' },
    },
  },
  {
    path: '/clientes',
    component: () => import('../telas/clientes/ClientesView.vue'),
    meta: {
      permissoes: ['clientes.ver'],
      menu: { titulo: 'Clientes', icone: 'clientes', grupo: 'Operação' },
    },
  },
  {
    path: '/equipe',
    component: () => import('../telas/equipe/EquipeView.vue'),
    meta: {
      permissoes: ['equipe.gerenciar'],
      menu: { titulo: 'Equipe', icone: 'equipe', grupo: 'Cadastros' },
    },
  },
  {
    path: '/servicos',
    component: () => import('../telas/servicos/ServicosView.vue'),
    meta: {
      permissoes: ['catalogo.gerenciar'],
      menu: { titulo: 'Serviços', icone: 'servico', grupo: 'Cadastros' },
    },
  },
  {
    path: '/produtos',
    component: () => import('../telas/produtos/ProdutosView.vue'),
    meta: {
      permissoes: ['catalogo.gerenciar'],
      menu: { titulo: 'Produtos', icone: 'produto', grupo: 'Cadastros' },
    },
  },
  {
    path: '/pacotes',
    component: () => import('../telas/pacotes/PacotesView.vue'),
    meta: {
      permissoes: ['pacotes.gerenciar'],
      modulo: 'pacotes',
      menu: { titulo: 'Pacotes', icone: 'assinante', grupo: 'Cadastros' },
    },
  },
  {
    path: '/fidelidade',
    component: () => import('../telas/fidelidade/FidelidadeView.vue'),
    meta: {
      permissoes: ['fidelidade.gerenciar'],
      modulo: 'fidelidade',
      menu: { titulo: 'Fidelidade', icone: 'fidelidade', grupo: 'Cadastros' },
    },
  },
  // Estoque e compras (planejamento 0027, parte 1): só com o módulo "estoque".
  {
    path: '/estoque',
    component: () => import('../telas/estoque/EstoqueView.vue'),
    meta: {
      permissoes: ['estoque.ver'],
      modulo: 'estoque',
      menu: { titulo: 'Estoque', icone: 'estoque', grupo: 'Estoque' },
    },
  },
  {
    path: '/compras',
    component: () => import('../telas/estoque/ComprasView.vue'),
    meta: {
      permissoes: ['estoque.ver'],
      modulo: 'estoque',
      menu: { titulo: 'Compras', icone: 'compras', grupo: 'Estoque' },
    },
  },
  {
    path: '/fornecedores',
    component: () => import('../telas/estoque/FornecedoresView.vue'),
    meta: {
      permissoes: ['estoque.ver'],
      modulo: 'estoque',
      menu: { titulo: 'Fornecedores', icone: 'fornecedor', grupo: 'Estoque' },
    },
  },
  // Financeiro (planejamento 0027, parte 2): só com o módulo "financeiro".
  {
    path: '/financeiro/contas',
    component: () => import('../telas/financeiro/ContasView.vue'),
    meta: {
      permissoes: ['financeiro.gerenciar'],
      modulo: 'financeiro',
      menu: { titulo: 'Contas', icone: 'financeiro', grupo: 'Financeiro' },
    },
  },
  {
    path: '/financeiro/cadastros',
    component: () => import('../telas/financeiro/CadastrosView.vue'),
    meta: {
      permissoes: ['financeiro.gerenciar'],
      modulo: 'financeiro',
      menu: { titulo: 'Cadastros', icone: 'categoria', grupo: 'Financeiro' },
    },
  },
  {
    path: '/financeiro/previsao',
    component: () => import('../telas/financeiro/PrevisaoView.vue'),
    meta: {
      permissoes: ['financeiro.gerenciar'],
      modulo: 'financeiro',
      menu: { titulo: 'Previsão', icone: 'relatorios', grupo: 'Financeiro' },
    },
  },
  {
    path: '/financeiro/comissao',
    component: () => import('../telas/financeiro/ComissaoView.vue'),
    meta: {
      permissoes: ['financeiro.gerenciar'],
      modulo: 'comissoes',
      menu: { titulo: 'Comissões', icone: 'financeiro', grupo: 'Financeiro' },
    },
  },
  {
    path: '/configuracoes',
    component: () => import('../telas/administracao/ConfiguracoesView.vue'),
    meta: {
      permissoes: ['barbearia.configurar'],
      menu: {
        titulo: 'Configurações',
        icone: 'configuracoes',
        grupo: 'Administração',
      },
    },
  },
  {
    path: '/usuarios',
    component: () => import('../telas/administracao/UsuariosView.vue'),
    meta: {
      permissoes: ['usuarios.gerenciar'],
      menu: { titulo: 'Usuários', icone: 'cliente', grupo: 'Administração' },
    },
  },
  {
    path: '/papeis',
    component: () => import('../telas/administracao/PapeisView.vue'),
    meta: {
      permissoes: ['usuarios.gerenciar'],
      menu: {
        titulo: 'Papéis',
        icone: 'permissoes',
        grupo: 'Administração',
      },
    },
  },
  {
    path: '/modulos',
    component: () => import('../telas/administracao/ModulosView.vue'),
    meta: {
      menu: { titulo: 'Módulos', icone: 'componentes', grupo: 'Administração' },
    },
  },
  // Vitrine do kit de UI: ferramenta de quem desenvolve. Fora do menu e só
  // existe no modo de desenvolvimento (não vai para o build de produção).
  ...(import.meta.env.DEV
    ? [
        {
          path: '/componentes',
          component: () => import('../views/ComponentesView.vue'),
        },
      ]
    : []),
  {
    // Qualquer usuário logado: nome, senha e barbearias (planejamento 0017).
    path: '/perfil',
    component: () => import('../telas/acesso/PerfilView.vue'),
  },
  {
    path: '/sem-acesso',
    name: 'sem-acesso',
    component: () => import('../telas/administracao/SemAcessoView.vue'),
  },
  {
    path: '/entrar',
    name: 'entrar',
    meta: { semLayout: true },
    component: () => import('../telas/acesso/EntrarView.vue'),
  },
  {
    path: '/cadastro',
    name: 'cadastro',
    meta: { semLayout: true },
    component: () => import('../telas/acesso/CadastroView.vue'),
  },
  {
    // Esqueci a senha (planejamento 0023): ninguém troca a senha de outra pessoa.
    path: '/esqueci-senha',
    name: 'esqueci-senha',
    meta: { semLayout: true },
    component: () => import('../telas/acesso/EsqueciSenhaView.vue'),
  },
  {
    // O token vem no fragmento do link (#t=...), que não vai ao servidor.
    path: '/redefinir-senha',
    name: 'redefinir-senha',
    meta: { semLayout: true },
    component: () => import('../telas/acesso/RedefinirSenhaView.vue'),
  },
  {
    // Página pública do cliente final: sem login e sem menu interno.
    path: '/agendar/:slug',
    name: 'agendar',
    meta: { publica: true },
    component: () => import('../telas/publico/AgendamentoPublicoView.vue'),
  },
];

/** A rota é permitida para a sessão atual? (usado no guarda e no menu) */
export function rotaPermitida(meta: RouteMeta = {}): boolean {
  if (meta.permissoes?.length && !podeAlguma(...meta.permissoes)) return false;
  if (meta.modulo && !moduloAtivo(meta.modulo)) return false;
  return true;
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: rotas,
});

router.beforeEach(async (to) => {
  if (to.meta.publica || to.meta.semLayout) return true;
  if (!sessaoCarregada()) await carregarSessao();
  if (!temSessao()) return { name: 'entrar', query: { volta: to.fullPath } };
  // Papel sem menu (Barbeiro): abas Balcão e Agenda, mais o Perfil; entra
  // pelo Balcão (planejamentos 0035 e 0036).
  if (semMenu()) {
    // '/' redireciona para a Agenda; para o Barbeiro, a inicial é o Balcão.
    if (to.path === '/agenda' && to.redirectedFrom?.path === '/')
      return '/balcao';
    if (!ROTAS_SEM_MENU.includes(to.path)) return '/balcao';
  }
  if (!rotaPermitida(to.meta))
    return { name: 'sem-acesso', query: { de: to.fullPath } };
  return true;
});

export default router;
