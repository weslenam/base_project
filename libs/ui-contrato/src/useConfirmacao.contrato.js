import { it, expect } from 'vitest';
import { h } from 'vue';
import { botaoPorTexto, esperar, textoDoDocumento } from './apoio.js';

export function testarUseConfirmacao({ DsApp, useConfirmacao }, montar) {
  function preparar() {
    let confirmar;
    const Tela = {
      setup: () => ((confirmar = useConfirmacao()), () => h('div')),
    };
    montar(DsApp, { slots: { default: () => h(Tela) } });
    return confirmar;
  }

  it('mostra a mensagem e resolve true ao confirmar', async () => {
    const resposta = preparar()('Excluir o agendamento?');
    await esperar(() =>
      expect(textoDoDocumento()).toContain('Excluir o agendamento?'),
    );
    botaoPorTexto('Confirmar').click();
    await expect(resposta).resolves.toBe(true);
  });

  it('resolve false ao cancelar', async () => {
    const resposta = preparar()('Descartar alterações?');
    await esperar(() => expect(botaoPorTexto('Cancelar')).toBeTruthy());
    botaoPorTexto('Cancelar').click();
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
    botaoPorTexto('Remover').click();
    await expect(resposta).resolves.toBe(true);
  });
}
