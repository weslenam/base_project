/**
 * Gera src/tokens.css e src/tokens.js a partir de docs/identidade-visual/tokens.json
 * (fonte única da identidade visual, ADR 0003). Ninguém edita os arquivos gerados.
 *
 * Uso: pnpm nx run ui-tokens:gerar
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ORIGEM = fileURLToPath(
  new URL('../../../docs/identidade-visual/tokens.json', import.meta.url),
);
export const DESTINO_CSS = fileURLToPath(
  new URL('../src/tokens.css', import.meta.url),
);
export const DESTINO_JS = fileURLToPath(
  new URL('../src/tokens.js', import.meta.url),
);

const CABECALHO =
  'GERADO por libs/ui-tokens/scripts/gerar-tokens.mjs a partir de docs/identidade-visual/tokens.json. Não edite.';

/** Nome em pt-BR usado na API (useTema): "Claro" → "claro". */
const nomeDoTema = (tema) => tema.name.toLowerCase();

/** Variáveis tipográficas: --tipo-<estilo> (shorthand font) e --tipo-<estilo>-espacamento. */
function variaveisDeTipo(type) {
  const linhas = [];
  for (const grupo of type.groups) {
    for (const s of grupo.styles) {
      linhas.push(
        `  --tipo-${s.name}: ${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${grupo.family});`,
      );
      linhas.push(
        `  --tipo-${s.name}-espacamento: ${s.letterSpacing ?? 'normal'};`,
      );
    }
  }
  return linhas;
}

export function gerar(json) {
  const temas = json.color.themes;
  const [padrao, ...outros] = temas;

  const blocoTema = (id) => [
    ...json.color.tokens.map((t) => `  --${t.name}: ${t.value[id]};`),
    ...json.shadow.tokens.map((t) => `  --${t.name}: ${t.value[id]};`),
  ];

  const css = [
    `/* ${CABECALHO} */`,
    '',
    ':root {',
    ...Object.entries(json.type.families).map(
      ([nome, valor]) => `  --font-${nome}: ${valor};`,
    ),
    '',
    ...json.spacing.tokens.map((t) => `  --${t.name}: ${t.value};`),
    '',
    ...json.radius.tokens.map((t) => `  --${t.name}: ${t.value};`),
    '',
    ...variaveisDeTipo(json.type),
    '',
    `  /* tema ${padrao.name.toLowerCase()} (padrão) */`,
    ...blocoTema(padrao.id),
    '}',
    ...outros.flatMap((tema) => [
      '',
      `[data-theme='${tema.id}'] {`,
      ...blocoTema(tema.id),
      '}',
    ]),
    '',
  ].join('\n');

  const dados = {
    temas: Object.fromEntries(
      temas.map((tema) => [
        nomeDoTema(tema),
        {
          id: tema.id,
          escuro: tema.id === 'dark',
          cores: Object.fromEntries(
            json.color.tokens.map((t) => [t.name, t.value[tema.id]]),
          ),
        },
      ]),
    ),
    fontes: json.type.families,
    espacos: Object.fromEntries(
      json.spacing.tokens.map((t) => [t.name, t.value]),
    ),
    raios: Object.fromEntries(json.radius.tokens.map((t) => [t.name, t.value])),
  };

  const js = [
    `// ${CABECALHO}`,
    '',
    `export const TEMA_PADRAO = ${JSON.stringify(nomeDoTema(padrao))};`,
    '',
    ...Object.entries(dados).map(
      ([nome, valor]) =>
        `export const ${nome} = ${JSON.stringify(valor, null, 2)};\n`,
    ),
  ].join('\n');

  return { css, js };
}

const executadoDireto = process.argv[1] === fileURLToPath(import.meta.url);
if (executadoDireto) {
  const { css, js } = gerar(JSON.parse(readFileSync(ORIGEM, 'utf8')));
  writeFileSync(DESTINO_CSS, css);
  writeFileSync(DESTINO_JS, js);
  console.log('tokens.css e tokens.js gerados a partir de', ORIGEM);
}
