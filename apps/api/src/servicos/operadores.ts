import type pg from 'pg';
import type { ExecutorSql } from '../infra/banco.ts';
import { gerarHashDeSenha, SENHA_MINIMA } from '../seguranca/senha.ts';
import { gerarSegredo, uriOtpauth } from '../seguranca/totp.ts';

/** Dados do operador novo (vindos do script ou do teste). */
export interface DadosDoOperador {
  nome?: string | null;
  email?: string | null;
  senha?: string | null;
  segredo?: string;
}

/** Operador criado, com o segredo TOTP e a URI (só aparecem aqui). */
export interface OperadorCriado {
  id: number;
  nome: string;
  email: string;
  segredo: string;
  uri: string;
}

/**
 * Cria um operador do Business Center (planejamento 0028, ADR 0018). Só por
 * script ou teste, nunca por rota. Devolve o segredo TOTP e a URI do app
 * autenticador, que só aparecem aqui.
 *
 * `operadores` é tabela global: roda no driver pg, no pool, numa conexão
 * avulsa (script) ou na transação de quem chamou.
 */
export async function criarOperador(
  db: ExecutorSql | pg.Client,
  { nome, email, senha, segredo = gerarSegredo() }: DadosDoOperador,
): Promise<OperadorCriado> {
  const nomeLimpo = String(nome ?? '').trim();
  const emailLimpo = String(email ?? '')
    .trim()
    .toLowerCase();
  // Vazio vira '' e não passa da validação abaixo.
  const senhaInformada = String(senha ?? '');
  if (!nomeLimpo) throw new Error('Informe o nome do operador.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo))
    throw new Error('E-mail inválido.');
  if (senhaInformada.length < 12)
    throw new Error(
      `A senha do operador precisa ter pelo menos 12 caracteres (usuários: ${SENHA_MINIMA}).`,
    );
  const {
    rows: [op],
  } = await db.query<{ id: number; nome: string; email: string }>(
    `insert into operadores (nome, email, senha_hash, totp_segredo)
     values ($1, $2, $3, $4) returning id, nome, email`,
    [nomeLimpo, emailLimpo, await gerarHashDeSenha(senhaInformada), segredo],
  );
  if (!op) throw new Error('O operador não foi criado.');
  return { ...op, segredo, uri: uriOtpauth(segredo, emailLimpo) };
}
