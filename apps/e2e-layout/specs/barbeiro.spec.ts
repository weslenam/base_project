import { test, expect } from '../apoio/teste.ts';
import { APP, ESTADO_BARBEIRO } from '../apoio/urls.ts';

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
    await page.getByLabel('Navegação principal').getByText('Agenda').click();
    await expect(page).toHaveURL(/\/agenda$/);
    await expect(page.getByText('Novo agendamento')).toBeVisible();
    await conferirLayout('app-barbeiro-agenda');
  });

  test('#18 (guarda): nome longo da barbearia não esconde as abas', async ({
    page,
    conferirLayout,
  }, info) => {
    test.skip(
      info.project.name === 'celular',
      'no celular as abas ficam no rodapé',
    );
    await page.route('**/api/auth/eu', async (rota) => {
      const resposta = await rota.fetch();
      const sessao = await resposta.json();
      sessao.barbearia.nome =
        'Barbearia e Salão do Zé Carlos da Vila Madalena e Pinheiros';
      await rota.fulfill({ response: resposta, json: sessao });
    });
    // Tablet estreito (o menor tamanho em que as abas ficam no cabeçalho).
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto('/balcao');
    const nav = page.getByLabel('Navegação principal');
    await expect(nav.getByText('Balcão')).toBeInViewport({ ratio: 1 });
    await expect(nav.getByText('Agenda')).toBeInViewport({ ratio: 1 });
    await conferirLayout('app-barbeiro-nome-longo');
  });

  test('outra tela volta para o balcão', async ({ page }) => {
    await page.goto('/clientes');
    await expect(page).toHaveURL(/\/balcao$/);
  });
});
