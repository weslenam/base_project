import {
  ACOES_DAS_PERMISSOES,
  historiaDoPapel,
  resumoDoPapel,
} from './historias.js';
import { CHAVES_DE_PERMISSAO, PAPEIS_PADRAO } from './permissoes.js';

describe('histórias dos papéis', () => {
  it('toda permissão do catálogo tem uma frase', () => {
    for (const chave of CHAVES_DE_PERMISSAO)
      expect(ACOES_DAS_PERMISSOES[chave], chave).toBeTruthy();
  });

  it('todo papel fixo tem resumo e história', () => {
    for (const { chave } of PAPEIS_PADRAO) {
      expect(resumoDoPapel(chave), chave).toBeTruthy();
      expect(historiaDoPapel(chave), chave).not.toBeNull();
    }
    expect(historiaDoPapel('xpto')).toBeNull();
    expect(resumoDoPapel('xpto')).toBe('');
  });

  it('Recepção: o que pode depende dos módulos ativos', () => {
    const sem = historiaDoPapel('recepcao', []);
    expect(sem.nome).toBe('Recepção');
    expect(sem.pode).toContain('Abrir o caixa e receber as comandas');
    expect(sem.pode).not.toContain('Vender pacotes e usar no balcão');
    expect(sem.naoPode).toContain('Fechar o caixa no fim do dia');

    const com = historiaDoPapel('recepcao', ['pacotes', 'estoque']);
    expect(com.pode).toContain('Vender pacotes e usar no balcão');
    expect(com.pode).toContain('Conferir o estoque e as compras');
  });

  it('Barbeiro vê os limites; Dono não tem limites', () => {
    const barbeiro = historiaDoPapel('barbeiro', []);
    expect(barbeiro.pode).toEqual([
      'Ver a própria agenda e os clientes do dia',
    ]);
    expect(barbeiro.naoPode).toContain('Abrir o caixa e receber as comandas');
    expect(barbeiro.naoPode.length).toBeLessThanOrEqual(4);

    const dono = historiaDoPapel('dono', []);
    expect(dono.naoPode).toEqual([]);
    expect(dono.pode).toContain(
      'Configurar a barbearia: dados, horário de funcionamento e regras',
    );
  });

  it('Gerente não configura a barbearia nem contrata módulos', () => {
    const gerente = historiaDoPapel('gerente', []);
    expect(gerente.naoPode).toEqual([
      'Configurar a barbearia: dados, horário de funcionamento e regras',
      'Ativar módulos e contratar serviços adicionais',
    ]);
    expect(gerente.pode).not.toContain(
      'Ativar módulos e contratar serviços adicionais',
    );
    // Vê a agenda de todos: o item da própria agenda seria redundante.
    expect(gerente.pode).toContain('Ver a agenda de todos os barbeiros');
    expect(gerente.pode).not.toContain(
      'Ver a própria agenda e os clientes do dia',
    );
  });
});
