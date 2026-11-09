import { PAPEIS_PADRAO } from '@barbertime/dominio';
import { conflito, invalido } from '../infra/erros.js';
import { SENHA_MINIMA } from '../seguranca/senha.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarNovoUsuario({ nome, email, senha }) {
  if (!String(nome ?? '').trim()) throw invalido('Informe o nome.');
  if (!EMAIL.test(String(email ?? '')))
    throw invalido('Informe um e-mail válido.');
  if (String(senha ?? '').length < SENHA_MINIMA) {
    throw invalido(
      `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
    );
  }
}

/**
 * Cadastro self-service: barbearia + papéis padrão + dono + módulo de
 * agendamento online ativo. Tudo numa transação.
 */
export async function criarBarbearia(fastify, { nome, slug, dono }) {
  if (!String(nome ?? '').trim())
    throw invalido('Informe o nome da barbearia.');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(slug ?? ''))) {
    throw invalido(
      'O endereço deve ter só letras minúsculas, números e hífens (ex.: barbearia-do-ze).',
    );
  }
  validarNovoUsuario(dono ?? {});

  return fastify.emTransacao(async (c) => {
    const ja = await c.query('select 1 from barbearias where slug = $1', [
      slug,
    ]);
    if (ja.rowCount)
      throw conflito(`O endereço "${slug}" já está em uso. Escolha outro.`);
    const conta = await c.query(
      'select 1 from usuarios where lower(email) = lower($1)',
      [dono.email],
    );
    if (conta.rowCount) {
      throw conflito(
        'Já existe uma conta com este e-mail. Entre com ela para continuar.',
      );
    }

    const {
      rows: [barbearia],
    } = await c.query(
      'insert into barbearias (nome, slug) values ($1, $2) returning id, nome, slug',
      [nome.trim(), slug],
    );
    await c.query("select set_config('app.barbearia_id', $1, true)", [
      String(barbearia.id),
    ]);

    const papeis = {};
    for (const p of PAPEIS_PADRAO) {
      const { rows } = await c.query(
        `insert into papeis (barbearia_id, chave, nome, protegido, permissoes)
         values ($1, $2, $3, $4, $5) returning id`,
        [barbearia.id, p.chave, p.nome, p.protegido, p.permissoes],
      );
      papeis[p.chave] = rows[0].id;
    }

    // A conta nasce na identidade (ADR 0016); vínculo e papel ficam conosco.
    const usuarioId = await fastify.identidade.criarConta(c, {
      nome: dono.nome.trim(),
      email: dono.email.trim(),
      senha: dono.senha,
    });
    await c.query(
      'insert into vinculos (barbearia_id, usuario_id, papel_id) values ($1, $2, $3)',
      [barbearia.id, usuarioId, papeis.dono],
    );
    await c.query(
      "insert into barbearia_modulos (barbearia_id, modulo, estado) values ($1, 'agendamento_online', 'ativo')",
      [barbearia.id],
    );
    return { barbearia, usuarioId, papeis };
  });
}
