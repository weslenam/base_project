import { it, expect } from 'vitest';
import { h } from 'vue';
import {
  botaoPorTexto,
  clicarBotao,
  esperar,
  exigir,
  textoDoDocumento,
} from './apoio.ts';
import type { Component } from 'vue';
import type { ApiDeDialogo, Montar } from './apoio.ts';

export function testarUseConfirmacao(
  {
    DsApp,
    useConfirmacao,
  }: { DsApp: Component; useConfirmacao: () => ApiDeDialogo['confirmar'] },
  montar: Montar,
) {
  function preparar() {
    let confirmar: ApiDeDialogo['confirmar'] | undefined;
    const Tela = {
      setup: () => ((confirmar = useConfirmacao()), () => h('div')),
    };
    montar(DsApp, { slots: { default: () => h(Tela) } });
    return exigir(confirmar, 'useConfirmacao');
  }

  it('mostra a mensagem e resolve true ao confirmar', async () => {
    const resposta = preparar()('Excluir o agendamento?');
    await esperar(() =>
      expect(textoDoDocumento()).toContain('Excluir o agendamento?'),
    );
    clicarBotao('Confirmar');
    await expect(resposta).resolves.toBe(true);
  });

  it('resolve false ao cancelar', async () => {
    const resposta = preparar()('Descartar alterações?');
    await esperar(() => expect(botaoPorTexto('Cancelar')).toBeTruthy());
    clicarBotao('Cancelar');
    await expect(resposta).resolves.toBe(false);
  });

  it('aceita título e textos dos botões', async () => {
    const resposta = preparar()('Remover?', {
      titulo: 'Atenção',
      textoOk: 'Remover',
      textoCancelar: 'Voltar',
    });
    await esperar(() => {
      expect(textoDoDocumento()).toContain('Atenção');
      expect(botaoPorTexto('Voltar')).toBeTruthy();
    });
    clicarBotao('Remover');
    await expect(resposta).resolves.toBe(true);
  });
}
