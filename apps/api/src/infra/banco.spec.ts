import { describe, expect, it } from 'vitest';
import type pg from 'pg';
import { comBarbearia } from './banco.ts';

// Transação da requisição (planejamento 0040, etapa 5) sem banco: um pool
// simulado mostra o que acontece com a conexão em cada caso.

function poolSimulado({ rollbackFalha = false } = {}) {
  const comandos: string[] = [];
  const devolucoes: unknown[] = [];
  const cliente = {
    query: async (sql: string) => {
      comandos.push(sql);
      if (sql === 'rollback' && rollbackFalha) throw new Error('conexão caiu');
      return { rows: [], rowCount: 0 };
    },
    release: (erro?: unknown) => {
      devolucoes.push(erro);
    },
  };
  const pool = { connect: async () => cliente } as unknown as pg.Pool;
  return { pool, comandos, devolucoes };
}

describe('transação da barbearia', () => {
  it('#35: rollback que falha mantém o erro original e descarta a conexão', async () => {
    const { pool, devolucoes } = poolSimulado({ rollbackFalha: true });
    await expect(
      comBarbearia(pool, 1, async () => {
        throw new Error('erro da rota');
      }),
    ).rejects.toThrow('erro da rota');
    expect(devolucoes).toHaveLength(1);
    expect(devolucoes[0]).toBeInstanceOf(Error);
  });

  it('com rollback normal, a conexão volta ao pool', async () => {
    const { pool, comandos, devolucoes } = poolSimulado();
    await expect(
      comBarbearia(pool, 1, async () => {
        throw new Error('erro da rota');
      }),
    ).rejects.toThrow('erro da rota');
    expect(comandos).toContain('rollback');
    expect(devolucoes).toEqual([undefined]);
  });

  it('o c.db não abre transação própria', async () => {
    const { pool } = poolSimulado();
    await comBarbearia(pool, 1, async (c) => {
      expect(() => c.db.transaction()).toThrow(/não abra outra/);
      expect(() => c.db.startTransaction()).toThrow(/não abra outra/);
    });
  });
});
