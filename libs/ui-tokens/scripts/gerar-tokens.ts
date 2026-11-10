/**
 * Gera src/tokens.css e src/tokens.ts a partir de docs/identidade-visual/tokens.json
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
export const DESTINO_TS = fileURLToPath(
  new URL('../src/tokens.ts', import.meta.url),
);

/** Formato de docs/identidade-visual/tokens.json (só o que o gerador lê). */
interface TemaJson {
  id: string;
  name: string;
}
interface TokenPorTema {
  name: string;
  value: Record<string, string>;
}
interface TokenSimples {
  name: string;
  value: string;
}
interface EstiloJson {
  name: string;
  fontWeight: string | number;
  fontSize: string;
  lineHeight: string | number;
  letterSpacing?: string;
}
interface TipografiaJson {
  families: Record<string, string>;
  groups: { family: string; styles: EstiloJson[] }[];
}
export interface TokensJson {
  color: { themes: TemaJson[]; tokens: TokenPorTema[] };
  shadow: { tokens: TokenPorTema[] };
  spacing: { tokens: TokenSimples[] };
  radius: { tokens: TokenSimples[] };
  type: TipografiaJson;
}

const CABECALHO =
  'GERADO por libs/ui-tokens/scripts/gerar-tokens.ts a partir de docs/identidade-visual/tokens.json. Não edite.';

/** Nome em pt-BR usado na API (useTema): "Claro" → "claro". */
const nomeDoTema = (tema: TemaJson): string => tema.name.toLowerCase();

/** Variáveis tipográficas: --tipo-<estilo> (shorthand font) e --tipo-<estilo>-espacamento. */
function variaveisDeTipo(type: TipografiaJson): string[] {
  const linhas: string[] = [];
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

export function gerar(json: TokensJson): { css: string; ts: string } {
  const temas = json.color.themes;
  const [padrao, ...outros] = temas as [TemaJson, ...TemaJson[]];

  const blocoTema = (id: string) => [
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

  const ts = [
    `// ${CABECALHO}`,
    '',
    `export const TEMA_PADRAO = ${JSON.stringify(nomeDoTema(padrao))};`,
    '',
    ...Object.entries(dados).map(
      ([nome, valor]) =>
        `export const ${nome} = ${JSON.stringify(valor, null, 2)};\n`,
    ),
  ].join('\n');

  return { css, ts };
}

const executadoDireto = process.argv[1] === fileURLToPath(import.meta.url);
if (executadoDireto) {
  const { css, ts } = gerar(JSON.parse(readFileSync(ORIGEM, 'utf8')));
  writeFileSync(DESTINO_CSS, css);
  writeFileSync(DESTINO_TS, ts);
  console.log('tokens.css e tokens.ts gerados a partir de', ORIGEM);
}
