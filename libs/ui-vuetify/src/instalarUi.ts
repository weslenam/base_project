// Só o núcleo: classes utilitárias (pa-4, d-flex...) são proibidas nas telas.
import 'vuetify/styles/layers';
import 'vuetify/styles/core';
import { createVuetify } from 'vuetify';
import type { App } from 'vue';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import { pt } from 'vuetify/locale';
import { temas, TEMA_PADRAO } from '@barbertime/ui-tokens';

/** Converte as cores da identidade visual (ADR 0003) para o tema do Vuetify. */
type Tema = (typeof temas)[keyof typeof temas];

function temaVuetify({ escuro, cores }: Tema) {
  return {
    dark: escuro,
    colors: {
      primary: cores.cobre,
      'on-primary': cores['sobre-cobre'],
      secondary: cores.aco,
      success: cores.sucesso,
      warning: cores.ambar,
      'on-warning': cores['sobre-ambar'],
      error: cores.perigo,
      info: cores.aco,
      background: cores.concreto,
      'on-background': cores.grafite,
      surface: cores.placa,
      'on-surface': cores.grafite,
      'surface-variant': cores['placa-funda'],
      'on-surface-variant': cores.grafite,
    },
  };
}

/** Instância do Vuetify configurada com a identidade visual, pt-BR e ícones SVG. */
export function criarVuetify() {
  return createVuetify({
    theme: {
      defaultTheme: TEMA_PADRAO,
      themes: Object.fromEntries(
        Object.entries(temas).map(([nome, tema]) => [nome, temaVuetify(tema)]),
      ),
    },
    locale: { locale: 'pt', messages: { pt } },
    icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  });
}

/** Porta de entrada da lib: registra o framework de UI no app. */
export function instalarUi<T extends App>(app: T): T {
  app.use(criarVuetify());
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = temas[TEMA_PADRAO].id;
  }
  return app;
}
