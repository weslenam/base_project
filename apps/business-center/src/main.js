import '@barbertime/ui-tokens';
import { createApp } from 'vue';
import { instalarUi } from '@barbertime/ui';
import App from './app/App.vue';
import router from './router';
import { aoExpirarSessao } from './dados/http.js';
import { definirOperador } from './sessao/operador.js';

const app = createApp(App);
instalarUi(app);
app.use(router);
// Sessão de 8h sem renovação: um 401 fora da entrada leva de volta ao login.
aoExpirarSessao(() => {
  const atual = router.currentRoute.value;
  if (atual.meta.publica) return;
  definirOperador(null);
  router.push({ name: 'entrar', query: { volta: atual.fullPath } });
});
app.mount('#root');
