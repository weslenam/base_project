// Operadores do BarberTime Business Center (planejamento 0028, ADR 0018).
//   pnpm nx run api:operador -- criar --nome "Ana" --email ana@barbertime.com.br
//   pnpm nx run api:operador -- desativar --email ana@barbertime.com.br
// A senha vem de OPERADOR_SENHA ou é gerada e mostrada uma vez. O segredo TOTP
// aparece só aqui: cadastre no app autenticador (Google Authenticator, Authy...)
// pela URI otpauth:// (gere um QR com ela) ou digitando o segredo.
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { config } from '../src/infra/config.ts';
import { criarOperador } from '../src/servicos/operadores.js';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { nome: { type: 'string' }, email: { type: 'string' } },
});
const [comando] = positionals;
const db = new pg.Client({ connectionString: config.databaseUrl });
await db.connect();
try {
  if (comando === 'criar') {
    const gerada = !process.env.OPERADOR_SENHA;
    const senha =
      process.env.OPERADOR_SENHA ?? randomBytes(18).toString('base64url');
    const op = await criarOperador(db, {
      nome: values.nome,
      email: values.email,
      senha,
    });
    console.log(`Operador criado: ${op.nome} <${op.email}> (id ${op.id})`);
    if (gerada) console.log(`Senha (mostrada só agora): ${senha}`);
    console.log(`Segredo TOTP: ${op.segredo}`);
    console.log(`URI do autenticador: ${op.uri}`);
  } else if (comando === 'desativar') {
    const { rowCount } = await db.query(
      'update operadores set ativo = false where lower(email) = lower($1)',
      [String(values.email ?? '')],
    );
    await db.query(
      'delete from sessoes_operador where operador_id in (select id from operadores where lower(email) = lower($1))',
      [String(values.email ?? '')],
    );
    console.log(
      rowCount
        ? 'Operador desativado e sessões encerradas.'
        : 'Operador não encontrado.',
    );
  } else {
    console.log(
      'Uso: operador criar --nome N --email E | operador desativar --email E',
    );
    process.exitCode = 1;
  }
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
