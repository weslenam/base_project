import { test, expect } from '../apoio/teste.js';
import { APP, ESTADO_APP } from '../apoio/urls.js';

// App das barbearias logado como Dono da barbearia modelo (semente).
// Telas de módulo inativo redirecionam: o teste registra e segue.
const TELAS = [
  ['balcao', '/balcao'],
  ['agenda', '/agenda'],
  ['caixa', '/caixa'],
  ['clientes', '/clientes'],
  ['equipe', '/equipe'],
  ['servicos', '/servicos'],
  ['produtos', '/produtos'],
  ['pacotes', '/pacotes'],
  ['fidelidade', '/fidelidade'],
  ['estoque', '/estoque'],
  ['compras', '/compras'],
  ['fornecedores', '/fornecedores'],
  ['configuracoes', '/configuracoes'],
  ['usuarios', '/usuarios'],
  ['papeis', '/papeis'],
  ['modulos', '/modulos'],
  ['perfil', '/perfil'],
];

test.use({ storageState: ESTADO_APP, baseURL: APP });

test.describe('app das barbearias', () => {
  for (const [nome, rota] of TELAS) {
    test(nome, async ({ page, conferirLayout }) => {
      await page.goto(rota);
      await page.waitForLoadState('networkidle');
      const destino = new URL(page.url()).pathname;
      test.skip(
        destino !== rota,
        `${rota} redirecionou para ${destino} (módulo inativo ou sem permissão)`,
      );
      await expect(page.locator('main')).toBeVisible();
      await conferirLayout(`app-${nome}`);
    });
  }

  test('menu lateral aberto', async ({ page, conferirLayout }, info) => {
    await page.goto('/agenda');
    await page.waitForLoadState('networkidle');
    if (info.project.name !== 'desktop')
      await page.getByRole('button', { name: 'Abrir menu' }).click();
    const menu = page
      .getByRole('navigation')
      .or(page.getByLabel('Menu principal'));
    await expect(menu.first()).toBeVisible();
    await expect(page.getByText('Operação', { exact: true })).toBeVisible();
    await conferirLayout('app-menu');
  });
});
