import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Carrega o .env da raiz do workspace (ADR 0002), sem sobrescrever o ambiente.
const envRaiz = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(envRaiz)) process.loadEnvFile(envRaiz);

export const config = {
  producao: process.env.NODE_ENV === 'production',
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://barbertime_app:troque-me-app@localhost:5432/barbertime',
  databaseUrlMigracao:
    process.env.DATABASE_URL_MIGRACAO ??
    'postgres://postgres:troque-me-postgres@localhost:5432/barbertime',
  /**
   * Trava geral da página pública de agendamento (planejamento 0019): bloqueada
   * até a análise de segurança (limite de requisições etc.). Libere com
   * PAGINA_PUBLICA=liberada.
   */
  paginaPublicaLiberada: process.env.PAGINA_PUBLICA === 'liberada',
  /** Implementação da identidade (ADR 0016): "propria" (sessão e senha nossas). */
  auth: process.env.AUTH ?? 'propria',
  /** Validade da sessão em dias. */
  diasDeSessao: 30,
  /**
   * Atrás de proxy (nginx, balanceador), TRUST_PROXY=true faz o IP real valer
   * para o limite de requisições (ADR 0014). Desligado por padrão: sem proxy,
   * confiar no X-Forwarded-For deixaria qualquer um forjar o IP.
   */
  trustProxy: process.env.TRUST_PROXY === 'true',
  /** SMTP dos e-mails (recuperação de senha). No dev, o Mailpit do Docker. */
  smtpUrl: process.env.SMTP_URL ?? 'smtp://localhost:1025',
  remetente:
    process.env.EMAIL_REMETENTE ?? 'BarberTime <nao-responda@barbertime.local>',
  /** Endereço do app, para os links enviados por e-mail. */
  appUrl: process.env.APP_URL ?? 'http://localhost:4200',
};
