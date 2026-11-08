import nodemailer from 'nodemailer';

/**
 * Envio de e-mail (planejamento 0023). Em desenvolvimento o SMTP é o Mailpit
 * (http://localhost:8025); nos testes, a API recebe um correio falso em
 * `opts.correio`. Interface: `enviar({ para, assunto, texto })`.
 */
export function criarCorreioSmtp(url, remetente) {
  const transporte = nodemailer.createTransport(url);
  return {
    enviar: ({ para, assunto, texto }) =>
      transporte.sendMail({
        from: remetente,
        to: para,
        subject: assunto,
        text: texto,
      }),
  };
}
