// Dados de desenvolvimento: pnpm nx run api:semear (idempotente).
// Barbearia modelo + um usuário por papel. SENHAS SÓ PARA DESENVOLVIMENTO.
import Fastify from 'fastify';
import { config } from '../src/infra/config.js';
import { migrar } from '../src/infra/migrar.js';
import banco from '../src/infra/banco.js';
import { criarBarbearia } from '../src/servicos/barbearias.js';
import { gerarHashDeSenha } from '../src/seguranca/senha.js';

const SENHA = 'barbertime123';
await migrar(config.databaseUrlMigracao);

const fastify = Fastify();
await fastify.register(banco, { databaseUrl: config.databaseUrl });
await fastify.ready();

const existe = await fastify.db.query(
  "select id from barbearias where slug = 'barbearia-modelo'",
);
if (existe.rowCount) {
  console.log('Semente já aplicada.');
} else {
  const { barbearia, papeis } = await criarBarbearia(fastify, {
    nome: 'Barbearia do Zé',
    slug: 'barbearia-modelo',
    dono: { nome: 'Zé Carlos', email: 'dono@barbertime.dev', senha: SENHA },
  });
  await fastify.comBarbearia(barbearia.id, async (c) => {
    for (const [chave, nome] of [
      ['gerente', 'Gabriela Gerente'],
      ['recepcao', 'Renata Recepção'],
      ['barbeiro', 'Marcos Barbeiro'],
    ]) {
      const {
        rows: [u],
      } = await c.query(
        'insert into usuarios (nome, email, senha_hash) values ($1, $2, $3) returning id',
        [nome, `${chave}@barbertime.dev`, await gerarHashDeSenha(SENHA)],
      );
      await c.query(
        'insert into vinculos (barbearia_id, usuario_id, papel_id) values ($1, $2, $3)',
        [barbearia.id, u.id, papeis[chave]],
      );
    }
    await c.query(
      "insert into barbearia_modulos (barbearia_id, modulo, estado) values ($1, 'comissoes', 'ativo')",
      [barbearia.id],
    );
  });
  console.log(`Semente aplicada. Entre com dono@barbertime.dev / ${SENHA}.`);
}
await fastify.close();
