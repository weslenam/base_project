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
  // Garante os módulos da semente também em bancos semeados antes do planejamento 0015.
  await fastify.comBarbearia(existe.rows[0].id, (c) =>
    c.query(
      `insert into barbearia_modulos (barbearia_id, modulo, estado)
       select $1, m, 'ativo' from unnest(array['fidelidade', 'pacotes']) m
       on conflict (barbearia_id, modulo) do nothing`,
      [existe.rows[0].id],
    ),
  );
  console.log('Semente já aplicada (módulos Fidelidade e Pacotes garantidos).');
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
    // Comissões (incluso) e, como se a contratação já estivesse confirmada,
    // os adicionais Fidelidade e Pacotes (planejamento 0015).
    for (const modulo of ['comissoes', 'fidelidade', 'pacotes']) {
      await c.query(
        "insert into barbearia_modulos (barbearia_id, modulo, estado) values ($1, $2, 'ativo')",
        [barbearia.id, modulo],
      );
    }
  });
  console.log(`Semente aplicada. Entre com dono@barbertime.dev / ${SENHA}.`);
}
await fastify.close();
