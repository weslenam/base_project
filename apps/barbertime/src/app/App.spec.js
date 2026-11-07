import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import router from '../router';
import App from './App.vue';

describe('App', () => {
  it('renderiza a tela inicial', async () => {
    router.push('/');
    await router.isReady();
    const wrapper = mount(App, { global: { plugins: [router] } });
    expect(wrapper.text()).toContain('BarberTime');
  });
});
