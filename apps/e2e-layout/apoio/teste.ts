import { mkdirSync } from 'node:fs';
import { test as base, expect, type TestInfo } from '@playwright/test';

/**
 * test com a checagem de layout (ADR 0020):
 *  1. sem rolagem horizontal na página;
 *  2. nada passando da borda direita da janela sem um contêiner que role ou corte;
 *  3. texto que não cabe na própria caixa (vaza para fora dela);
 *  4. sem erro de JavaScript na página;
 *  5. captura de tela inteira em capturas/<largura>/<nome>.png.
 */
type MeusFixtures = {
  errosDaPagina: string[];
  conferirLayout: (nome: string) => Promise<void>;
};

export const test = base.extend<MeusFixtures>({
  errosDaPagina: async ({ page }, usar) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await usar(erros);
  },
  conferirLayout: async ({ page, errosDaPagina }, usar, info: TestInfo) => {
    await usar(async (nome: string) => {
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      const r = await page.evaluate(medirLayout);
      const pasta = new URL(
        `../capturas/${info.project.name}/`,
        import.meta.url,
      ).pathname;
      mkdirSync(pasta, { recursive: true });
      await page.screenshot({ path: `${pasta}${nome}.png`, fullPage: true });
      expect
        .soft(r.rolagem, `${nome}: rolagem horizontal (px)`)
        .toBeLessThanOrEqual(1);
      expect
        .soft(r.foraDaTela, `${nome}: elementos além da borda direita`)
        .toEqual([]);
      expect
        .soft(r.vazando, `${nome}: texto vazando da própria caixa`)
        .toEqual([]);
      expect.soft(errosDaPagina, `${nome}: erros de JavaScript`).toEqual([]);
    });
  },
});

export { expect };

/** Roda no navegador. Devolve o que quebra o layout, descrito para leitura. */
function medirLayout() {
  const largura = document.documentElement.clientWidth;
  const descrever = (el: Element): string => {
    const classe = [...el.classList]
      .filter((c) => !c.startsWith('v-'))
      .slice(0, 3)
      .join('.');
    const texto = (el.textContent ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    return `${el.tagName.toLowerCase()}${classe ? `.${classe}` : ''} "${texto}"`;
  };
  const visivel = (el: Element, cs: CSSStyleDeclaration): boolean =>
    cs.display !== 'none' &&
    cs.visibility !== 'hidden' &&
    el.getClientRects().length > 0;
  const cortadoPorAncestral = (el: Element): boolean => {
    for (
      let a = el.parentElement;
      a && a !== document.body;
      a = a.parentElement
    ) {
      const o = getComputedStyle(a);
      if (/(auto|scroll|hidden|clip)/.test(o.overflowX)) return true;
      if (o.position === 'fixed') return true;
    }
    return false;
  };

  const foraDaTela = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (!visivel(el, cs) || cs.position === 'fixed') continue;
    const ret = el.getBoundingClientRect();
    if (ret.width === 0 || ret.right <= largura + 1) continue;
    if (!cortadoPorAncestral(el)) foraDaTela.push(descrever(el));
  }

  const vazando = [];
  for (const el of document.body.querySelectorAll(
    'h1,h2,h3,h4,p,td,th,li,label,button,a',
  )) {
    const cs = getComputedStyle(el);
    if (!visivel(el, cs) || cs.display === 'inline') continue;
    if (cs.overflowX !== 'visible' || el.clientWidth === 0) continue;
    if (el.scrollWidth > el.clientWidth + 2) vazando.push(descrever(el));
  }

  return {
    rolagem: document.documentElement.scrollWidth - largura,
    // Só o elemento mais externo de cada vazamento interessa.
    foraDaTela: foraDaTela.slice(0, 8),
    vazando: vazando.slice(0, 8),
  };
}
