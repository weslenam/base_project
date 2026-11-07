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
}
