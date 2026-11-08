import { afterEach, describe, expect, it, vi } from 'vitest';
import router from '../router';
import {
  clicar,
  esperar,
  montarApp,
  preencher,
  SESSAO_DONO,
  sessaoCom,
  simularApi,
  texto,
} from '../testes/apoio.js';

let app;
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const menu = () =>
  [...document.querySelectorAll('[aria-label="Menu principal"] a')].map((a) =>
    a.textContent.trim(),
  );

describe('entrar e guarda de rotas', () => {
  it('sem sessão, qualquer tela leva para Entrar (guardando a volta)', async () => {
    simularApi({
      'GET /api/auth/eu': () => [
        401,
        { mensagem: 'Entre com seu e-mail e senha.' },
      ],
    });
    app = await montarApp('/caixa', { sessao: null });
    await esperar(() => expect(router.currentRoute.value.name).toBe('entrar'));
    expect(router.currentRoute.value.query.volta).toBe('/caixa');
    expect(texto()).toContain('Cadastre sua barbearia');
  });

  it('senha errada mostra a mensagem da API', async () => {
    simularApi({
      'GET /api/auth/eu': () => [401, {}],
      'POST /api/auth/entrar': () => [
        401,
        { mensagem: 'E-mail ou senha incorretos.' },
      ],
    });
    app = await montarApp('/entrar', { sessao: null });
    await preencher('E-mail', 'dono@barbertime.dev');
    await preencher('Senha', 'errada123');
    await clicar('Entrar', { ultimo: true });
    await esperar(() =>
      expect(texto()).toContain('E-mail ou senha incorretos.'),
    );
  });

  it('login certo volta para a tela pedida, com o nome da barbearia no cabeçalho', async () => {
    const chamadas = simularApi({ 'POST /api/auth/entrar': SESSAO_DONO });
    app = await montarApp('/entrar?volta=/clientes', { sessao: null });
    await preencher('E-mail', 'dono@barbertime.dev');
    await preencher('Senha', 'barbertime123');
    await clicar('Entrar', { ultimo: true });
    await esperar(() =>
      expect(router.currentRoute.value.path).toBe('/clientes'),
    );
    expect(chamadas.at(-1).corpo).toEqual({
      email: 'dono@barbertime.dev',
      senha: 'barbertime123',
    });
    await esperar(() => expect(texto()).toContain('Barbearia do Zé'));
  });
});

describe('menu e telas pelo papel', () => {
  it('Recepção vê agenda, caixa e clientes, sem administração', async () => {
    const recepcao = sessaoCom('Recepção', [
      'agenda.ver',
      'agenda.gerenciar',
      'clientes.ver',
      'clientes.editar',
      'caixa.operar',
    ]);
    app = await montarApp('/agenda', { sessao: recepcao });
    await esperar(() => expect(menu()).toContain('Agenda'));
    expect(menu()).toEqual(
      expect.arrayContaining([
        'Agenda',
        'Caixa',
        'Clientes',
        'Módulos',
      ]),
    );
    for (const item of [
      'Equipe',
      'Serviços',
      'Produtos',
      'Usuários',
      'Papéis e permissões',
      'Configurações',
    ]) {
      expect(menu()).not.toContain(item);
    }
    expect(texto()).toContain('Recepção');
  });

  it('abrir uma tela sem permissão mostra "Sem acesso"', async () => {
    app = await montarApp('/usuarios', {
      sessao: sessaoCom('Barbeiro', ['agenda.ver_propria']),
    });
    await esperar(() =>
      expect(router.currentRoute.value.name).toBe('sem-acesso'),
    );
    expect(texto()).toContain('não permite abrir essa tela');
  });

  it('Página pública só aparece com o módulo de agendamento online ativo', async () => {
    app = await montarApp('/agenda', {
      sessao: sessaoCom('Gerente', ['agenda.ver'], []),
    });
    await esperar(() => expect(menu()).toContain('Agenda'));
    expect(menu()).not.toContain('Página pública');
  });
});
