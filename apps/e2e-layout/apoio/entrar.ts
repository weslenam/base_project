import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { request } from '@playwright/test';
import { codigoDoPasso, passoAtual } from './totp.ts';
import { APP, BC, ESTADO_APP, ESTADO_BARBEIRO, ESTADO_BC } from './urls.ts';

// Login uma vez por execução, com as contas da semente de desenvolvimento
// (apps/api/scripts/semear.ts). SÓ DESENVOLVIMENTO.
const DONO = { email: 'dono@barbertime.dev', senha: 'barbertime123' };
const BARBEIRO = { email: 'barbeiro@barbertime.dev', senha: 'barbertime123' };
const OPERADOR = {
  email: 'operador@barbertime.dev',
  senha: 'barbertime-operador',
  segredo: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
};

/**
 * Sessão salva ainda válida? Reaproveita: rodar a suíte várias vezes seguidas
 * não esbarra no limite de logins por e-mail (ADR 0014) nem no TOTP de uso único.
 */
async function sessaoValida(baseURL: string, estado: string, rota: string): Promise<boolean> {
  if (!existsSync(estado)) return false;
  const ctx = await request.newContext({ baseURL, storageState: estado });
  const ok = (await ctx.get(rota)).ok();
  await ctx.dispose();
  return ok;
}

async function entrarNoApp(conta = DONO, estado = ESTADO_APP): Promise<void> {
  if (await sessaoValida(APP, estado, '/api/auth/eu')) return;
  const ctx = await request.newContext({ baseURL: APP });
  const r = await ctx.post('/api/auth/entrar', { data: conta });
  if (!r.ok())
    throw new Error(
      `Login de ${conta.email} falhou (${r.status()}). O ambiente está no ar (pnpm dev) e semeado (api:semear)?`,
    );
  await ctx.storageState({ path: estado });
  await ctx.dispose();
}

async function entrarNoBusinessCenter(): Promise<void> {
  if (await sessaoValida(BC, ESTADO_BC, '/api/plataforma/auth/eu')) return;
  const ctx = await request.newContext({ baseURL: BC });
  // O mesmo código não vale duas vezes: se o atual já foi usado (outra
  // execução no mesmo intervalo de 30s), tenta o do próximo passo.
  let r: Awaited<ReturnType<typeof ctx.post>> | undefined;
  for (const passo of [passoAtual(), passoAtual() + 1]) {
    r = await ctx.post('/api/plataforma/auth/entrar', {
      data: {
        email: OPERADOR.email,
        senha: OPERADOR.senha,
        codigo: codigoDoPasso(OPERADOR.segredo, passo),
      },
    });
    if (r.ok()) break;
  }
  if (!r?.ok()) throw new Error(`Login do operador falhou (${r?.status()}).`);
  await ctx.storageState({ path: ESTADO_BC });
  await ctx.dispose();
}

export default async function entrar() {
  mkdirSync(dirname(ESTADO_APP), { recursive: true });
  await Promise.all([
    entrarNoApp(),
    // Barbeiro: só a Agenda, sem menu (planejamento 0035).
    entrarNoApp(BARBEIRO, ESTADO_BARBEIRO),
    entrarNoBusinessCenter(),
  ]);
}
