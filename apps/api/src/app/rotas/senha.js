import { createHash, randomBytes } from 'node:crypto';
import { invalido } from '../../infra/erros.js';
import { chaves } from '../../seguranca/limites.js';
import { gerarHashDeSenha, SENHA_MINIMA } from '../../seguranca/senha.js';
import { encerrarOutrasSessoes } from '../../seguranca/sessao.js';
import { corpo, TAM, texto } from '../esquemas.js';

/**
 * "Esqueci a senha" (planejamento 0023, ADRs 0010 e 0014). Ninguém troca a senha
 * de outra pessoa: quem esqueceu pede um link por e-mail.
 *  - A resposta é a mesma exista o e-mail ou não, e o e-mail sai sem esperar o
 *    envio (o tempo não revela quem tem conta).
 *  - Token de 32 bytes; só o sha256 fica no banco. Vale 1h e uma vez só; pedir
 *    outro invalida os anteriores.
 *  - O link leva o token no fragmento (#t=...): não vai ao servidor ao abrir a
 *    página, nem para logs ou Referer.
 *  - Redefinir derruba todas as sessões da pessoa.
 */
const VALIDADE_MS = 60 * 60 * 1000;
const hash = (token) => createHash('sha256').update(token).digest('hex');

export const RESPOSTA_ESQUECI = {
  ok: true,
  mensagem:
    'Se este e-mail tiver uma conta, enviamos um link para criar uma senha nova. Ele vale por 1 hora.',
};

export default async function (fastify, { correio, appUrl }) {
  const esqueci = {
    schema: corpo({ email: texto(TAM.email) }),
    preHandler: [
      fastify.limitar('esqueciPorIp', chaves.ip),
      fastify.limitar('esqueciPorEmail', chaves.email),
    ],
  };
  fastify.post('/auth/esqueci', esqueci, async (req) => {
    const email = String(req.body?.email ?? '').trim();
    const {
      rows: [usuario],
    } = await fastify.db.query(
      'select id, nome, email from usuarios where lower(email) = lower($1)',
      [email],
    );
    if (usuario) {
      const token = randomBytes(32).toString('base64url');
      await fastify.emTransacao(async (c) => {
        await c.query(
          'delete from redefinicoes_senha where usuario_id = $1 and usada_em is null',
          [usuario.id],
        );
        await c.query(
          'insert into redefinicoes_senha (id_hash, usuario_id, expira_em) values ($1, $2, $3)',
          [hash(token), usuario.id, new Date(Date.now() + VALIDADE_MS)],
        );
      });
      // Sem await: o tempo da resposta não depende do envio.
      Promise.resolve()
        .then(() =>
          correio.enviar({
            para: usuario.email,
            assunto: 'BarberTime: criar uma senha nova',
            texto: [
              `Olá, ${usuario.nome.trim().split(/\s+/)[0]}.`,
              '',
              'Recebemos um pedido para criar uma senha nova na sua conta do BarberTime.',
              `Abra o link abaixo (vale por 1 hora e uma vez só):`,
              '',
              `${appUrl}/redefinir-senha#t=${token}`,
              '',
              'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
            ].join('\n'),
          }),
        )
        .catch((erro) =>
          req.log.error({ err: erro }, 'falha ao enviar e-mail de redefinição'),
        );
    }
    return RESPOSTA_ESQUECI;
  });

  const redefinir = {
    schema: corpo({ token: texto(100), senha: texto(TAM.senha) }),
    preHandler: fastify.limitar('redefinirPorIp', chaves.ip),
  };
  fastify.post('/auth/redefinir', redefinir, async (req) => {
    const token = String(req.body?.token ?? '');
    const senha = String(req.body?.senha ?? '');
    if (senha.length < SENHA_MINIMA)
      throw invalido(
        `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
      );
    const novoHash = await gerarHashDeSenha(senha);
    await fastify.emTransacao(async (c) => {
      // Uso único e atômico: marca como usado e devolve o dono numa só operação.
      const {
        rows: [r],
      } = await c.query(
        `update redefinicoes_senha set usada_em = now()
          where id_hash = $1 and usada_em is null and expira_em > now()
      returning usuario_id as "usuarioId"`,
        [hash(token)],
      );
      if (!r)
        throw invalido(
          'Este link é inválido ou expirou. Peça um novo em "Esqueci minha senha".',
        );
      await c.query('update usuarios set senha_hash = $2 where id = $1', [
        r.usuarioId,
        novoHash,
      ]);
      await c.query(
        'delete from redefinicoes_senha where usuario_id = $1 and usada_em is null',
        [r.usuarioId],
      );
      await encerrarOutrasSessoes(c, r.usuarioId);
    });
    return {
      ok: true,
      mensagem: 'Senha criada. Entre com a senha nova.',
    };
  });
}
