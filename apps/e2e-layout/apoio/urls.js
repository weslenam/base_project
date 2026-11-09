export const APP = process.env.APP_URL ?? 'http://localhost:4200';
export const BC = process.env.BC_URL ?? 'http://localhost:4300';
export const ESTADO_APP = new URL('../.estado/app.json', import.meta.url)
  .pathname;
export const ESTADO_BC = new URL('../.estado/bc.json', import.meta.url)
  .pathname;
export const ESTADO_BARBEIRO = new URL('../.estado/barbeiro.json', import.meta.url)
  .pathname;
