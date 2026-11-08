import { permissoesAlemDasSuas } from '@barbertime/dominio';
import {
  conflito,
  invalido,
  naoEncontrado,
  proibido,
} from '../../infra/erros.js';
import { gerarHashDeSenha, SENHA_MINIMA } from '../../seguranca/senha.js';
import { encerrarOutrasSessoes } from '../../seguranca/sessao.js';
import { validarNovoUsuario } from '../../servicos/barbearias.js';
import { TAM, corpo, inteiro, logico, texto } from '../esquemas.js';

const LISTAR = `
  select u.id, u.nome, u.email, v.ativo, p.id as "papelId", p.nome as "papelNome",
         p.chave = 'dono' as dono
    from vinculos v
    join usuarios u on u.id = v.usuario_id
    join papeis p on p.id = v.papel_id`;

/** A barbearia nunca fica sem um Dono ativo (ADR 0010). */
async function garantirDono(c, { removendoUsuario }) {
  const { rows } = await c.query(
    `select count(*)::int as n from vinculos v join papeis p on p.id = v.papel_id
      where p.chave = 'dono' and v.ativo and v.usuario_id <> $1`,
    [removendoUsuario],
  );
  if (!rows[0].n)
    throw conflito('A barbearia precisa de pelo menos um Dono ativo.');
}

/**
 * Ninguém concede o que não tem (ADR 0010): quem administra usuários só dá
 * papéis e só altera, remove ou troca a senha de quem não tem permissão que ele
 * não tenha. Sem isso, um papel com `usuarios.gerenciar` viraria Dono.
 */
function exigirSoOQueTem(req, permissoesAlvo, mensagem) {
  if (
    permissoesAlemDasSuas(req.contexto.permissoesDoPapel, permissoesAlvo).length
  )
    throw proibido(mensagem);
}
const NAO_DA_PAPEL =
  'Você não pode dar um papel com permissões que você não tem.';
const NAO_ALTERA =
  'Você não pode alterar o acesso de quem tem permissões que você não tem.';

/** Permissões do papel atual do usuário nesta barbearia (null se não tem acesso). */
async function permissoesDoUsuario(c, id) {
  const { rows } = await c.query(
    'select p.permissoes from vinculos v join papeis p on p.id = v.papel_id where v.usuario_id = $1',
    [id],
  );
  return rows[0]?.permissoes ?? null;
}

