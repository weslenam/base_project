import nodemailer from 'nodemailer';

/**
 * Envio de e-mail (planejamento 0023). Em desenvolvimento o SMTP é o Mailpit
 * (http://localhost:8025); nos testes, a API recebe um correio falso em
 * `opts.correio`. Interface: `enviar({ para, assunto, texto })`.
 */
/** Mensagem de e-mail em texto simples. */
export interface Mensagem {
  para: string;
  assunto: string;
  texto: string;
}

/** O que a API precisa de um correio (SMTP de verdade ou falso nos testes). */
export interface Correio {
  enviar: (mensagem: Mensagem) => Promise<unknown>;
}

export function criarCorreioSmtp(url: string, remetente: string): Correio {
  const transporte = nodemailer.createTransport(url);
  return {
    enviar: ({ para, assunto, texto }: Mensagem) =>
      transporte.sendMail({
        from: remetente,
        to: para,
        subject: assunto,
        text: texto,
      }),
  };
}
