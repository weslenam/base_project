import { createRouter, createWebHistory } from 'vue-router';
import {
  carregarSessao,
  moduloAtivo,
  podeAlguma,
  sessaoCarregada,
  temSessao,
} from '../sessao/sessao.js';

/**
 * Rotas. meta:
 *  - publica: página do cliente final, sem login e sem menu
 *  - semLayout: entrar e cadastro (sem login, sem menu)
 *  - permissoes: basta uma delas (ADR 0010); modulo: precisa estar ativo (ADR 0011)
 *  - menu: { titulo, icone, grupo } para aparecer no menu lateral
 */
export const rotas = [
  { path: '/', redirect: '/agenda' },
  {
    path: '/agenda',
    component: () => import('../telas/agenda/AgendaView.vue'),
    meta: {
      permissoes: ['agenda.ver', 'agenda.ver_propria'],
      menu: { titulo: 'Agenda', icone: 'agenda' },
    },
  },
  {
    path: '/caixa',
    component: () => import('../telas/caixa/CaixaView.vue'),
    meta: {
      permissoes: ['caixa.operar'],
      menu: { titulo: 'Caixa', icone: 'caixa' },
    },
  },
  {
    path: '/clientes',
    component: () => import('../telas/clientes/ClientesView.vue'),
    meta: {
      permissoes: ['clientes.ver'],
      menu: { titulo: 'Clientes', icone: 'clientes' },
    },
  },
  {
    path: '/equipe',
    component: () => import('../telas/equipe/EquipeView.vue'),
    meta: {
      permissoes: ['equipe.gerenciar'],
      menu: { titulo: 'Equipe', icone: 'equipe' },
    },
  },
  {
    path: '/servicos',
    component: () => import('../telas/servicos/ServicosView.vue'),
    meta: {
      permissoes: ['catalogo.gerenciar'],
      menu: { titulo: 'Serviços', icone: 'servico' },
    },
  },
  {
    path: '/produtos',
    component: () => import('../telas/produtos/ProdutosView.vue'),
    meta: {
      permissoes: ['catalogo.gerenciar'],
      menu: { titulo: 'Produtos', icone: 'produto' },
    },
  },
  {
    path: '/usuarios',
    component: () => import('../telas/administracao/UsuariosView.vue'),
    meta: {
      permissoes: ['usuarios.gerenciar'],
      menu: { titulo: 'Usuários', icone: 'cliente' },
    },
  },
  {
    path: '/papeis',
    component: () => import('../telas/administracao/PapeisView.vue'),
    meta: {
      permissoes: ['papeis.gerenciar'],
      menu: { titulo: 'Papéis e permissões', icone: 'bloqueio' },
    },
  },
  {
    path: '/modulos',
    component: () => import('../telas/administracao/ModulosView.vue'),
    meta: { menu: { titulo: 'Módulos', icone: 'componentes' } },
  },
  {
    path: '/componentes',
    component: () => import('../views/ComponentesView.vue'),
    meta: { menu: { titulo: 'Componentes', icone: 'componentes' } },
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
    // Página pública do cliente final: sem login e sem menu interno.
    path: '/agendar/:slug',
    name: 'agendar',
    meta: { publica: true },
    component: () => import('../telas/publico/AgendamentoPublicoView.vue'),
  },
];

/** A rota é permitida para a sessão atual? (usado no guarda e no menu) */
export function rotaPermitida(meta = {}) {
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
  if (!rotaPermitida(to.meta))
    return { name: 'sem-acesso', query: { de: to.fullPath } };
  return true;
});

export default router;
