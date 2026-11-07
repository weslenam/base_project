import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SESSAO_DONO,
  clicar,
  esperar,
  montarApp,
  simularApi,
  texto,
} from '../testes/apoio.js';
import { CHAVES_DE_PERMISSAO, MODULOS } from '@barbertime/dominio';

let app;
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const PAPEIS = [
  {
    id: 1,
    chave: 'dono',
    nome: 'Dono',
    protegido: true,
    permissoes: [...CHAVES_DE_PERMISSAO],
    usuarios: 1,
  },
  {
    id: 3,
    chave: 'recepcao',
    nome: 'Recepção',
    protegido: false,
    permissoes: ['agenda.ver', 'caixa.operar'],
    usuarios: 1,
  },
];
const USUARIOS = [
  {
    id: 1,
    nome: 'Zé Carlos',
    email: 'dono@barbertime.dev',
    ativo: true,
    papelId: 1,
    papelNome: 'Dono',
    dono: true,
  },
  {
    id: 3,
    nome: 'Renata Recepção',
    email: 'recepcao@barbertime.dev',
    ativo: true,
    papelId: 3,
    papelNome: 'Recepção',
    dono: false,
  },
];

describe('usuários', () => {
  it('lista quem tem acesso, com papel e situação; o próprio usuário aparece como "(você)"', async () => {
    simularApi({ 'GET /api/usuarios': USUARIOS, 'GET /api/papeis': PAPEIS });
    app = await montarApp('/usuarios');
    await esperar(() => expect(texto()).toContain('Renata Recepção'));
    expect(texto()).toContain('(você)');
    expect(texto()).toContain('2 com acesso');
  });

  it('recusa da API (último Dono) aparece no diálogo de negação', async () => {
    const chamadas = simularApi({
      'GET /api/usuarios': USUARIOS,
      'GET /api/papeis': PAPEIS,
      'PUT /api/usuarios/3': () => [
        409,
        { mensagem: 'A barbearia precisa de pelo menos um Dono ativo.' },
      ],
    });
    app = await montarApp('/usuarios');
    await esperar(() => expect(texto()).toContain('Renata Recepção'));
    [...document.querySelectorAll('td')]
      .find((td) => td.textContent.includes('Renata'))
      .click();
    await clicar('Desativado');
    await clicar('Salvar');
    await esperar(() => expect(texto()).toContain('Não foi possível'));
    expect(texto()).toContain('pelo menos um Dono ativo');
    expect(chamadas.find((c) => c.metodo === 'PUT').corpo).toEqual({
      papelId: 3,
      ativo: false,
    });
  });
});

describe('papéis', () => {
  it('Dono aparece protegido; abrir mostra as permissões só para leitura', async () => {
    simularApi({ 'GET /api/papeis': PAPEIS });
    app = await montarApp('/papeis');
    await esperar(() => expect(texto()).toContain('Protegido'));
    await clicar('Ver permissões');
    await esperar(() => expect(texto()).toContain('não pode ser alterado'));
    const caixas = [
      ...document.querySelectorAll('.v-dialog input[type="checkbox"]'),
    ];
    expect(caixas.length).toBe(CHAVES_DE_PERMISSAO.length);
    expect(caixas.every((c) => c.checked && c.disabled)).toBe(true);
  });

  it('editar papel envia só as permissões marcadas', async () => {
    const chamadas = simularApi({
      'GET /api/papeis': PAPEIS,
      'PUT /api/papeis/3': (corpo) => [200, { ...PAPEIS[1], ...corpo }],
    });
    app = await montarApp('/papeis');
    await clicar('Editar');
    await esperar(() => expect(texto()).toContain('Papel Recepção'));
    const caixa = [...document.querySelectorAll('.v-dialog label')]
      .find((l) => l.textContent.includes('Fechar o caixa do dia'))
      .querySelector('input');
    caixa.click();
    await clicar('Salvar');
    await esperar(() =>
      expect(chamadas.some((c) => c.metodo === 'PUT')).toBe(true),
    );
    const put = chamadas.find((c) => c.metodo === 'PUT');
    expect(put.corpo.permissoes.sort()).toEqual([
      'agenda.ver',
      'caixa.fechar',
      'caixa.operar',
    ]);
  });
});

describe('módulos', () => {
  const lista = (estados = {}) =>
    MODULOS.map((m) => ({ ...m, estado: estados[m.chave] ?? 'inativo' }));

  it('separa inclusos e serviços adicionais; solicitar pede confirmação e chama a API', async () => {
    let estados = { agendamento_online: 'ativo' };
    const chamadas = simularApi({
      'GET /api/modulos': () => [200, lista(estados)],
      'GET /api/auth/eu': SESSAO_DONO,
      'POST /api/modulos/pagamentos_online/solicitar': () => {
        estados = { ...estados, pagamentos_online: 'solicitado' };
        return [200, {}];
      },
    });
    app = await montarApp('/modulos');
    await esperar(() => expect(texto()).toContain('Serviços adicionais'));
    expect(texto()).toContain('Pagamento online');

    const cartao = [...document.querySelectorAll('section')].find(
      (s) => s.getAttribute('aria-label') === 'Pagamento online',
    );
    [...cartao.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Solicitar'))
      .click();
    await esperar(() => expect(texto()).toContain('cobrado à parte'));
    await clicar('Solicitar contratação', { ultimo: true });
    await esperar(() =>
      expect(
        chamadas.some(
          (c) => c.url === '/api/modulos/pagamentos_online/solicitar',
        ),
      ).toBe(true),
    );
    await esperar(() => expect(texto()).toContain('Aguardando contratação'));
  });
});
