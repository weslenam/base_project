import {
  seloDeAtividade,
  ticketMedio,
  transicaoPelaPlataforma,
  variacao,
} from './plataforma.js';

const agora = new Date('2026-11-08T12:00:00Z');
const diasAtras = (n) => new Date(agora - n * 86_400_000).toISOString();

describe('seloDeAtividade', () => {
  it('suspensa vence qualquer movimento', () => {
    expect(
      seloDeAtividade({
        criadaEm: diasAtras(1),
        ultimaComandaPaga: diasAtras(0),
        suspensaEm: diasAtras(0),
        agora,
      }),
    ).toBe('suspensa');
  });

  it('ativa com comanda paga nos últimos 7 dias, mesmo se nova', () => {
    expect(
      seloDeAtividade({
        criadaEm: diasAtras(2),
        ultimaComandaPaga: diasAtras(1),
        agora,
      }),
    ).toBe('ativa');
    expect(
      seloDeAtividade({
        criadaEm: diasAtras(300),
        ultimaComandaPaga: diasAtras(6.9),
        agora,
      }),
    ).toBe('ativa');
  });

  it('nova sem movimento até 14 dias; parada depois disso', () => {
    expect(seloDeAtividade({ criadaEm: diasAtras(13), agora })).toBe('nova');
    expect(seloDeAtividade({ criadaEm: diasAtras(14), agora })).toBe('parada');
    expect(
      seloDeAtividade({
        criadaEm: diasAtras(60),
        ultimaComandaPaga: diasAtras(7),
        agora,
      }),
    ).toBe('parada');
  });
});

describe('ticketMedio', () => {
  it('divide sem erro de centavos e zera sem atendimento', () => {
    expect(ticketMedio(100, 3)).toBe(33.33);
    expect(ticketMedio('120.00', 2)).toBe(60);
    expect(ticketMedio(0.3, 1)).toBe(0.3);
    expect(ticketMedio(500, 0)).toBe(0);
  });
});

describe('variacao', () => {
  it('percentual com uma casa, negativa quando cai', () => {
    expect(variacao(150, 100)).toBe(50);
    expect(variacao(90, 120)).toBe(-25);
    expect(variacao(1, 3)).toBe(-66.7);
  });

  it('sem base no mês anterior devolve null', () => {
    expect(variacao(100, 0)).toBeNull();
    expect(variacao(0, 0)).toBeNull();
  });
});

describe('transicaoPelaPlataforma', () => {
  it('confirma só o que foi solicitado', () => {
    expect(
      transicaoPelaPlataforma('estoque', 'solicitado', 'confirmar_contratacao'),
    ).toEqual({ estado: 'ativo' });
    expect(
      transicaoPelaPlataforma('estoque', 'inativo', 'confirmar_contratacao')
        .erro,
    ).toMatch(/depois de solicitada/);
  });

  it('ativa adicional sem pedido e desativa o solicitado', () => {
    expect(transicaoPelaPlataforma('whatsapp', 'inativo', 'ativar')).toEqual({
      estado: 'ativo',
    });
    expect(
      transicaoPelaPlataforma('whatsapp', 'solicitado', 'desativar'),
    ).toEqual({ estado: 'inativo' });
    expect(transicaoPelaPlataforma('whatsapp', 'ativo', 'ativar').erro).toMatch(
      /já está ativo/,
    );
    expect(
      transicaoPelaPlataforma('whatsapp', 'inativo', 'desativar').erro,
    ).toMatch(/já está inativo/);
  });

  it('recusa módulo ou ação desconhecidos', () => {
    expect(transicaoPelaPlataforma('xpto', 'inativo', 'ativar').erro).toBe(
      'Módulo desconhecido.',
    );
    expect(
      transicaoPelaPlataforma('estoque', 'inativo', 'solicitar').erro,
    ).toBe('Ação desconhecida.');
  });
});