export default async function (fastify) {
  const acesso = { preHandler: fastify.exigir('usuarios.gerenciar') };

  fastify.get('/usuarios', acesso, (req) =>
    fastify.naBarbearia(
      req,
      async (c) => (await c.query(`${LISTAR} order by u.nome`)).rows,
    ),
  );

  /** Convida: cria a conta (com senha provisória) ou vincula conta existente pelo e-mail. */
  fastify.post(
    '/usuarios',
    {
      ...acesso,
      schema: corpo({
        nome: texto(TAM.nome),
        email: texto(TAM.email),
        senha: texto(TAM.senha),
        papelId: inteiro,
      }),
    },
    async (req, reply) => {
      const { nome, email, senha, papelId } = req.body ?? {};
      return fastify.naBarbearia(req, async (c) => {
        const papel = await c.query(
          'select permissoes from papeis where id = $1',
          [Number(papelId)],
        );
        if (!papel.rowCount) throw invalido('Escolha o papel do usuário.');
        exigirSoOQueTem(req, papel.rows[0].permissoes, NAO_DA_PAPEL);

        let {
          rows: [usuario],
        } = await c.query(
          'select id from usuarios where lower(email) = lower($1)',
          [String(email ?? '')],
        );
        if (!usuario) {
          validarNovoUsuario({ nome, email, senha });
          ({
            rows: [usuario],
          } = await c.query(
            'insert into usuarios (nome, email, senha_hash) values ($1, $2, $3) returning id',
            [nome.trim(), email.trim(), await gerarHashDeSenha(senha)],
          ));
        }
        const ja = await c.query(
          'select 1 from vinculos where usuario_id = $1',
          [usuario.id],
        );
        if (ja.rowCount)
          throw conflito('Esse e-mail já tem acesso a esta barbearia.');
        await c.query(
          'insert into vinculos (barbearia_id, usuario_id, papel_id) values ($1, $2, $3)',
          [req.contexto.barbeariaId, usuario.id, Number(papelId)],
        );
        reply.code(201);
        return (await c.query(`${LISTAR} where u.id = $1`, [usuario.id]))
          .rows[0];
      });
    },
  );

  /** Troca papel ou ativa/desativa o acesso. */
  fastify.put(
    '/usuarios/:id',
    { ...acesso, schema: corpo({ papelId: inteiro, ativo: logico }) },
    async (req) => {
      const id = Number(req.params.id);
      if (id === req.contexto.usuarioId)
        throw proibido('Você não pode alterar o próprio acesso.');
      const { papelId, ativo } = req.body ?? {};
      return fastify.naBarbearia(req, async (c) => {
        const {
          rows: [atual],
        } = await c.query(`${LISTAR} where u.id = $1`, [id]);
        if (!atual)
          throw naoEncontrado('Usuário não encontrado nesta barbearia.');
        exigirSoOQueTem(req, await permissoesDoUsuario(c, id), NAO_ALTERA);
        const novoPapel = papelId ? Number(papelId) : atual.papelId;
        const {
          rows: [papel],
        } = await c.query(
          'select chave, permissoes from papeis where id = $1',
          [novoPapel],
        );
        if (!papel) throw invalido('Papel não encontrado.');
        exigirSoOQueTem(req, papel.permissoes, NAO_DA_PAPEL);
        const deixaDeSerDonoAtivo =
          atual.dono &&
          atual.ativo &&
          (papel.chave !== 'dono' || ativo === false);
        if (deixaDeSerDonoAtivo)
          await garantirDono(c, { removendoUsuario: id });
        await c.query(
          'update vinculos set papel_id = $2, ativo = $3 where usuario_id = $1',
          [id, novoPapel, ativo ?? atual.ativo],
        );
        return (await c.query(`${LISTAR} where u.id = $1`, [id])).rows[0];
      });
    },
  );

  /**
   * Senha provisória definida pelo Dono (quem esqueceu a senha). Só para conta
   * que acessa apenas esta barbearia: a conta é global e outro tenant também
   * pode depender dela. Todas as sessões da pessoa caem.
   */
  fastify.put(
    '/usuarios/:id/senha',
    { ...acesso, schema: corpo({ senha: texto(TAM.senha) }) },
    async (req) => {
      const id = Number(req.params.id);
      if (id === req.contexto.usuarioId) {
        throw proibido('Para trocar a sua senha, use Meu perfil.');
      }
      const senha = String(req.body?.senha ?? '');
      if (senha.length < SENHA_MINIMA) {
        throw invalido(
          `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
        );
      }
      const doAlvo = await fastify.naBarbearia(req, (c) =>
        permissoesDoUsuario(c, id),
      );
      if (!doAlvo)
        throw naoEncontrado('Usuário não encontrado nesta barbearia.');
      // Trocar a senha de alguém é assumir a conta: só de quem não tem mais acesso.
      exigirSoOQueTem(
        req,
        doAlvo,
        'Você não pode trocar a senha de quem tem permissões que você não tem.',
      );
      const {
        rows: [{ exclusivo }],
      } = await fastify.db.query(
        'select usuario_so_na_barbearia($1, $2) as exclusivo',
        [id, req.contexto.barbeariaId],
      );
      if (!exclusivo) {
        throw conflito(
          'Essa pessoa também acessa outra barbearia com esta conta. Ela mesma precisa trocar a senha em Meu perfil.',
        );
      }
      await fastify.db.query(
        'update usuarios set senha_hash = $2 where id = $1',
        [id, await gerarHashDeSenha(senha)],
      );
      await encerrarOutrasSessoes(fastify.db, id);
      return { ok: true };
    },
  );

  /** Remove o acesso à barbearia (a conta do usuário continua existindo). */
  fastify.delete('/usuarios/:id', acesso, async (req, reply) => {
    const id = Number(req.params.id);
    if (id === req.contexto.usuarioId)
      throw proibido('Você não pode remover o próprio acesso.');
    await fastify.naBarbearia(req, async (c) => {
      const {
        rows: [atual],
      } = await c.query(`${LISTAR} where u.id = $1`, [id]);
      if (!atual)
        throw naoEncontrado('Usuário não encontrado nesta barbearia.');
      exigirSoOQueTem(req, await permissoesDoUsuario(c, id), NAO_ALTERA);
      if (atual.dono && atual.ativo)
        await garantirDono(c, { removendoUsuario: id });
      await c.query('delete from vinculos where usuario_id = $1', [id]);
    });
    reply.code(204);
  });
}
