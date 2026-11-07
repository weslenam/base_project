import { it, expect } from 'vitest';
import { h } from 'vue';
import { botaoPorTexto, esperar, textoDoDocumento } from './apoio.js';

export function testarUseDialogo({ DsApp, useDialogo }, montar) {
  function preparar() {
    let api;
    const Tela = { setup: () => ((api = useDialogo()), () => h('div')) };
    montar(DsApp, { slots: { default: () => h(Tela) } });
    return api;
  }

  it('confirmar: título "Confirmação", Confirmar → true', async () => {
    const resposta = preparar().confirmar('Salvar alterações?');
    await esperar(() => expect(textoDoDocumento()).toContain('Confirmação'));
    expect(textoDoDocumento()).toContain('Salvar alterações?');
    botaoPorTexto('Confirmar').click();
    await expect(resposta).resolves.toBe(true);
  });

  it('confirmar: Cancelar → false', async () => {
    const resposta = preparar().confirmar('Salvar?');
    await esperar(() => expect(botaoPorTexto('Cancelar')).toBeTruthy());
    botaoPorTexto('Cancelar').click();
    await expect(resposta).resolves.toBe(false);
  });

  it('advertir: título "Atenção", Continuar → true', async () => {
    const resposta = preparar().advertir(
      'Fora do expediente. Marcar mesmo assim?',
    );
    await esperar(() => expect(textoDoDocumento()).toContain('Atenção'));
    expect(textoDoDocumento()).toContain('Fora do expediente');
    botaoPorTexto('Continuar').click();
    await expect(resposta).resolves.toBe(true);
  });

  it('advertir: Voltar → false', async () => {
    const resposta = preparar().advertir('Cliente com faltas recentes.');
    await esperar(() => expect(botaoPorTexto('Voltar')).toBeTruthy());
    botaoPorTexto('Voltar').click();
    await expect(resposta).resolves.toBe(false);
  });

  it('negar: título "Não foi possível", só o botão Entendi, resolve undefined', async () => {
    const resposta = preparar().negar('Esse horário acabou de ser ocupado.');
    await esperar(() =>
      expect(textoDoDocumento()).toContain('Não foi possível'),
    );
    expect(botaoPorTexto('Cancelar')).toBeUndefined();
    expect(botaoPorTexto('Voltar')).toBeUndefined();
    botaoPorTexto('Entendi').click();
    await expect(resposta).resolves.toBeUndefined();
  });

  it('aceita título e textos próprios', async () => {
    const resposta = preparar().confirmar('Excluir o cliente?', {
      titulo: 'Excluir cliente',
      textoOk: 'Excluir',
      textoCancelar: 'Manter',
      perigo: true,
    });
    await esperar(() =>
      expect(textoDoDocumento()).toContain('Excluir cliente'),
    );
    expect(botaoPorTexto('Manter')).toBeTruthy();
    botaoPorTexto('Excluir').click();
    await expect(resposta).resolves.toBe(true);
  });

  it('enfileira: o segundo diálogo aparece depois que o primeiro é respondido', async () => {
    const api = preparar();
    const primeira = api.confirmar('Primeira?');
    const segunda = api.negar('Segunda.');
    await esperar(() => expect(textoDoDocumento()).toContain('Primeira?'));
    botaoPorTexto('Confirmar').click();
    await expect(primeira).resolves.toBe(true);
    await esperar(() => expect(textoDoDocumento()).toContain('Segunda.'));
    botaoPorTexto('Entendi').click();
    await expect(segunda).resolves.toBeUndefined();
  });

  it('desmontar o DsApp descarta diálogos pendentes (respondem como cancelar)', async () => {
    let api;
    const Tela = { setup: () => ((api = useDialogo()), () => h('div')) };
    const w = montar(DsApp, { slots: { default: () => h(Tela) } });
    const pergunta = api.confirmar('Fica pendente?');
    const recusa = api.negar('Também pendente.');
    w.unmount();
    await expect(pergunta).resolves.toBe(false);
    await expect(recusa).resolves.toBeUndefined();
  });
}
