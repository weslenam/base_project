import { gerarHashDeSenha, SENHA_MINIMA } from '../seguranca/senha.ts';
import { gerarSegredo, uriOtpauth } from '../seguranca/totp.ts';

/**
 * Cria um operador do Business Center (planejamento 0028, ADR 0018). Só por
 * script ou teste, nunca por rota. Devolve o segredo TOTP e a URI do app
 * autenticador, que só aparecem aqui.
 */
export async function criarOperador(
  db,
  { nome, email, senha, segredo = gerarSegredo() },
) {
  const nomeLimpo = String(nome ?? '').trim();
  const emailLimpo = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!nomeLimpo) throw new Error('Informe o nome do operador.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo))
    throw new Error('E-mail inválido.');
  if (String(senha ?? '').length < 12)
    throw new Error(
      `A senha do operador precisa ter pelo menos 12 caracteres (usuários: ${SENHA_MINIMA}).`,
    );
  const {
    rows: [op],
  } = await db.query(
    `insert into operadores (nome, email, senha_hash, totp_segredo)
     values ($1, $2, $3, $4) returning id, nome, email`,
    [nomeLimpo, emailLimpo, await gerarHashDeSenha(senha), segredo],
  );
  return { ...op, segredo, uri: uriOtpauth(segredo, emailLimpo) };
}
