import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/agenda' },
    {
      path: '/agenda',
      name: 'agenda',
      component: () => import('../telas/agenda/AgendaView.vue'),
    },
    {
      path: '/clientes',
      name: 'clientes',
      component: () => import('../telas/clientes/ClientesView.vue'),
    },
    {
      path: '/servicos',
      name: 'servicos',
      component: () => import('../telas/servicos/ServicosEquipeView.vue'),
    },
    {
      path: '/componentes',
      name: 'componentes',
      component: () => import('../views/ComponentesView.vue'),
    },
    {
      // Página pública do cliente final: sem menu interno.
      path: '/agendar/:slug',
      name: 'agendar',
      meta: { publica: true },
      component: () => import('../telas/publico/AgendamentoPublicoView.vue'),
    },
  ],
});

export default router;
