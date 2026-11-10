// Preparo global dos testes de integração: recria o banco barbertime_teste e aplica
// as migrações SQL (supabase/migrations). Precisa do Postgres do Supabase local
// (pnpm supabase start) ou, como volta atrás, do compose.
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { config } from '../infra/config.ts';
import { migrar, prepararPapelDaAplicacao } from '../infra/migrar.ts';

const BANCO = 'barbertime_teste';
const trocarBanco = (url: string, banco: string): string => {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
};

export default async function ({ provide }: TestProject) {
  const admin = new pg.Client({
    connectionString: trocarBanco(config.databaseUrlMigracao, 'postgres'),
  });
  try {
    await admin.connect();
  } catch (erro) {
    throw new Error(
      `Postgres indisponível para os testes de integração (${(erro as Error).message}). Rode: pnpm supabase start`,
    );
  }
  await admin.query(`drop database if exists ${BANCO} with (force)`);
  await admin.query(`create database ${BANCO}`);
  await admin.end();

  const urlMigracao = trocarBanco(config.databaseUrlMigracao, BANCO);
  await migrar(urlMigracao);
  await prepararPapelDaAplicacao(urlMigracao, config.databaseUrl);
  provide('urlApp', trocarBanco(config.databaseUrl, BANCO));
  provide('urlMigracao', urlMigracao);
}
