import { it, expect } from 'vitest';
import { h } from 'vue';

const colunas = [
  { campo: 'nome', titulo: 'Cliente' },
  { campo: 'saldo', titulo: 'Saldo', formatar: (v) => `R$ ${v}` },
];
const linhas = [
  { id: 1, nome: 'Ana', saldo: 10 },
  { id: 2, nome: 'Bruno', saldo: 20 },
];

export function testarDsTabela(DsTabela, montar) {
  it('mostra os títulos das colunas e os valores', () => {
    const w = montar(DsTabela, { props: { colunas, linhas } });
    for (const texto of ['Cliente', 'Saldo', 'Ana', 'Bruno'])
      expect(w.text()).toContain(texto);
  });

  it('aplica formatar da coluna', () => {
    const w = montar(DsTabela, { props: { colunas, linhas } });
    expect(w.text()).toContain('R$ 10');
  });

  it('sem linhas mostra "Nenhum registro encontrado"', () => {
    const w = montar(DsTabela, { props: { colunas, linhas: [] } });
    expect(w.text()).toContain('Nenhum registro encontrado');
  });

  it('clicar numa linha emite selecionar com a linha original', async () => {
    const w = montar(DsTabela, { props: { colunas, linhas } });
    const celula = w.findAll('td').find((td) => td.text() === 'Bruno');
    await celula.trigger('click');
    expect(w.emitted('selecionar')?.[0]).toEqual([linhas[1]]);
  });

  it('slot celula-<campo> recebe { linha, coluna, valor }', () => {
    const w = montar(DsTabela, {
      props: { colunas, linhas },
      slots: {
        'celula-nome': ({ linha, coluna, valor }) =>
          h('span', `${coluna.titulo}:${valor}:${linha.id}`),
      },
    });
    expect(w.text()).toContain('Cliente:Ana:1');
  });

  it('semRodape mostra todas as linhas sem paginação', () => {
    const muitas = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      nome: `C${i}`,
      saldo: i,
    }));
    const w = montar(DsTabela, {
      props: { colunas, linhas: muitas, semRodape: true },
    });
    expect(w.text()).toContain('C14');
    expect(w.text()).not.toContain('Registros por página');
  });
}
