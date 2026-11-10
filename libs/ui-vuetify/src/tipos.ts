// Tipos públicos do contrato dos componentes Ds* (ADR 0022): as telas montam
// colunas, opções e passos com eles, sem nada do framework de UI.
import type { NomeDoIcone } from './icones.ts';

interface BaseDaColuna {
  titulo: string;
  alinhamento?: 'inicio' | 'centro' | 'fim';
  ordenavel?: boolean;
}

/**
 * Coluna do DsTabela. Com um campo da linha, `formatar` recebe o valor no tipo
 * desse campo; colunas só de slot (ex.: 'acoes') não têm `formatar`.
 */
export type ColunaDaTabela<L extends object = Record<string, unknown>> =
  | {
      [K in keyof L & string]: BaseDaColuna & {
        campo: K;
        formatar?: (valor: L[K], linha: L) => string;
      };
    }[keyof L & string]
  | (BaseDaColuna & { campo: string; formatar?: undefined });

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
