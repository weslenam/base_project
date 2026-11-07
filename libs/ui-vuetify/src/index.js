// Implementação ativa do design system (Vuetify, ADR 0007).
// Porta de entrada única: tudo que os apps usam sai daqui.

/**
 * Registra o framework de UI e seus plugins no app.
 * Ainda vazio: o Vuetify entra junto com o kit base de componentes Ds*.
 */
export function instalarUi(app) {
  return app;
}
