import { test, expect } from '../apoio/teste.js';
import { APP, ESTADO_BARBEIRO } from '../apoio/urls.js';

// Barbeiro da barbearia modelo (semente): só a Agenda, sem menu sanduíche
// (planejamento 0035).
test.use({ storageState: ESTADO_BARBEIRO, baseURL: APP });

test.describe('app logado como Barbeiro', () => {
  test('agenda sem menu', async ({ page, conferirLayout }) => {
    await page.goto('/agenda');
    await expect(page.getByText('Novo agendamento')).toBeVisible();
    await expect(page.getByLabel('Abrir menu')).toHaveCount(0);
    await conferirLayout('app-barbeiro-agenda');
  });

  test('outra tela volta para a agenda', async ({ page }) => {
    await page.goto('/clientes');
    await expect(page).toHaveURL(/\/agenda$/);
  });
});
