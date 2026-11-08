import {
  CHAVES_DE_PERMISSAO,
  PAPEIS_PADRAO,
  nivelDoPapel,
  papeisAbaixoDe,
  permissoesDoPapel,
  permissoesEfetivas,
  permissoesInvalidas,
  permissoesPorGrupo,
  podeAgirSobre,
} from './permissoes.js';
import { MODULOS, moduloDoCatalogo, transicaoDeModulo } from './modulos.js';

describe('permissões', () => {
  it('chaves únicas no formato recurso.acao', () => {
    expect(new Set(CHAVES_DE_PERMISSAO).size).toBe(CHAVES_DE_PERMISSAO.length);
    for (const c of CHAVES_DE_PERMISSAO) expect(c).toMatch(/^[a-z]+\.[a-z_]+$/);
  });

  it('papéis padrão só usam permissões do catálogo; Dono tem todas e é protegido', () => {
    for (const p of PAPEIS_PADRAO)
      expect(permissoesInvalidas(p.permissoes)).toEqual([]);
    const dono = PAPEIS_PADRAO.find((p) => p.chave === 'dono');
    expect(dono.protegido).toBe(true);
    expect(dono.permissoes.sort()).toEqual([...CHAVES_DE_PERMISSAO].sort());
  });

  it('gerente gerencia usuários, mas não configura a barbearia nem módulos; recepção não fecha caixa', () => {
    const papel = permissoesDoPapel;
    expect(papel('gerente')).toContain('usuarios.gerenciar');
    for (const p of ['barbearia.configurar', 'modulos.gerenciar'])
      expect(papel('gerente')).not.toContain(p);
    expect(CHAVES_DE_PERMISSAO).not.toContain('papeis.gerenciar');
    expect(papel('recepcao')).not.toContain('caixa.fechar');
    expect(papel('recepcao')).not.toContain('usuarios.gerenciar');
    expect(papel('barbeiro')).toEqual(['agenda.ver_propria']);
    expect(papel('recepcao')).toContain('pacotes.vender');
    expect(papel('recepcao')).not.toContain('pacotes.gerenciar');
    expect(papel('inventado')).toEqual([]);
  });

  it('recusa permissão fora do catálogo', () => {
    expect(permissoesInvalidas(['caixa.fechar', 'tudo.liberado'])).toEqual([
      'tudo.liberado',
    ]);
  });

  it('permissão de módulo só vale com o módulo ativo', () => {
    const doPapel = ['caixa.operar', 'pagamentos.operar'];
    expect(permissoesEfetivas(doPapel, [])).toEqual(['caixa.operar']);
    expect(permissoesEfetivas(doPapel, ['pagamentos_online'])).toEqual(doPapel);
  });

  it('agrupa para telas, na ordem do catálogo', () => {
    expect(permissoesPorGrupo().map((g) => g.grupo)).toEqual([
      'Agenda',
      'Clientes',
      'Caixa',
      'Cadastros',
      'Relatórios',
      'Administração',
      'Fidelidade',
      'Pacotes',
      'Pagamento online',
    ]);
  });
});

describe('hierarquia fixa (ADR 0010, planejamento 0023)', () => {
  it('quatro papéis fixos, do Dono (1) ao Barbeiro (4), todos protegidos', () => {
    expect(PAPEIS_PADRAO.map((p) => [p.chave, p.nivel])).toEqual([
      ['dono', 1],
      ['gerente', 2],
      ['recepcao', 3],
      ['barbeiro', 4],
    ]);
    expect(PAPEIS_PADRAO.every((p) => p.protegido)).toBe(true);
    expect(nivelDoPapel('personalizado')).toBeNull();
  });

  it('só age sobre quem está abaixo: nunca acima nem na lateral', () => {
    expect(podeAgirSobre('dono', 'gerente')).toBe(true);
    expect(podeAgirSobre('gerente', 'recepcao')).toBe(true);
    expect(podeAgirSobre('gerente', 'barbeiro')).toBe(true);
    expect(podeAgirSobre('gerente', 'gerente')).toBe(false); // lateral
    expect(podeAgirSobre('gerente', 'dono')).toBe(false); // acima
    expect(podeAgirSobre('dono', 'dono')).toBe(false); // ninguém dá o papel Dono
    expect(podeAgirSobre('barbeiro', 'barbeiro')).toBe(false);
    expect(podeAgirSobre('recepcao', 'inventado')).toBe(false);
    expect(podeAgirSobre(undefined, 'barbeiro')).toBe(false);
  });

  it('papéis que cada um pode dar', () => {
    expect(papeisAbaixoDe('dono')).toEqual(['gerente', 'recepcao', 'barbeiro']);
    expect(papeisAbaixoDe('gerente')).toEqual(['recepcao', 'barbeiro']);
    expect(papeisAbaixoDe('recepcao')).toEqual(['barbeiro']);
    expect(papeisAbaixoDe('barbeiro')).toEqual([]);
  });
});

describe('módulos', () => {
  it('gateway, fidelidade e pacotes são serviços adicionais', () => {
    for (const m of ['pagamentos_online', 'fidelidade', 'pacotes']) {
      expect(moduloDoCatalogo(m).tipo).toBe('adicional');
    }
    expect(MODULOS.some((m) => m.tipo === 'incluso')).toBe(true);
  });

  it('incluso: ativa e desativa; não se solicita', () => {
    expect(transicaoDeModulo('comissoes', 'inativo', 'ativar')).toEqual({
      estado: 'ativo',
    });
    expect(transicaoDeModulo('comissoes', 'ativo', 'desativar')).toEqual({
      estado: 'inativo',
    });
    expect(
      transicaoDeModulo('comissoes', 'inativo', 'solicitar').erro,
    ).toContain('é só ativar');
  });

  it('adicional: solicita → confirma contratação → ativo; não ativa direto', () => {
    expect(
      transicaoDeModulo('pagamentos_online', 'inativo', 'ativar').erro,
    ).toContain('serviço adicional');
    expect(
      transicaoDeModulo('pagamentos_online', 'inativo', 'solicitar'),
    ).toEqual({ estado: 'solicitado' });
    expect(
      transicaoDeModulo(
        'pagamentos_online',
        'solicitado',
        'confirmar_contratacao',
      ),
    ).toEqual({ estado: 'ativo' });
    expect(
      transicaoDeModulo(
        'pagamentos_online',
        'solicitado',
        'cancelar_solicitacao',
      ),
    ).toEqual({ estado: 'inativo' });
    expect(
      transicaoDeModulo('pagamentos_online', 'inativo', 'confirmar_contratacao')
        .erro,
    ).toBeTruthy();
  });

  it('módulo ou ação desconhecidos', () => {
    expect(transicaoDeModulo('xpto', 'inativo', 'ativar').erro).toBe(
      'Módulo desconhecido.',
    );
    expect(transicaoDeModulo('comissoes', 'inativo', 'voar').erro).toBe(
      'Ação desconhecida.',
    );
  });
});
