import { afterEach, describe, expect, it, vi } from 'vitest';
import { mesclarConfigBarbearia } from '@barbertime/dominio';
import {
  SESSAO_DONO,
  campo,
  clicar,
  esperar,
  montarApp,
  preencher,
  sessaoCom,
  simularApi,
  texto,
} from '../testes/apoio.js';

// Planejamento 0017: área de administração, configurações, perfil e senha provisória.

let app;
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const BARBEARIA = () => ({
  id: 1,
  nome: 'Barbearia do Zé',
  slug: 'barbearia-modelo',
  configuracoes: mesclarConfigBarbearia({}),
});
const linkDoMenu = (t) =>
  [...document.querySelectorAll('[aria-label="Menu principal"] a')].find(
    (a) => a.textContent.trim() === t,
  );

describe('área de administração no menu', () => {
  it('Dono vê o grupo Administração com Configurações, Usuários, Papéis e Módulos', async () => {
    simularApi({ 'GET /api/barbearia': BARBEARIA() });
    app = await montarApp('/configuracoes');
    await esperar(() => expect(linkDoMenu('Configurações')).toBeTruthy());
    const menu = document.querySelector(
      '[aria-label="Menu principal"]',
    ).textContent;
    expect(menu.indexOf('Administração')).toBeLessThan(
      menu.indexOf('Configurações'),
    );
    for (const t of ['Usuários', 'Papéis e permissões', 'Módulos']) {
      expect(linkDoMenu(t)).toBeTruthy();
    }
    expect(menu).toContain('Cadastros');
  });

  it('recepção não vê Configurações e a rota leva para "sem acesso"', async () => {
    app = await montarApp('/configuracoes', {
      sessao: sessaoCom('Recepção', ['agenda.ver', 'caixa.operar']),
    });
    await esperar(() => expect(texto()).not.toContain('Nome da barbearia'));
    expect(linkDoMenu('Configurações')).toBeFalsy();
    expect(linkDoMenu('Usuários')).toBeFalsy();
    expect(texto()).toContain('Sem acesso');
  });
});

