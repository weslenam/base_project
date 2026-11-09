import { test, expect } from '../apoio/teste.js';
import { APP, ESTADO_BARBEIRO } from '../apoio/urls.js';

// Barbeiro da barbearia modelo (semente): abas Balcão e Agenda, sem menu
// sanduíche; entra pelo Balcão (planejamentos 0035 e 0036).
test.use({ storageState: ESTADO_BARBEIRO, baseURL: APP });

test.describe('app logado como Barbeiro', () => {
  test('balcão com abas', async ({ page, conferirLayout }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/balcao$/);
    await expect(page.getByLabel('Navegação principal')).toBeVisible();
    await expect(page.getByLabel('Abrir menu')).toHaveCount(0);
    await conferirLayout('app-barbeiro-balcao');
  });

  test('agenda pela aba', async ({ page, conferirLayout }) => {
    await page.goto('/balcao');
    await page
      .getByLabel('Navegação principal')
      .getByText('Agenda')
      .click();
    await expect(page).toHaveURL(/\/agenda$/);
    await expect(page.getByText('Novo agendamento')).toBeVisible();
    await conferirLayout('app-barbeiro-agenda');
  });

  test('outra tela volta para o balcão', async ({ page }) => {
    await page.goto('/clientes');
    await expect(page).toHaveURL(/\/balcao$/);
  });
});
