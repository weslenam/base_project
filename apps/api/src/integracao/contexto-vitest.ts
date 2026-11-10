// Valores que o globalSetup (preparar.js) entrega aos testes de integração.
declare module 'vitest' {
  export interface ProvidedContext {
    urlApp: string;
    urlMigracao: string;
  }
}
export {};
