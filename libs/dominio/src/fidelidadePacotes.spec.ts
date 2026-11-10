import {
  creditosDaComanda,
  FIDELIDADE_PADRAO,
  limiteDeCashback,
  motivoParaUsarCashback,
  motivoParaUsarPremio,
  saldoDeFidelidade,
  validarConfigFidelidade,
} from './fidelidade.ts';
import { motivoParaNaoReceber, totalDaComanda } from './caixa.ts';
import {
  cicloDaRenovacao,
  podeUsarPacote,
  renovarAssinatura,
  saldoDoPacote,
  validarPacote,
  vigenciaDoPacote,
} from './pacotes.ts';
import type { Pacote, UsoDePacote } from './pacotes.ts';
import { diasEntre, inicioDaSemana, somarMeses } from './agenda.ts';

const config = {
  selos: { ativo: true, necessarios: 10, premioServicoId: 1, validadeMeses: 6 },
  cashback: { ativo: true, percentual: 5, validadeDias: 90 },
};
const comanda = (extra = {}) => ({
  id: 7,
  estado: 'paga',
  clienteId: 1,
  itens: [
    { tipo: 'servico', preco: 45, quantidade: 1 },
    { tipo: 'produto', preco: 39.9, quantidade: 1 },
  ],
  desconto: 4.9,
  ...extra,
});

describe('datas auxiliares', () => {
  it('somarMeses fica no último dia do mês menor', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2026-11-07', 1)).toBe('2026-12-07');
  });
  it('diasEntre e inicioDaSemana (segunda)', () => {
    expect(diasEntre('2026-11-07', '2026-11-14')).toBe(7);
    expect(inicioDaSemana('2026-11-08')).toBe('2026-11-02'); // domingo → segunda anterior
    expect(inicioDaSemana('2026-11-09')).toBe('2026-11-09');
  });
});

describe('fidelidade', () => {
  // Planejamento 0037: o que o banco recusaria vira 400, não 500.
  it('validade em meses inteiros e percentual com até 2 casas', () => {
    const comSelos = (validadeMeses: number) => ({
      ...config,
      selos: { ...config.selos, validadeMeses },
    });
    expect(validarConfigFidelidade(comSelos(1.5))).toContain('1 mês');
    expect(validarConfigFidelidade(comSelos(3))).toBeNull();
    const comCashback = (percentual: number) => ({
      ...config,
      cashback: { ativo: true, percentual, validadeDias: 90 },
    });
    expect(validarConfigFidelidade(comCashback(0.001))).toContain('0,1%');
    expect(validarConfigFidelidade(comCashback(2.555))).toContain('0,1%');
    expect(validarConfigFidelidade(comCashback(2.55))).toBeNull();
  });

  it('validação da configuração', () => {
    expect(validarConfigFidelidade(FIDELIDADE_PADRAO)).toBeNull();
    expect(validarConfigFidelidade(config)).toBeNull();
    expect(
      validarConfigFidelidade({
        ...config,
        selos: { ...config.selos, premioServicoId: null },
      }),
    ).toContain('serviço');
    expect(
      validarConfigFidelidade({
        ...config,
        cashback: { ...config.cashback, percentual: 80 },
      }),
    ).toContain('50%');
  });

  it('comanda paga com serviço: 1 selo (com validade) e 5% do total pago', () => {
    const { movimentos } = creditosDaComanda(comanda(), config, '2026-11-07');
    expect(movimentos).toEqual([
      {
        tipo: 'selo',
        valor: 1,
        data: '2026-11-07',
        expiraEm: '2027-05-07',
        comandaId: 7,
      },
      {
        tipo: 'cashback',
        valor: 4,
        data: '2026-11-07',
        expiraEm: '2027-02-05',
        comandaId: 7,
      },
    ]);
  });

  it('avulso, comanda não paga e serviço usado por pacote (R$ 0) não dão selo', () => {
    expect(
      creditosDaComanda(comanda({ clienteId: null }), config, '2026-11-07')
        .movimentos,
    ).toEqual([]);
    expect(
      creditosDaComanda(comanda({ estado: 'aberta' }), config, '2026-11-07')
        .movimentos,
    ).toEqual([]);
    const soPacote = comanda({
      itens: [{ tipo: 'servico', preco: 0, quantidade: 1 }],
      desconto: 0,
    });
    expect(
      creditosDaComanda(soPacote, config, '2026-11-07').movimentos,
    ).toEqual([]);
  });

  it('só o que está ligado na configuração', () => {
    const soCashback = { ...config, selos: { ...config.selos, ativo: false } };
    expect(
      creditosDaComanda(comanda(), soCashback, '2026-11-07').movimentos.map(
        (m) => m.tipo,
      ),
    ).toEqual(['cashback']);
  });

  it('saldo: ignora vencidos, desconta resgates e usos, calcula prêmios', () => {
    const movimentos = [
      ...Array.from({ length: 12 }, () => ({
        tipo: 'selo',
        valor: 1,
        expiraEm: '2027-01-01',
      })),
      { tipo: 'selo', valor: 1, expiraEm: '2026-01-01' }, // vencido
      { tipo: 'resgate_selos', valor: 10 },
      { tipo: 'cashback', valor: 4, expiraEm: '2027-01-01' },
      { tipo: 'cashback', valor: 9.9, expiraEm: '2026-10-01' }, // vencido
      { tipo: 'uso_cashback', valor: 1.5 },
    ];
    expect(saldoDeFidelidade(movimentos, config, '2026-11-07')).toEqual({
      selos: 2,
      necessarios: 10,
      premiosDisponiveis: 0,
      faltamParaPremio: 8,
      cashback: 2.5,
    });
  });
});

