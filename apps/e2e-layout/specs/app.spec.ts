import { test, expect } from '../apoio/teste.ts';
import { APP, ESTADO_APP } from '../apoio/urls.ts';

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
  ['financeiro-contas', '/financeiro/contas'],
  ['financeiro-cadastros', '/financeiro/cadastros'],
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

  test('convite com a história do papel', async ({ page, conferirLayout }) => {
    await page.goto('/usuarios');
    await page.getByRole('button', { name: 'Convidar usuário' }).click();
    await page.getByLabel('Nome').fill('Ana Souza');
    await page
      .getByRole('group', { name: 'Papel' })
      .getByRole('button', { name: /Recepção/ })
      .click();
    await expect(
      page.getByText('Como vai ser o dia de Ana como Recepção'),
    ).toBeVisible();
    await conferirLayout('app-convite');
  });

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
