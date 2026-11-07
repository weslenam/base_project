import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'inicio', component: HomeView },
    {
      path: '/componentes',
      name: 'componentes',
      component: () => import('../views/ComponentesView.vue'),
    },
  ],
});

export default router;
