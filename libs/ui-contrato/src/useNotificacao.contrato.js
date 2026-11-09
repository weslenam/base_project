import { it, expect } from 'vitest';
import { h } from 'vue';
import { esperar, textoDoDocumento } from './apoio.js';

export function testarUseNotificacao({ DsApp, useNotificacao }, montar) {
  it.each(['sucesso', 'erro', 'aviso', 'info'])(
    '%s mostra a mensagem',
    async (tipo) => {
      let notificar;
      const Tela = {
        setup: () => ((notificar = useNotificacao()), () => h('div')),
      };
      montar(DsApp, { slots: { default: () => h(Tela) } });
      notificar[tipo](`Mensagem de ${tipo}`);
      await esperar(() =>
        expect(textoDoDocumento()).toContain(`Mensagem de ${tipo}`),
      );
    },
  );
}
