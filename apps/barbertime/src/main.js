import '@barbertime/ui-tokens';
import { createApp } from 'vue';
import { instalarUi } from '@barbertime/ui';
import App from './app/App.vue';
import router from './router';

const app = createApp(App);
instalarUi(app);
app.use(router);
app.mount('#root');