describe('resgate na comanda (planejamento 0034)', () => {
  it('gasta primeiro o cashback que vence antes; sobra vencida não conta', () => {
    const movimentos = [
      {
        tipo: 'cashback',
        valor: 10,
        data: '2026-10-01',
        expiraEm: '2026-11-05',
      },
      {
        tipo: 'cashback',
        valor: 10,
        data: '2026-10-02',
        expiraEm: '2026-12-31',
      },
      { tipo: 'uso_cashback', valor: 5, data: '2026-10-10' },
    ];
    // O uso saiu do crédito que vencia antes; a sobra dele (5) venceu.
    expect(saldoDeFidelidade(movimentos, config, '2026-11-07').cashback).toBe(
      10,
    );
    expect(saldoDeFidelidade(movimentos, config, '2026-11-01').cashback).toBe(
      15,
    );
  });

  it('gasto não consome crédito que ainda não existia', () => {
    const movimentos = [
      {
        tipo: 'cashback',
        valor: 3,
        data: '2026-11-01',
        expiraEm: '2026-12-31',
      },
      { tipo: 'uso_cashback', valor: 3, data: '2026-10-01' },
    ];
    expect(saldoDeFidelidade(movimentos, config, '2026-11-07').cashback).toBe(
      3,
    );
  });

  it('prêmio: precisa de cliente, cartão ligado e selos suficientes', () => {
    const saldo = { selos: 10 };
    expect(motivoParaUsarPremio({ config, saldo, clienteId: 1 })).toBeNull();
    expect(motivoParaUsarPremio({ config, saldo, clienteId: null })).toMatch(
      /Identifique o cliente/,
    );
    expect(
      motivoParaUsarPremio({ config, saldo: { selos: 7 }, clienteId: 1 }),
    ).toMatch(/7 de 10 selos/);
    const desligado = { ...config, selos: { ...config.selos, ativo: false } };
    expect(
      motivoParaUsarPremio({ config: desligado, saldo, clienteId: 1 }),
    ).toMatch(/não está ligado/);
  });

  it('cashback: até o saldo e até o que falta pagar', () => {
    const cm = comanda({ estado: 'aberta' }); // 84,90 - 4,90 = 80
    expect(limiteDeCashback({ saldo: { cashback: 100 }, comanda: cm })).toBe(
      80,
    );
    expect(limiteDeCashback({ saldo: { cashback: 12.5 }, comanda: cm })).toBe(
      12.5,
    );
    const saldo = { cashback: 12.5 };
    expect(
      motivoParaUsarCashback({ valor: 12.5, saldo, comanda: cm }),
    ).toBeNull();
    expect(motivoParaUsarCashback({ valor: 13, saldo, comanda: cm })).toMatch(
      /não tem esse saldo/,
    );
    expect(
      motivoParaUsarCashback({
        valor: 90,
        saldo: { cashback: 200 },
        comanda: cm,
      }),
    ).toMatch(/não pode passar/);
    expect(
      motivoParaUsarCashback({
        valor: 1,
        saldo,
        comanda: { ...cm, clienteId: null },
      }),
    ).toMatch(/Identifique o cliente/);
  });

  it('o total pago desconta o cashback usado, e o cashback ganho incide sobre ele', () => {
    const cm = comanda({ cashbackUsado: 10 });
    expect(totalDaComanda(cm)).toMatchObject({ cashback: 10, total: 70 });
    const ganho = creditosDaComanda(cm, config, '2026-11-07').movimentos.find(
      (m) => m.tipo === 'cashback',
    );
    expect(ganho?.valor).toBe(3.5); // 5% de 70
    expect(
      motivoParaNaoReceber({ ...cm, cashbackUsado: 81, forma: 'pix' }),
    ).toMatch(/cashback não pode passar/);
  });
});

