// Tipos públicos do contrato dos componentes Ds* (ADR 0022): as telas montam
// colunas, opções e passos com eles, sem nada do framework de UI.
import type { NomeDoIcone } from './icones.ts';

/** Coluna do DsTabela. */
export interface ColunaDaTabela<L extends object = Record<string, unknown>> {
  campo: string;
  titulo: string;
  alinhamento?: 'inicio' | 'centro' | 'fim';
  ordenavel?: boolean;
  formatar?: (valor: unknown, linha: L) => string;
}

/** Opção do DsSelect. */
export interface OpcaoDeSelect {
  valor: string | number | boolean;
  rotulo: string;
}

/** Opção do DsEscolha. */
export interface OpcaoDeEscolha {
  valor: string | number | boolean | null;
  rotulo: string;
  /** Segunda linha (ex.: "30 min · R$ 45,00"). */
  detalhe?: string;
  desabilitado?: boolean;
}

/** Horário do DsHorarios. */
export interface OpcaoDeHorario {
  hora: string;
  disponivel: boolean;
}

/** Etapa do DsPassos. */
export interface Passo {
  rotulo: string;
  /** Aparece sob a etapa concluída. */
  resumo?: string;
}

/** Aba do DsAbas. */
export interface Aba {
  valor: string | number;
  rotulo: string;
}

/** Item do menu lateral do DsLayout. */
export interface ItemDoMenu {
  titulo: string;
  rota: string;
  /** Nome do catálogo do DsIcone. */
  icone?: NomeDoIcone;
  grupo?: string;
}

/** Título de um grupo do menu lateral. */
export interface GrupoDoMenu {
  titulo: string;
  icone?: NomeDoIcone;
}

/** Aba de navegação do DsLayout (no lugar do menu lateral). */
export interface AbaDeNavegacao {
  titulo: string;
  rota: string;
  icone?: NomeDoIcone;
}