describe('configurações da barbearia', () => {
  it('edita o horário de domingo e salva o que foi preenchido', async () => {
    const chamadas = simularApi({
      'GET /api/barbearia': BARBEARIA(),
      'PUT /api/barbearia': (corpo) => [200, corpo],
      'GET /api/auth/eu': SESSAO_DONO,
    });
    app = await montarApp('/configuracoes');
    await esperar(() =>
      expect(campo('Nome da barbearia')?.value).toBe('Barbearia do Zé'),
    );
    await clicar('Funcionamento');
    const domingo = () => document.querySelector('[data-dia="0"]');
    await esperar(() => expect(domingo().textContent).toContain('Fechado'));
    domingo().querySelector('input[type="checkbox"]').click();
    await esperar(() =>
      expect(domingo().querySelectorAll('input[type="time"]')).toHaveLength(2),
    );
    const [abre, fecha] = domingo().querySelectorAll('input[type="time"]');
    for (const [el, v] of [
      [abre, '10:00'],
      [fecha, '14:00'],
    ]) {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await clicar('Salvar');
    await esperar(() => expect(texto()).toContain('Configurações salvas'));
    const put = chamadas.find((c) => c.metodo === 'PUT');
    expect(put.corpo.configuracoes.funcionamento[0]).toEqual({
      dia: 0,
      aberto: true,
      abre: '10:00',
      fecha: '14:00',
    });
    expect(put.corpo.configuracoes.agendamento.diasAFrente).toBe(30);
  });

  it('horário inválido é negado antes de chamar a API', async () => {
    const chamadas = simularApi({ 'GET /api/barbearia': BARBEARIA() });
    app = await montarApp('/configuracoes');
    await clicar('Funcionamento');
    const segunda = () => document.querySelector('[data-dia="1"]');
    await esperar(() => expect(segunda()).toBeTruthy());
    const fecha = segunda().querySelectorAll('input[type="time"]')[1];
    fecha.value = '08:00';
    fecha.dispatchEvent(new Event('input', { bubbles: true }));
    await clicar('Salvar');
    await esperar(() =>
      expect(texto()).toContain(
        'Segunda: o fechamento precisa ser depois da abertura.',
      ),
    );
    expect(chamadas.some((c) => c.metodo === 'PUT')).toBe(false);
  });

  it('trocar o endereço público passa pela advertência', async () => {
    const chamadas = simularApi({
      'GET /api/barbearia': BARBEARIA(),
      'PUT /api/barbearia': (corpo) => [200, corpo],
      'GET /api/auth/eu': SESSAO_DONO,
    });
    app = await montarApp('/configuracoes');
    await esperar(() =>
      expect(campo('Endereço da página pública')?.value).toBe(
        'barbearia-modelo',
      ),
    );
    await preencher('Endereço da página pública', 'ze-barbearia');
    await clicar('Salvar');
    await esperar(() =>
      expect(texto()).toContain('não vai mais encontrar a barbearia'),
    );
    await clicar('Manter o atual');
    expect(chamadas.some((c) => c.metodo === 'PUT')).toBe(false);
    await clicar('Salvar');
    await clicar('Trocar endereço');
    await esperar(() =>
      expect(chamadas.find((c) => c.metodo === 'PUT')?.corpo.slug).toBe(
        'ze-barbearia',
      ),
    );
  });
});

describe('meu perfil', () => {
  it('o nome no cabeçalho leva ao perfil, com nome, e-mail e barbearias', async () => {
    app = await montarApp('/agenda');
    await esperar(() =>
      expect(document.querySelector('a[title="Meu perfil"]')).toBeTruthy(),
    );
    expect(
      document.querySelector('a[title="Meu perfil"]').getAttribute('href'),
    ).toBe('/perfil');
    app.unmount();
    document.body.innerHTML = '';
    app = await montarApp('/perfil');
    await esperar(() => expect(campo('Nome')?.value).toBe('Zé Carlos'));
    expect(campo('E-mail').value).toBe('dono@barbertime.dev');
    expect(
      document.querySelector('[aria-label="Suas barbearias"]').textContent,
    ).toContain('Atual');
  });

  it('troca a senha e avisa que a outra sessão caiu', async () => {
    const chamadas = simularApi({
      'PUT /api/auth/senha': { ok: true, sessoesEncerradas: 1 },
    });
    app = await montarApp('/perfil');
    await preencher('Senha atual', 'barbertime123');
    await preencher('Nova senha', 'nova-senha-boa');
    await preencher('Repita a nova senha', 'nova-senha-boa');
    await clicar('Trocar senha');
    await esperar(() =>
      expect(texto()).toContain('A outra sessão aberta foi encerrada'),
    );
    expect(chamadas[0].corpo).toEqual({
      senhaAtual: 'barbertime123',
      novaSenha: 'nova-senha-boa',
    });
  });

  it('senha atual errada aparece na negação', async () => {
    simularApi({
      'PUT /api/auth/senha': () => [
        400,
        { mensagem: 'A senha atual não confere.' },
      ],
    });
    app = await montarApp('/perfil');
    await preencher('Senha atual', 'errada-123');
    await preencher('Nova senha', 'nova-senha-boa');
    await preencher('Repita a nova senha', 'nova-senha-boa');
    await clicar('Trocar senha');
    await esperar(() =>
      expect(texto()).toContain('A senha atual não confere.'),
    );
  });

  it('senhas diferentes não chegam à API', async () => {
    const chamadas = simularApi({});
    app = await montarApp('/perfil');
    await preencher('Senha atual', 'barbertime123');
    await preencher('Nova senha', 'nova-senha-boa');
    await preencher('Repita a nova senha', 'outra-coisa');
    await clicar('Trocar senha');
    await esperar(() => expect(texto()).toContain('As senhas não são iguais'));
    expect(chamadas).toHaveLength(0);
  });
});

describe('senha provisória em Usuários', () => {
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
      id: 4,
      nome: 'Marcos Barbeiro',
      email: 'barbeiro@barbertime.dev',
      ativo: true,
      papelId: 4,
      papelNome: 'Barbeiro',
      dono: false,
    },
  ];
  const PAPEIS = [
    { id: 1, chave: 'dono', nome: 'Dono', protegido: true, permissoes: [] },
    {
      id: 4,
      chave: 'barbeiro',
      nome: 'Barbeiro',
      protegido: false,
      permissoes: [],
    },
  ];

  it('Dono define a senha provisória de quem esqueceu', async () => {
    const chamadas = simularApi({
      'GET /api/usuarios': USUARIOS,
      'GET /api/papeis': PAPEIS,
      'PUT /api/usuarios/4/senha': { ok: true },
    });
    app = await montarApp('/usuarios');
    await esperar(() => expect(texto()).toContain('Marcos Barbeiro'));
    [...document.querySelectorAll('td')]
      .find((td) => td.textContent.includes('Marcos'))
      .click();
    await preencher('Nova senha provisória', 'provisoria-1');
    await clicar('Definir senha');
    await esperar(() => expect(texto()).toContain('Senha provisória definida'));
    expect(chamadas.find((c) => c.metodo === 'PUT').corpo).toEqual({
      senha: 'provisoria-1',
    });
  });

  it('a própria conta não mostra a opção', async () => {
    simularApi({ 'GET /api/usuarios': USUARIOS, 'GET /api/papeis': PAPEIS });
    app = await montarApp('/usuarios');
    await esperar(() => expect(texto()).toContain('Zé Carlos'));
    [...document.querySelectorAll('td')]
      .find((td) => td.textContent.includes('Zé Carlos'))
      .click();
    await esperar(() => expect(texto()).toContain('use Meu perfil'));
    expect(campo('Nova senha provisória')).toBeFalsy();
  });
});
