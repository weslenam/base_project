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

describe('esqueci a senha (planejamento 0023)', () => {
  const RESPOSTA = {
    ok: true,
    mensagem:
      'Se este e-mail tiver uma conta, enviamos um link para criar uma senha nova. Ele vale por 1 hora.',
  };

  it('Entrar leva a "Esqueci minha senha", que pede o link e mostra a resposta da API', async () => {
    const chamadas = simularApi({ 'POST /api/auth/esqueci': RESPOSTA });
    app = await montarApp('/entrar', { sessao: null });
    await esperar(() => expect(texto()).toContain('Esqueci minha senha'));
    [...document.querySelectorAll('a')]
      .find((l) => l.textContent.includes('Esqueci minha senha'))
      .click();
    await esperar(() =>
      expect(router.currentRoute.value.path).toBe('/esqueci-senha'),
    );
    await preencher('E-mail', 'dono@barbertime.dev');
    await clicar('Enviar link');
    await esperar(() => expect(texto()).toContain('enviamos um link'));
    expect(chamadas.at(-1)).toMatchObject({
      metodo: 'POST',
      url: '/api/auth/esqueci',
      corpo: { email: 'dono@barbertime.dev' },
    });
  });

  it('o link do e-mail cria a senha nova e volta para Entrar avisando', async () => {
    const chamadas = simularApi({
      'POST /api/auth/redefinir': {
        ok: true,
        mensagem: 'Senha criada. Entre com a senha nova.',
      },
    });
    app = await montarApp('/redefinir-senha#t=abc123', { sessao: null });
    await preencher('Senha nova', 'senha-nova-123');
    await preencher('Repita a senha nova', 'senha-nova-123');
    await clicar('Criar senha');
    await esperar(() => expect(router.currentRoute.value.name).toBe('entrar'));
    expect(chamadas.at(-1).corpo).toEqual({
      token: 'abc123',
      senha: 'senha-nova-123',
    });
    await esperar(() => expect(texto()).toContain('Senha criada'));
  });

  it('senhas diferentes não chegam à API; link vencido mostra a mensagem', async () => {
    const chamadas = simularApi({
      'POST /api/auth/redefinir': () => [
        400,
        { mensagem: 'Este link é inválido ou expirou.' },
      ],
    });
    app = await montarApp('/redefinir-senha#t=velho', { sessao: null });
    await preencher('Senha nova', 'senha-nova-123');
    await preencher('Repita a senha nova', 'outra-senha-1');
    await clicar('Criar senha');
    await esperar(() => expect(texto()).toContain('As senhas não conferem.'));
    expect(chamadas).toHaveLength(0);

    await preencher('Repita a senha nova', 'senha-nova-123');
    await clicar('Criar senha');
    await esperar(() => expect(texto()).toContain('inválido ou expirou'));
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
      expect.arrayContaining(['Agenda', 'Caixa', 'Clientes', 'Módulos']),
    );
    for (const item of [
      'Equipe',
      'Serviços',
      'Produtos',
      'Usuários',
      'Papéis',
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
