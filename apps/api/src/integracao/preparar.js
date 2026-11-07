// Preparo global dos testes de integração: recria o banco barbertime_teste e aplica
// as migrações. Precisa do Postgres do Docker (docker compose up -d postgres).
import pg from 'pg';
import { config } from '../infra/config.js';
import { migrar } from '../infra/migrar.js';

const BANCO = 'barbertime_teste';
const trocarBanco = (url, banco) => {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
};

export default async function ({ provide }) {
  const admin = new pg.Client({
    connectionString: trocarBanco(config.databaseUrlMigracao, 'postgres'),
  });
  try {
    await admin.connect();
  } catch (erro) {
    throw new Error(
      `Postgres indisponível para os testes de integração (${erro.message}). Rode: docker compose up -d postgres`,
    );
  }
  await admin.query(`drop database if exists ${BANCO} with (force)`);
  await admin.query(`create database ${BANCO}`);
  await admin.end();

  const urlMigracao = trocarBanco(config.databaseUrlMigracao, BANCO);
  await migrar(urlMigracao);
  provide('urlApp', trocarBanco(config.databaseUrl, BANCO));
  provide('urlMigracao', urlMigracao);
}
