import { it, expect } from 'vitest';
import { h } from 'vue';
import { esperar, exigir, textoDoDocumento } from './apoio.ts';
import type { Component } from 'vue';
import type { ApiDeNotificacao, Montar } from './apoio.ts';

export function testarUseNotificacao(
  {
    DsApp,
    useNotificacao,
  }: { DsApp: Component; useNotificacao: () => ApiDeNotificacao },
  montar: Montar,
) {
  it.each(['sucesso', 'erro', 'aviso', 'info'] as const)(
    '%s mostra a mensagem',
    async (tipo) => {
      let notificar: ApiDeNotificacao | undefined;
      const Tela = {
        setup: () => ((notificar = useNotificacao()), () => h('div')),
      };
      montar(DsApp, { slots: { default: () => h(Tela) } });
      exigir(notificar, 'useNotificacao')[tipo](`Mensagem de ${tipo}`);
      await esperar(() =>
        expect(textoDoDocumento()).toContain(`Mensagem de ${tipo}`),
      );
    },
  );
}
