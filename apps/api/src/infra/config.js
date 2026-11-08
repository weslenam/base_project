import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Carrega o .env da raiz do workspace (ADR 0002), sem sobrescrever o ambiente.
const envRaiz = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(envRaiz)) process.loadEnvFile(envRaiz);

export const config = {
  producao: process.env.NODE_ENV === 'production',
  /** Conexão da aplicação: papel barbertime_app, sujeito a RLS. */
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://barbertime_app:troque-me-app@localhost:5432/barbertime',
  /** Conexão das migrações: superusuário, dono das tabelas. */
  databaseUrlMigracao:
    process.env.DATABASE_URL_MIGRACAO ??
    'postgres://postgres:troque-me-postgres@localhost:5432/barbertime',
  /**
   * Trava geral da página pública de agendamento (planejamento 0019): bloqueada
   * até a análise de segurança (limite de requisições etc.). Libere com
   * PAGINA_PUBLICA=liberada.
   */
  paginaPublicaLiberada: process.env.PAGINA_PUBLICA === 'liberada',
  /** Validade da sessão em dias. */
  diasDeSessao: 30,
};
