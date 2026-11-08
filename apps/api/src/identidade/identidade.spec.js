import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import identidade from './index.js';

// Contrato da identidade (ADR 0016, planejamento 0025 S3): toda implementação
// expõe as mesmas operações, e AUTH desconhecido não sobe a API.
const CONTRATO = [
  'lerSessao',
  'abrirSessao',
  'trocarBarbearia',
  'sair',
  'conferirCredenciais',
  'criarConta',
  'trocarSenha',
  'pedirRedefinicao',
  'redefinirSenha',
  'encerrarSessoesDaBarbearia',
];

let app;
afterEach(() => app?.close());

describe('identidade', () => {
  it('a implementação "propria" cumpre o contrato', async () => {
    app = Fastify();
    await app.register(identidade, {
      auth: 'propria',
      correio: {},
      appUrl: '',
    });
    await app.ready();
    expect(app.identidade.nome).toBe('propria');
    for (const op of CONTRATO)
      expect(typeof app.identidade[op], op).toBe('function');
  });

  it('AUTH desconhecido impede a API de subir', async () => {
    app = Fastify();
    app.register(identidade, { auth: 'xpto', correio: {}, appUrl: '' });
    await expect(app.ready()).rejects.toThrow('AUTH="xpto" não existe');
  });
});
