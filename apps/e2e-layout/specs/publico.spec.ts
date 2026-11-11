import { test, expect } from '../apoio/teste.ts';
import { APP } from '../apoio/urls.ts';

// Telas sem login: acesso e página pública de agendamento.
const TELAS = [
  ['entrar', '/entrar'],
  ['cadastro', '/cadastro'],
  ['esqueci-senha', '/esqueci-senha'],
  ['redefinir-senha', '/redefinir-senha'],
  ['agendar', '/agendar/barbearia-modelo'],
];

test.use({ baseURL: APP });

test.describe('telas públicas', () => {
  for (const [nome, rota] of TELAS) {
    test(nome, async ({ page, conferirLayout }) => {
      await page.goto(rota);
      await expect(page.locator('body')).not.toBeEmpty();
      await conferirLayout(`publico-${nome}`);
    });
  }
});
