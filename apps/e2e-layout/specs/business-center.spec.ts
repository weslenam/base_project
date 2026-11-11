import { test, expect } from '../apoio/teste.ts';
import { BC, ESTADO_BC } from '../apoio/urls.ts';

test.use({ baseURL: BC });

test.describe('Business Center', () => {
  test('entrar', async ({ page, conferirLayout }) => {
    await page.goto('/entrar');
    await expect(page.getByLabel('Código do autenticador')).toBeVisible();
    await conferirLayout('bc-entrar');
  });

  test.describe('logado', () => {
    test.use({ storageState: ESTADO_BC });

    test('lista de barbearias', async ({ page, conferirLayout }) => {
      await page.goto('/barbearias');
      await expect(page.getByText('Barbearia do Zé').first()).toBeVisible();
      await conferirLayout('bc-barbearias');
    });

    test('painel da barbearia', async ({ page, request, conferirLayout }) => {
      const lista = (await (
        await request.get(`${BC}/api/plataforma/barbearias`)
      ).json()) as Array<{ id: number; slug: string }>;
      const modelo = lista.find((b) => b.slug === 'barbearia-modelo');
      if (!modelo) throw new Error('Barbearia modelo não encontrada');
      await page.goto(`/barbearias/${modelo.id}`);
      await expect(page.getByLabel('Indicadores do mês')).toBeVisible();
      await conferirLayout('bc-painel');
    });
  });
});
