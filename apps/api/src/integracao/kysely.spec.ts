import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { comBarbearia } from '../infra/banco.ts';
import type { Banco, Conexao } from '../infra/banco.ts';
import { criarServidor, novaBarbearia } from './apoio.ts';

// Planejamento 0040, etapa 5 (ADR 0022): o Kysely roda na mesma conexão da
// transação da barbearia, então a RLS continua sendo a proteção. Este teste é
// a garantia de isolamento que as rotas convertidas na etapa 6 herdam.

let servidor: FastifyInstance;
// O mesmo comBarbearia das rotas, com o usuário da aplicação (sem BYPASSRLS).
let pool: pg.Pool;
const naBarbearia = <T>(id: number, fn: (c: Conexao) => Promise<T>) =>
  comBarbearia(pool, id, fn);
beforeAll(async () => {
  servidor = (await criarServidor()) as FastifyInstance;
  pool = new pg.Pool({ connectionString: inject('urlApp') });
});
afterAll(async () => {
  await pool?.end();
  await servidor?.close();
});

async function barbeariaComCliente(nome: string) {
  const b = await novaBarbearia(servidor);
  await b.dono.post('/api/clientes', {
    nome,
    telefone: `119${String(Math.random()).slice(2, 10)}`,
  });
  return b.sessao.barbearia.id as number;
}

describe('Kysely na transação da barbearia', () => {
  it('só enxerga a barbearia da transação, com colunas em camelCase', async () => {
    const a = await barbeariaComCliente('Cliente da A');
    const b = await barbeariaComCliente('Cliente da B');

    const daA = await naBarbearia(a, (c) =>
      c.db
        .selectFrom('clientes')
        .select(['id', 'nome', 'barbeariaId', 'excluidoEm'])
        .execute(),
    );
    expect(daA.map((x) => x.nome)).toEqual(['Cliente da A']);
    expect(daA[0]).toMatchObject({ barbeariaId: a, excluidoEm: null });

    const daB = await naBarbearia(b, (c) =>
      c.db.selectFrom('clientes').select('nome').execute(),
    );
    expect(daB.map((x) => x.nome)).toEqual(['Cliente da B']);
  });

  it('não grava na barbearia de outra (with check da RLS)', async () => {
    const a = await barbeariaComCliente('Cliente');
    const b = await barbeariaComCliente('Cliente');
    await expect(
      naBarbearia(a, (c) =>
        c.db
          .insertInto('clientes')
          .values({ barbeariaId: b, nome: 'Intruso', telefone: '11900001111' })
          .execute(),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('o db guardado não roda depois que a transação acaba', async () => {
    const a = await barbeariaComCliente('Cliente');
    let guardado: Banco | null = null;
    await naBarbearia(a, async (c) => {
      guardado = c.db;
    });
    await expect(
      (guardado as unknown as Banco)
        .selectFrom('clientes')
        .select('id')
        .execute(),
    ).rejects.toThrow(/fora da transação/);
  });

  it('o SQL do driver e o Kysely veem a mesma transação', async () => {
    const a = await barbeariaComCliente('Cliente');
    const nomes = await naBarbearia(a, async (c) => {
      await c.query(
        "insert into clientes (barbearia_id, nome, telefone) values ($1, 'Na transação', '11900002222')",
        [a],
      );
      return (await c.db.selectFrom('clientes').select('nome').execute()).map(
        (x) => x.nome,
      );
    });
    expect(nomes).toContain('Na transação');
  });
});
