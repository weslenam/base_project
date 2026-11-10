import { sql } from 'kysely';
import type { RawBuilder } from 'kysely';
import type { Conexao } from '../infra/banco.ts';
import { naoEncontrado } from '../infra/erros.ts';
import { SELECT_ATENDIMENTO, SELECT_BLOQUEIO, comEstado } from './agenda.ts';
import type { LinhaDeBloqueio } from './agenda.ts';
import type { AtendimentoNaAgenda } from '@barbertime/contratos';

// Leitura de atendimentos e bloqueios para as rotas da operação (agenda,
// balcão e caixa), já com os tipos da linha completa (planejamento 0040,
// etapa 6). SELECT_ATENDIMENTO e SELECT_BLOQUEIO vêm de `agenda.ts` e seguem
// em SQL: usam to_char com fuso e vários joins. Vão em `sql.raw` porque são
// texto fixo do código (sem dado da requisição); o filtro (`onde`) é sempre
// um `sql` com parâmetros.

type LinhaDoSelect = Omit<AtendimentoNaAgenda, 'estado'>;

/** Atendimentos de SELECT_ATENDIMENTO com o filtro e a ordem de `onde`. */
export async function atendimentosOnde(
  c: Conexao,
  onde: RawBuilder<unknown>,
): Promise<AtendimentoNaAgenda[]> {
  const { rows } = await sql<LinhaDoSelect>`${sql.raw(
    SELECT_ATENDIMENTO,
  )} ${onde}`.execute(c.db);
  return rows.map(comEstado);
}

/** Bloqueios de SELECT_BLOQUEIO com o filtro de `onde`. */
export async function bloqueiosOnde(
  c: Conexao,
  onde: RawBuilder<unknown>,
): Promise<LinhaDeBloqueio[]> {
  const { rows } = await sql<LinhaDeBloqueio>`${sql.raw(
    SELECT_BLOQUEIO,
  )} ${onde}`.execute(c.db);
  return rows;
}

/**
 * Atendimento pelo id, como o `buscarAtendimento` de `agenda.ts` (mesma
 * consulta e mesma mensagem), mas com o tipo da linha completa: aquele devolve
 * só id, status e confirmadoEm tipados. `travar`: trava a linha até o fim da
 * transação (transições de estado).
 */
export async function obterAtendimento(
  c: Conexao,
  id: number | string,
  { travar = false }: { travar?: boolean } = {},
): Promise<AtendimentoNaAgenda> {
  const [a] = await atendimentosOnde(
    c,
    sql`where a.id = ${Number(id)}${travar ? sql` for update of a` : sql``}`,
  );
  if (!a) throw naoEncontrado('Atendimento não encontrado.');
  return a;
}
