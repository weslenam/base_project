import { it, expect } from 'vitest';
import { createApp } from 'vue';

/** Contrato da porta de entrada: instalarUi(app) registra a lib sem falhar. */
export function testarInstalarUi(instalarUi) {
  it('instalarUi aceita um app Vue e o devolve', () => {
    const app = createApp({});
    expect(instalarUi(app)).toBe(app);
  });
}
