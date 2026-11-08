// Dados de desenvolvimento: pnpm nx run api:semear (idempotente).
// Barbearia modelo + um usuário por papel. SENHAS SÓ PARA DESENVOLVIMENTO.
import Fastify from 'fastify';
import { config } from '../src/infra/config.js';
import { migrar, prepararPapelDaAplicacao } from '../src/infra/migrar.js';
import banco from '../src/infra/banco.js';
import { criarBarbearia } from '../src/servicos/barbearias.js';
import { gerarHashDeSenha } from '../src/seguranca/senha.js';
import { semearOperacao, temPerfil } from './operacao-exemplo.js';
import { criarOperador } from '../src/servicos/operadores.js';
import { momentoNoFuso } from '@barbertime/dominio';
import { semearMovimento, semearVendaAntiga } from './movimento-exemplo.js';

const SENHA = 'barbertime123';
await migrar(config.databaseUrlMigracao);
await prepararPapelDaAplicacao(config.databaseUrlMigracao, config.databaseUrl);

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
// Operação de exemplo (planejamento 0019): serviços, produtos, equipe e clientes,
// só se a barbearia modelo ainda não tiver nenhum serviço.
const {
  rows: [modelo],
} = await fastify.db.query(
  "select id from barbearias where slug = 'barbearia-modelo'",
);
await fastify.comBarbearia(modelo.id, async (c) => {
  const ja = await c.query('select 1 from servicos limit 1');
  if (ja.rowCount) return;
  const inserir = (sql, linhas) =>
    Promise.all(linhas.map((l) => c.query(sql, [modelo.id, ...l])));
  await inserir(
    'insert into servicos (barbearia_id, nome, duracao, preco) values ($1, $2, $3, $4)',
    [
      ['Corte', 30, 45],
      ['Barba', 20, 30],
      ['Corte + barba', 50, 70],
      ['Pigmentação', 40, 60],
    ],
  );
  await inserir(
    'insert into produtos (barbearia_id, nome, preco, comissao) values ($1, $2, $3, $4)',
    [
      ['Pomada modeladora', 39.9, 10],
      ['Óleo para barba', 34.9, 10],
    ],
  );
  const { rows: marcos } = await c.query(
    "select id from usuarios where email = 'barbeiro@barbertime.dev'",
  );
  await inserir(
    'insert into barbeiros (barbearia_id, nome, inicio, fim, comissao, usuario_id) values ($1, $2, $3, $4, $5, $6)',
    [
      ['Zé Carlos', '09:00', '19:00', 40, null],
      ['Marcos', '10:00', '20:00', 45, marcos[0]?.id ?? null],
      ['Léo', '09:00', '17:00', 40, null],
    ],
  );
  await inserir(
    'insert into clientes (barbearia_id, nome, telefone, observacoes) values ($1, $2, $3, $4)',
    [
      ['Rafael Souza', '11987654321', 'Prefere máquina 2 nas laterais.'],
      ['Bruno Lima', '11976543210', ''],
      ['Diego Alves', '11965432109', ''],
      ['Thiago Costa', '11954321098', ''],
    ],
  );
  console.log(
    'Operação de exemplo criada (serviços, produtos, equipe e clientes).',
  );
});

// Barbearias cadastradas pelo app que têm perfil de simulação (ex.: Studio Negoboy).
const { rows: cadastradas } = await fastify.db.query(
  'select id, slug from barbearias order by id',
);
for (const b of cadastradas.filter((x) => temPerfil(x.slug))) {
  const feito = await fastify.comBarbearia(b.id, async (c) => {
    const {
      rows: [dono],
    } = await c.query(
      `select v.usuario_id as id from vinculos v join papeis p on p.id = v.papel_id
        where p.chave = 'dono' and v.ativo order by v.id limit 1`,
    );
    return semearOperacao(c, {
      barbeariaId: b.id,
      slug: b.slug,
      donoUsuarioId: dono?.id ?? null,
    });
  });
  console.log(
    feito
      ? `Operação de simulação criada para ${b.slug}.`
      : `${b.slug} já tem serviços; simulação não aplicada.`,
  );
}

// Movimento de exemplo para o painel do Business Center (planejamento 0028).
if (!config.producao) {
  const hoje = momentoNoFuso(new Date()).data;
  if (
    await fastify.comBarbearia(modelo.id, (c) =>
      semearMovimento(c, { barbeariaId: modelo.id, hoje }),
    )
  )
    console.log('Movimento de 60 dias criado na barbearia modelo.');
  const { rows: outras } = await fastify.db.query(
    "select id, slug from barbearias where slug <> 'barbearia-modelo' order by id limit 1",
  );
  for (const b of outras)
    if (
      await fastify.comBarbearia(b.id, (c) =>
        semearVendaAntiga(c, { barbeariaId: b.id, hoje }),
      )
    )
      console.log(
        `Venda antiga criada em ${b.slug} (sem venda há 10 dias: "Parada" quando tiver mais de 14 dias de cadastro).`,
      );
}

// Operador do Business Center (planejamento 0028). SEGREDO TOTP FIXO, SÓ DEV:
// cadastre no app autenticador ou gere o código com o segredo abaixo.
const SEGREDO_OPERADOR_DEV = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const operador = await fastify.db.query(
  "select 1 from operadores where email = 'operador@barbertime.dev'",
);
if (!operador.rowCount && !config.producao) {
  await criarOperador(fastify.db, {
    nome: 'Operador BarberTime',
    email: 'operador@barbertime.dev',
    senha: 'barbertime-operador',
    segredo: SEGREDO_OPERADOR_DEV,
  });
}
if (!config.producao)
  console.log(
    `Business Center: operador@barbertime.dev / barbertime-operador, TOTP ${SEGREDO_OPERADOR_DEV}.`,
  );

await fastify.close();
