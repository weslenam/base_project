import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SESSAO_DONO,
  clicar,
  clicarContendo,
  esperar,
  preencher,
  montarApp,
  sessaoCom,
  simularApi,
  texto,
} from '../testes/apoio.js';
import { MODULOS, PAPEIS_PADRAO } from '@barbertime/dominio';

let app;
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const PAPEIS = PAPEIS_PADRAO.map((p, i) => ({
  id: i + 1,
  chave: p.chave,
  nome: p.nome,
  nivel: p.nivel,
  protegido: true,
  permissoes: [...p.permissoes],
  usuarios: 1,
}));
const usuario = (id, nome, chave) => {
  const papel = PAPEIS.find((p) => p.chave === chave);
  return {
    id,
    nome,
    email: `${chave}@barbertime.dev`,
    ativo: true,
    papelId: papel.id,
    papelNome: papel.nome,
    papelChave: chave,
    dono: chave === 'dono',
  };
};
const USUARIOS = [
  usuario(1, 'Zé Carlos', 'dono'),
  usuario(2, 'Gil Gerente', 'gerente'),
  usuario(3, 'Renata Recepção', 'recepcao'),
];
const abrirLinha = (nome) =>
  [...document.querySelectorAll('td')]
    .find((td) => td.textContent.includes(nome))
    .click();

describe('usuários', () => {
  it('lista quem tem acesso, com papel e situação; o próprio usuário aparece como "(você)"', async () => {
    simularApi({ 'GET /api/usuarios': USUARIOS, 'GET /api/papeis': PAPEIS });
    app = await montarApp('/usuarios');
    await esperar(() => expect(texto()).toContain('Renata Recepção'));
    expect(texto()).toContain('(você)');
    expect(texto()).toContain('3 com acesso');
  });

  it('recusa da API aparece no diálogo de negação', async () => {
    const chamadas = simularApi({
      'GET /api/usuarios': USUARIOS,
      'GET /api/papeis': PAPEIS,
      'PUT /api/usuarios/3': () => [
        403,
        {
          mensagem:
            'Você só pode alterar o acesso de quem está abaixo de você.',
        },
      ],
    });
    app = await montarApp('/usuarios');
    await esperar(() => expect(texto()).toContain('Renata Recepção'));
    abrirLinha('Renata');
    await clicar('Desativado');
    await clicar('Salvar');
    await esperar(() => expect(texto()).toContain('Não foi possível'));
    expect(texto()).toContain('quem está abaixo de você');
    expect(chamadas.find((c) => c.metodo === 'PUT').corpo).toEqual({
      papelId: 3,
      ativo: false,
    });
  });

  it('sem senha de outra pessoa: o diálogo não oferece trocar senha', async () => {
    simularApi({ 'GET /api/usuarios': USUARIOS, 'GET /api/papeis': PAPEIS });
    app = await montarApp('/usuarios');
    await esperar(() => expect(texto()).toContain('Renata Recepção'));
    abrirLinha('Renata');
    await esperar(() => expect(texto()).toContain('recepcao@barbertime.dev'));
    expect(texto()).not.toMatch(/senha provisória|Definir senha/i);
  });
});

describe('convite com a história do papel (planejamento 0033)', () => {
  it('mostra o dia da pessoa no papel escolhido e envia o papel certo', async () => {
    const chamadas = simularApi({
      'GET /api/usuarios': USUARIOS,
      'GET /api/papeis': PAPEIS,
      'POST /api/usuarios': (c) => [201, { id: 9, nome: c.nome }],
    });
    app = await montarApp('/usuarios');
    await esperar(() => expect(texto()).toContain('Renata Recepção'));
    await clicar('Convidar usuário');
    await preencher('Nome', 'Ana Souza');
    await preencher('E-mail', 'ana@barbertime.dev');
    await clicarContendo('Atende os clientes');
    await esperar(() =>
      expect(texto()).toContain('Como vai ser o dia de Ana como Barbeiro'),
    );
    expect(texto()).toContain('Ver a própria agenda e os clientes do dia');
    await clicar('Convidar', { ultimo: true });
    await esperar(() =>
      expect(chamadas.find((c) => c.metodo === 'POST')).toBeTruthy(),
    );
    expect(chamadas.find((c) => c.metodo === 'POST').corpo).toMatchObject({
      nome: 'Ana Souza',
      papelId: 4,
    });
  });
});

describe('hierarquia na tela de usuários (planejamento 0023)', () => {
  const comoGerente = sessaoCom('Gerente', ['usuarios.gerenciar']);

  it('Gerente: Dono e outro Gerente ficam só para leitura', async () => {
    simularApi({ 'GET /api/usuarios': USUARIOS, 'GET /api/papeis': PAPEIS });
    app = await montarApp('/usuarios', { sessao: comoGerente });
    await esperar(() => expect(texto()).toContain('Zé Carlos'));
    abrirLinha('Zé Carlos');
    await esperar(() =>
      expect(texto()).toContain('está no seu nível ou acima'),
    );
    expect(texto()).not.toContain('Remover acesso');
  });

  it('Gerente só oferece Recepção e Barbeiro, e cada papel conta a sua história', async () => {
    simularApi({ 'GET /api/usuarios': USUARIOS, 'GET /api/papeis': PAPEIS });
    app = await montarApp('/usuarios', { sessao: comoGerente });
    await esperar(() => expect(texto()).toContain('Renata Recepção'));
    await clicar('Convidar usuário');
    const cartoes = () => [
      ...document.querySelectorAll('[role="group"][aria-label="Papel"] button'),
    ];
    await esperar(() => expect(cartoes().length).toBe(2));
    expect(cartoes().map((b) => b.querySelector('span').textContent)).toEqual([
      'Recepção',
      'Barbeiro',
    ]);
    // Sem chave técnica de permissão na tela.
    expect(texto()).not.toMatch(/caixa\.operar|agenda\.ver/);
    await clicarContendo('Recebe os clientes');
    await esperar(() => expect(texto()).toContain('Vai poder'));
    expect(texto()).toContain('Abrir o caixa e receber as comandas');
    expect(texto()).toContain('Não vai poder');
    expect(texto()).toContain('Fechar o caixa no fim do dia');
  });
});

describe('papéis', () => {
  it('quatro papéis fixos com nível, só para leitura e sem "Novo papel"', async () => {
    simularApi({ 'GET /api/papeis': PAPEIS });
    app = await montarApp('/papeis');
    await esperar(() => expect(texto()).toContain('Barbeiro'));
    for (const nome of ['Dono', 'Gerente', 'Recepção', 'Barbeiro'])
      expect(texto()).toContain(nome);
    expect(texto()).not.toContain('Novo papel');
    expect(texto()).not.toContain('Editar');
    // Histórias no lugar da lista técnica de permissões (planejamento 0033).
    expect(texto()).toContain('Recebe os clientes, cuida da agenda e cobra');
    expect(texto()).toContain('Não vai poder');
    expect(texto()).not.toContain('Ver permissões');
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