describe('pacotes', () => {
  const quatroCortes = {
    nome: '4 cortes',
    preco: 160,
    tipo: 'unico',
    validadeDias: 60,
    itens: [{ servicoId: 1, servicoNome: 'Corte', quantidade: 4 }],
    limites: {},
  };
  const clubeLivre = {
    nome: 'Clube',
    preco: 99.9,
    tipo: 'recorrente',
    itens: [
      { servicoId: 1, servicoNome: 'Corte', quantidade: null },
      { servicoId: 2, servicoNome: 'Barba', quantidade: null },
    ],
    limites: { intervaloMinimoDias: 7, maximoPorSemana: 2 },
  };
  const assinatura = (
    pacote: Pacote,
    usos: UsoDePacote[] = [],
    inicio = '2026-11-02',
  ) => ({
    ...vigenciaDoPacote(pacote, inicio),
    usos,
  });

  it('validação', () => {
    expect(validarPacote(quatroCortes)).toBeNull();
    expect(validarPacote(clubeLivre)).toBeNull();
    expect(validarPacote({ ...quatroCortes, validadeDias: null })).toContain(
      'validade',
    );
    expect(validarPacote({ ...quatroCortes, itens: [] })).toContain(
      'pelo menos um',
    );
    expect(
      validarPacote({
        ...clubeLivre,
        itens: [clubeLivre.itens[0], clubeLivre.itens[0]],
      }),
    ).toContain('uma vez só');
  });

  it('vigência: única pela validade; recorrente por 1 mês', () => {
    expect(vigenciaDoPacote(quatroCortes, '2026-11-02')).toEqual({
      inicio: '2026-11-02',
      fim: '2026-12-31',
    });
    expect(vigenciaDoPacote(clubeLivre, '2026-11-02')).toEqual({
      inicio: '2026-11-02',
      fim: '2026-12-01',
    });
  });

  it('por quantidade: acaba no último uso', () => {
    const usos = [1, 2, 3].map((d) => ({
      servicoId: 1,
      data: `2026-11-0${d + 2}`,
    }));
    const a = assinatura(quatroCortes, usos);
    expect(saldoDoPacote(quatroCortes, a)[0]).toMatchObject({
      usados: 3,
      restantes: 1,
    });
    expect(
      podeUsarPacote({
        pacote: quatroCortes,
        assinatura: a,
        servicoId: 1,
        data: '2026-11-10',
      }),
    ).toEqual({ ok: true });
    a.usos.push({ servicoId: 1, data: '2026-11-10' });
    expect(
      podeUsarPacote({
        pacote: quatroCortes,
        assinatura: a,
        servicoId: 1,
        data: '2026-11-20',
      }).motivo,
    ).toBe('Os 4 usos de Corte deste pacote já foram usados.');
  });

  it('livre: intervalo mínimo por serviço', () => {
    const a = assinatura(clubeLivre, [{ servicoId: 1, data: '2026-11-03' }]);
    expect(
      podeUsarPacote({
        pacote: clubeLivre,
        assinatura: a,
        servicoId: 1,
        data: '2026-11-06',
      }).motivo,
    ).toBe('Próximo uso de Corte liberado em 10/11.');
    // Outro serviço do pacote não depende do intervalo do corte.
    expect(
      podeUsarPacote({
        pacote: clubeLivre,
        assinatura: a,
        servicoId: 2,
        data: '2026-11-06',
      }),
    ).toEqual({ ok: true });
    expect(saldoDoPacote(clubeLivre, a)[0]).toMatchObject({
      quantidade: null,
      usados: 1,
      restantes: null,
    });
  });

  it('livre: máximo por semana (segunda a domingo)', () => {
    const soSemanal = { ...clubeLivre, limites: { maximoPorSemana: 2 } };
    const a = assinatura(soSemanal, [
      { servicoId: 1, data: '2026-11-03' },
      { servicoId: 2, data: '2026-11-04' },
    ]);
    expect(
      podeUsarPacote({
        pacote: soSemanal,
        assinatura: a,
        servicoId: 2,
        data: '2026-11-08',
      }).motivo,
    ).toBe('Limite de 2 usos por semana atingido. Libera em 9/11.');
    // Na semana seguinte, libera.
    expect(
      podeUsarPacote({
        pacote: soSemanal,
        assinatura: a,
        servicoId: 2,
        data: '2026-11-09',
      }),
    ).toEqual({ ok: true });
  });

  it('os dois limites juntos: vale o primeiro que barrar', () => {
    const a = assinatura(clubeLivre, [
      { servicoId: 1, data: '2026-11-03' },
      { servicoId: 2, data: '2026-11-04' },
    ]);
    expect(
      podeUsarPacote({
        pacote: clubeLivre,
        assinatura: a,
        servicoId: 2,
        data: '2026-11-08',
      }).motivo,
    ).toBe('Próximo uso de Barba liberado em 11/11.');
  });

  it('vencido, antes do início, serviço fora do pacote e cancelado', () => {
    const a = assinatura(quatroCortes);
    expect(
      podeUsarPacote({
        pacote: quatroCortes,
        assinatura: a,
        servicoId: 1,
        data: '2027-01-01',
      }).motivo,
    ).toBe('O pacote 4 cortes venceu em 31/12.');
    expect(
      podeUsarPacote({
        pacote: quatroCortes,
        assinatura: a,
        servicoId: 1,
        data: '2026-11-01',
      }).motivo,
    ).toContain('começa');
    expect(
      podeUsarPacote({
        pacote: quatroCortes,
        assinatura: a,
        servicoId: 9,
        data: '2026-11-05',
      }).motivo,
    ).toContain('não inclui');
    expect(
      podeUsarPacote({
        pacote: quatroCortes,
        assinatura: { ...a, cancelada: true },
        servicoId: 1,
        data: '2026-11-05',
      }).motivo,
    ).toContain('cancelado');
  });

  it('recorrente vencido avisa para renovar; renovar abre novo ciclo e zera o saldo', () => {
    const a = assinatura(clubeLivre, [{ servicoId: 1, data: '2026-11-03' }]);
    expect(
      podeUsarPacote({
        pacote: clubeLivre,
        assinatura: a,
        servicoId: 1,
        data: '2026-12-05',
      }).motivo,
    ).toContain('Renove');
    const nova = renovarAssinatura(clubeLivre, a);
    expect(nova).toMatchObject({ inicio: '2026-12-02', fim: '2027-01-01' });
    expect(saldoDoPacote(clubeLivre, nova!)[0]?.usados).toBe(0);
    expect(
      renovarAssinatura(quatroCortes, assinatura(quatroCortes)),
    ).toBeNull();
  });

  it('renovação: em vigor começa depois do fim; vencido começa no pagamento; único não renova', () => {
    const emVigor = { inicio: '2026-11-02', fim: '2026-12-01' };
    expect(cicloDaRenovacao(clubeLivre, emVigor, '2026-11-20')).toEqual({
      inicio: '2026-12-02',
      fim: '2027-01-01',
    });
    expect(cicloDaRenovacao(clubeLivre, emVigor, '2026-12-01')).toMatchObject({
      inicio: '2026-12-02',
    });
    expect(cicloDaRenovacao(clubeLivre, emVigor, '2026-12-10')).toEqual({
      inicio: '2026-12-10',
      fim: '2027-01-09',
    });
    expect(cicloDaRenovacao(quatroCortes, emVigor, '2026-11-20')).toBeNull();
  });
});
