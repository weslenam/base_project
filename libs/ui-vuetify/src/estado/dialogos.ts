import { ref } from 'vue';
import type { NomeDoIcone } from '../icones.ts';

/** Os três diálogos padronizados. */
export type TipoDeDialogo = 'confirmacao' | 'advertencia' | 'negacao';

/** Opções de um diálogo; `perigo` só vale no confirmar. */
export interface OpcoesDeDialogo {
  titulo?: string;
  textoOk?: string;
  textoCancelar?: string;
  perigo?: boolean;
}

interface PadraoDeDialogo {
  titulo: string;
  textoOk: string;
  textoCancelar: string | null;
  icone: NomeDoIcone;
}

/** Diálogo na fila do DsApp. */
export interface DialogoNaFila {
  tipo: TipoDeDialogo;
  mensagem: string;
  titulo: string;
  textoOk: string;
  textoCancelar: string | null;
  icone: NomeDoIcone;
  perigo: boolean;
  resolver: (resposta: boolean | undefined) => void;
}

/**
 * Diálogos padronizados (planejamento 0006). O DsApp mostra o primeiro da fila.
 * - confirmacao: pergunta sim/não → true/false
 * - advertencia: alerta antes de seguir → true (continuar) / false (voltar)
 * - negacao: ação recusada, só informa → undefined
 */
export const PADROES_DE_DIALOGO: Readonly<
  Record<TipoDeDialogo, PadraoDeDialogo>
> = Object.freeze({
  confirmacao: {
    titulo: 'Confirmação',
    textoOk: 'Confirmar',
    textoCancelar: 'Cancelar',
    icone: 'info',
  },
  advertencia: {
    titulo: 'Atenção',
    textoOk: 'Continuar',
    textoCancelar: 'Voltar',
    icone: 'alerta',
  },
  negacao: {
    titulo: 'Não foi possível',
    textoOk: 'Entendi',
    textoCancelar: null,
    icone: 'bloqueio',
  },
});

export const filaDialogos = ref<DialogoNaFila[]>([]);

/** Negação só informa (undefined); confirmação e advertência respondem sim/não. */
export function abrirDialogo(
  tipo: 'negacao',
  mensagem: string,
  opcoes?: OpcoesDeDialogo,
): Promise<undefined>;
export function abrirDialogo(
  tipo: 'confirmacao' | 'advertencia',
  mensagem: string,
  opcoes?: OpcoesDeDialogo,
): Promise<boolean>;
export function abrirDialogo(
  tipo: TipoDeDialogo,
  mensagem: string,
  opcoes: OpcoesDeDialogo = {},
): Promise<boolean | undefined> {
  const padrao = PADROES_DE_DIALOGO[tipo];
  return new Promise((resolver) => {
    filaDialogos.value.push({
      tipo,
      mensagem,
      titulo: opcoes.titulo ?? padrao.titulo,
      textoOk: opcoes.textoOk ?? padrao.textoOk,
      textoCancelar:
        tipo === 'negacao'
          ? null
          : (opcoes.textoCancelar ?? padrao.textoCancelar),
      icone: padrao.icone,
      perigo: tipo === 'confirmacao' && Boolean(opcoes.perigo),
      resolver,
    });
  });
}

export function responderDialogo(resposta: boolean): void {
  const [atual, ...resto] = filaDialogos.value;
  if (!atual) return;
  filaDialogos.value = resto;
  atual.resolver(atual.tipo === 'negacao' ? undefined : resposta);
}

/** Fecha todos os diálogos pendentes (ex.: o DsApp saiu da tela). Respondem como "cancelar". */
export function descartarDialogos(): void {
  const pendentes = filaDialogos.value;
  filaDialogos.value = [];
  for (const d of pendentes)
    d.resolver(d.tipo === 'negacao' ? undefined : false);
}
