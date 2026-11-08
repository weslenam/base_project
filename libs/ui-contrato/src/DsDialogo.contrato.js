import { it, expect } from 'vitest';
import { esperar, textoDoDocumento } from './apoio.js';

export function testarDsDialogo(DsDialogo, montar) {
  it('aberto mostra título, conteúdo e ações', async () => {
    montar(DsDialogo, {
      props: { modelValue: true, titulo: 'Novo cliente' },
      slots: { default: 'Corpo do diálogo', acoes: 'Área de ações' },
    });
    await esperar(() => {
      const texto = textoDoDocumento();
      expect(texto).toContain('Novo cliente');
      expect(texto).toContain('Corpo do diálogo');
      expect(texto).toContain('Área de ações');
    });
  });

  it('fechado não mostra o conteúdo', async () => {
    montar(DsDialogo, {
      props: { modelValue: false },
      slots: { default: 'Conteúdo oculto' },
    });
    await esperar(() =>
      expect(textoDoDocumento()).not.toContain('Conteúdo oculto'),
    );
  });

  it('fechavel mostra o botão "Fechar" no título, que fecha o diálogo', async () => {
    const w = montar(DsDialogo, {
      props: { modelValue: true, titulo: 'Comanda', fechavel: true },
      slots: { default: 'Itens' },
    });
    await esperar(() =>
      expect(
        document.querySelector('button[aria-label="Fechar"]'),
      ).toBeTruthy(),
    );
    document.querySelector('button[aria-label="Fechar"]').click();
    await esperar(() =>
      expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false]),
    );
  });

  it('expõe o tamanho (data-largura): sm compacto, lg/xl quase tela cheia', async () => {
    montar(DsDialogo, {
      props: { modelValue: true, titulo: 'Comanda', largura: 'xl' },
      slots: { default: 'Itens' },
    });
    await esperar(() =>
      expect(
        document.querySelector('[data-largura="xl"]')?.textContent,
      ).toContain('Itens'),
    );
  });

  it('sem largura, o diálogo é médio', async () => {
    montar(DsDialogo, {
      props: { modelValue: true, titulo: 'Novo' },
      slots: { default: 'Corpo' },
    });
    await esperar(() =>
      expect(document.querySelector('[data-largura="md"]')).toBeTruthy(),
    );
  });
}
