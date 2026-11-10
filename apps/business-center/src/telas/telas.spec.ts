import { afterEach } from 'vitest';
import router from '../router';
import {
  apiFalsa,
  clicar,
  esperar,
  montarApp,
  preencher,
  texto,
} from '../testes/apoio.ts';

// Telas do Business Center (planejamento 0028).

const LISTA = [
  {
    id: 1,
    nome: 'Barbearia do Zé',
    slug: 'ze',
    selo: 'ativa',
    donoNome: 'Zé',
    donoEmail: 'ze@x.dev',
    faturamentoMes: 1500,
    ultimaComandaPaga: '2026-11-07',
    modulosPendentes: 1,
    criadaEm: '2026-01-10T12:00:00Z',
  },
  {
    id: 2,
    nome: 'Studio Parado',
    slug: 'parado',
    selo: 'parada',
    donoNome: 'Lia',
    donoEmail: 'lia@x.dev',
    faturamentoMes: 0,
    ultimaComandaPaga: null,
    modulosPendentes: 0,
    criadaEm: '2026-02-10T12:00:00Z',
  },
];

const PAINEL = {
  barbearia: {
    id: 1,
    nome: 'Barbearia do Zé',
    slug: 'ze',
    criadaEm: '2026-01-10T12:00:00Z',
    suspensaEm: null,
    motivoSuspensao: null,
    selo: 'ativa',
  },
  mes: { inicio: '2026-11-01', anterior: '2026-10-01', hoje: '2026-11-08' },
  faturamento: { atual: 1500, anterior: 1000, variacao: 50 },
  atendimentos: { atual: 30, anterior: 25, variacao: 20 },
  ticketMedio: { atual: 50, anterior: 40, variacao: 25 },
  clientes: { total: 120, novos: 8, atendidos: 25 },
  agendamentos: { marcados: 40, noShow: 2, cancelados: 3 },
  topServicos: [{ nome: 'Corte', quantidade: 20, valor: 1000 }],
  topProdutos: [{ nome: 'Pomada', quantidade: 5, valor: 200 }],
  porDia: [{ data: '2026-11-07', valor: 500 }],
  caixa: {
    data: '2026-11-08',
    abertoAs: '09:00',
    valorInicial: 100,
    totalRecebido: 300,
    dinheiroEsperado: 250,
    pagas: 6,
    abertas: 1,
  },
  usuarios: [
    {
      id: 10,
      nome: 'Zé',
      email: 'ze@x.dev',
      ativo: true,
      papelChave: 'dono',
      papelNome: 'Dono',
    },
    {
      id: 11,
      nome: 'Rita',
      email: 'rita@x.dev',
      ativo: true,
      papelChave: 'recepcao',
      papelNome: 'Recepção',
    },
  ],
  modulos: [
    {
      chave: 'estoque',
      nome: 'Estoque e compras',
      tipo: 'adicional',
      estado: 'solicitado',
    },
    { chave: 'comissoes', nome: 'Comissões', tipo: 'incluso', estado: 'ativo' },
  ],
  auditoria: [
    {
      id: 1,
      acao: 'ver_painel',
      motivo: null,
      dados: {},
      criadaEm: '2026-11-08T12:00:00Z',
      operadorNome: 'Ana Operadora',
    },
  ],
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('entrar', () => {
  it('envia e-mail, senha e código do autenticador e abre a lista', async () => {
    const chamadas = apiFalsa({
      'POST /api/plataforma/auth/entrar': {
        operador: { id: 1, nome: 'Ana', email: 'a@b.dev' },
      },
      'GET /api/plataforma/barbearias': LISTA,
    });
    await montarApp('/entrar', { operador: null });
    await preencher('E-mail', 'a@b.dev');
    await preencher('Senha', 'senha-forte-123');
    await preencher('Código do autenticador', '123456');
    await clicar('Entrar');
    await esperar(() =>
      expect(router.currentRoute.value.path).toBe('/barbearias'),
    );
    expect(chamadas[0].corpo).toEqual({
      email: 'a@b.dev',
      senha: 'senha-forte-123',
      codigo: '123456',
    });
  });

  it('mostra o erro da API sem dizer qual campo errou', async () => {
    apiFalsa({
      'POST /api/plataforma/auth/entrar': {
        status: 401,
        corpo: { mensagem: 'E-mail, senha ou código incorretos.' },
      },
    });
    await montarApp('/entrar', { operador: null });
    await preencher('E-mail', 'a@b.dev');
    await preencher('Senha', 'x');
    await preencher('Código do autenticador', '000000');
    await clicar('Entrar');
    await esperar(() =>
      expect(texto()).toContain('E-mail, senha ou código incorretos.'),
    );
  });
});

describe('barbearias', () => {
  it('lista com selo e filtra por situação', async () => {
    apiFalsa({ 'GET /api/plataforma/barbearias': LISTA });
    await montarApp('/barbearias');
    await esperar(() => expect(texto()).toContain('Studio Parado'));
    expect(texto()).toContain('Barbearia do Zé');
    expect(texto()).toMatch(/R\$\s1\.500,00/);
    const parada = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Parada'),
    );
    if (!parada) throw new Error('Botão "Parada" não apareceu');
    parada.click();
    await esperar(() => expect(texto()).not.toContain('Barbearia do Zé'));
    expect(texto()).toContain('Studio Parado');
  });
});

describe('painel da barbearia', () => {
  it('mostra os indicadores do mês com a variação', async () => {
    apiFalsa({ 'GET /api/plataforma/barbearias/1': PAINEL });
    await montarApp('/barbearias/1');
    await esperar(() => expect(texto()).toContain('Faturamento'));
    expect(texto()).toMatch(/R\$\s1\.500,00/);
    expect(texto()).toContain('+50% vs mês anterior');
    expect(texto()).toContain('8 novos · 25 atendidos no mês');
    expect(texto()).toContain('2 faltas · 3 cancelados');
    expect(texto()).toContain('Corte');
    expect(texto()).toContain('Pomada');
    expect(texto()).toContain('Abriu o painel');
  });

  it('confirma a contratação de um módulo com motivo', async () => {
    const chamadas = apiFalsa({
      'GET /api/plataforma/barbearias/1': PAINEL,
      'POST /api/plataforma/barbearias/1/modulos/estoque/confirmar_contratacao':
        { chave: 'estoque', de: 'solicitado', para: 'ativo' },
    });
    await montarApp('/barbearias/1');
    await clicar('Confirmar');
    await preencher('Motivo', 'Contrato assinado');
    await clicar('Confirmar', { ultimo: true });
    await esperar(() =>
      expect(chamadas.map((c) => c.chave)).toContain(
        'POST /api/plataforma/barbearias/1/modulos/estoque/confirmar_contratacao',
      ),
    );
    const feita = chamadas.find((c) =>
      c.chave.includes('confirmar_contratacao'),
    );
    expect(feita?.corpo).toEqual({ motivo: 'Contrato assinado' });
  });

  it('suspende com motivo', async () => {
    const chamadas = apiFalsa({
      'GET /api/plataforma/barbearias/1': PAINEL,
      'POST /api/plataforma/barbearias/1/suspender': {
        ...PAINEL.barbearia,
        suspensaEm: '2026-11-08T13:00:00Z',
      },
    });
    await montarApp('/barbearias/1');
    await clicar('Suspender');
    await preencher('Motivo', 'Uso indevido');
    await clicar('Suspender', { ultimo: true });
    await esperar(() =>
      expect(
        chamadas.find((c) => c.chave.endsWith('/suspender'))?.corpo,
      ).toEqual({
        motivo: 'Uso indevido',
      }),
    );
  });
});
