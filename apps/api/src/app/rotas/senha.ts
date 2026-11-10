import type { FastifyInstance } from 'fastify';
import { chaves } from '../../seguranca/limites.ts';
import { corpo, TAM, texto } from '../esquemas.ts';
import type { RespostaDaSenha } from '@barbertime/contratos';

/**
 * "Esqueci a senha" (planejamento 0023, ADRs 0010 e 0014). Ninguém troca a senha
 * de outra pessoa: quem esqueceu pede um link por e-mail. A resposta é a mesma
 * exista o e-mail ou não, e o e-mail sai sem esperar o envio (o tempo não
 * revela quem tem conta). O token e o envio ficam na identidade (ADR 0016).
 */
export const RESPOSTA_ESQUECI: RespostaDaSenha = {
  ok: true,
  mensagem:
    'Se este e-mail tiver uma conta, enviamos um link para criar uma senha nova. Ele vale por 1 hora.',
};

export default async function (fastify: FastifyInstance) {
  const esqueci = {
    schema: corpo({ email: texto(TAM.email) }),
    preHandler: [
      fastify.limitar('esqueciPorIp', chaves.ip),
      fastify.limitar('esqueciPorEmail', chaves.email),
    ],
  };
  fastify.post<{ Body: { email?: string | null } | undefined }>(
    '/auth/esqueci',
    esqueci,
    async (req): Promise<RespostaDaSenha> => {
      await fastify.identidade.pedirRedefinicao(req.body?.email, req.log);
      return RESPOSTA_ESQUECI;
    },
  );

  const redefinir = {
    schema: corpo({ token: texto(100), senha: texto(TAM.senha) }),
    preHandler: fastify.limitar('redefinirPorIp', chaves.ip),
  };
  fastify.post<{
    Body: { token?: string | null; senha?: string | null } | undefined;
  }>('/auth/redefinir', redefinir, async (req): Promise<RespostaDaSenha> => {
    await fastify.identidade.redefinirSenha(
      String(req.body?.token ?? ''),
      String(req.body?.senha ?? ''),
    );
    return {
      ok: true,
      mensagem: 'Senha criada. Entre com a senha nova.',
    };
  });
}
