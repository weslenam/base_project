import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import type { NomeDoIcone } from '@barbertime/ui';

declare module 'vue-router' {
  interface RouteMeta {
    /** Rota sem login. */
    publica?: boolean;
    /** Item do menu lateral. */
    menu?: { titulo: string; icone: NomeDoIcone };
  }
}
import { carregarOperador } from '../sessao/operador.ts';

export const rotas: RouteRecordRaw[] = [
  {
    path: '/entrar',
    name: 'entrar',
    component: () => import('../telas/EntrarView.vue'),
    meta: { publica: true },
  },
  { path: '/', redirect: '/barbearias' },
  {
    path: '/barbearias',
    name: 'barbearias',
    component: () => import('../telas/BarbeariasView.vue'),
    meta: { menu: { titulo: 'Barbearias', icone: 'barbearia' } },
  },
  {
    path: '/barbearias/:id(\\d+)',
    name: 'barbearia',
    component: () => import('../telas/BarbeariaView.vue'),
    props: (r) => ({ id: Number(r.params.id) }),
  },
  { path: '/:caminho(.*)*', redirect: '/barbearias' },
];

const router = createRouter({ history: createWebHistory(), routes: rotas });

// Só operador logado passa; a API confere de novo em toda requisição.
router.beforeEach(async (to) => {
  if (to.meta.publica) return true;
  if (await carregarOperador()) return true;
  return { name: 'entrar', query: { volta: to.fullPath } };
});

export default router;
