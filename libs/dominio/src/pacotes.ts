// Pacotes (planejamento 0015): por quantidade ou livres; recorrentes (mensais) ou de
// compra única com validade; limite de uso combinável: intervalo mínimo e/ou por semana.
import {
  diaEMes,
  diasEntre,
  inicioDaSemana,
  somarDias,
  somarMeses,
} from './agenda.ts';

/** Pacote de serviços (planejamento 0015). */
export interface Pacote {
  id?: number;
  nome: string;
  preco: number;
  tipo: 'recorrente' | 'unico' | string;
  validadeDias?: number | null;
  itens: {
    servicoId: number | null;
    servicoNome?: string;
    quantidade?: number | null;
  }[];
  limites?: {
    intervaloMinimoDias?: number | null;
    maximoPorSemana?: number | null;
  };
  excluido?: boolean;
}

/** Uso de um pacote numa data. */
export interface UsoDePacote {
  servicoId: number;
  data: string;
  comandaId?: number | null;
}

/** Pacote do cliente (um ciclo de vigência). */
export interface Assinatura {
  id?: number;
  inicio: string;
  fim: string;
  usos?: UsoDePacote[];
  cancelada?: boolean;
}

export const TIPOS_DE_PACOTE = Object.freeze([
  { valor: 'recorrente', rotulo: 'Recorrente (mensal)' },
  { valor: 'unico', rotulo: 'Compra única com validade' },
]);

const inteiroPositivo = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 1;

/** Motivo de pacote inválido, ou null. */
export function validarPacote(p: Pacote): string | null {
  if (!String(p.nome ?? '').trim()) return 'Informe o nome do pacote.';
  if (!(p.preco > 0)) return 'Informe o preço do pacote.';
  if (!TIPOS_DE_PACOTE.some((t) => t.valor === p.tipo))
    return 'Escolha o tipo do pacote.';
  if (p.tipo === 'unico' && !inteiroPositivo(p.validadeDias)) {
    return 'Informe a validade do pacote em dias.';
  }
  if (!p.itens?.length) return 'Inclua pelo menos um serviço no pacote.';
  for (const i of p.itens) {
    if (!i.servicoId) return 'Escolha o serviço de cada item.';
    if (i.quantidade != null && !inteiroPositivo(i.quantidade)) {
      return 'A quantidade precisa ser 1 ou mais (ou livre).';
    }
  }
  if (new Set(p.itens.map((i) => i.servicoId)).size !== p.itens.length) {
    return 'Cada serviço aparece uma vez só no pacote.';
  }
  const { intervaloMinimoDias, maximoPorSemana } = p.limites ?? {};
  if (intervaloMinimoDias != null && !inteiroPositivo(intervaloMinimoDias)) {
    return 'O intervalo mínimo precisa ser de 1 dia ou mais.';
  }
  if (maximoPorSemana != null && !inteiroPositivo(maximoPorSemana)) {
    return 'O máximo por semana precisa ser 1 ou mais.';
  }
  return null;
}

/** Vigência (datas inclusivas) de um ciclo que começa em `inicio`. */
export function vigenciaDoPacote(
  pacote: Pick<Pacote, 'tipo' | 'validadeDias'>,
  inicio: string,
): { inicio: string; fim: string } {
  const fim =
    pacote.tipo === 'recorrente'
      ? somarDias(somarMeses(inicio, 1), -1)
      : somarDias(inicio, Number(pacote.validadeDias) - 1);
  return { inicio, fim };
}

const usosDoCiclo = (assinatura: Assinatura): UsoDePacote[] =>
  (assinatura.usos ?? []).filter(
    (u) => u.data >= assinatura.inicio && u.data <= assinatura.fim,
  );

/** Por serviço: quantidade contratada (null = livre), usados no ciclo e restantes. */
export function saldoDoPacote(pacote: Pacote, assinatura: Assinatura) {
  const usos = usosDoCiclo(assinatura);
  return pacote.itens.map((i) => {
    const usados = usos.filter((u) => u.servicoId === i.servicoId).length;
    return {
      servicoId: i.servicoId,
      servicoNome: i.servicoNome,
      quantidade: i.quantidade ?? null,
      usados,
      restantes:
        i.quantidade == null ? null : Math.max(0, i.quantidade - usados),
    };
  });
}

/** Pode usar o pacote para o serviço na data? → { ok: true } | { ok: false, motivo } */
export function podeUsarPacote({
  pacote,
  assinatura,
  servicoId,
  data,
}: {
  pacote: Pacote;
  assinatura: Assinatura;
  servicoId: number;
  data: string;
}): { ok: boolean; motivo?: string } {
  if (assinatura.cancelada)
    return { ok: false, motivo: 'Este pacote foi cancelado.' };
  if (data < assinatura.inicio) {
    return {
      ok: false,
      motivo: `O pacote começa a valer em ${diaEMes(assinatura.inicio)}.`,
    };
  }
  if (data > assinatura.fim) {
    const renova =
      pacote.tipo === 'recorrente' ? ' Renove para continuar usando.' : '';
    return {
      ok: false,
      motivo: `O pacote ${pacote.nome} venceu em ${diaEMes(assinatura.fim)}.${renova}`,
    };
  }
  const item = pacote.itens.find((i) => i.servicoId === servicoId);
  if (!item)
    return {
      ok: false,
      motivo: `O pacote ${pacote.nome} não inclui este serviço.`,
    };

  const usos = usosDoCiclo(assinatura);
  const doServico = usos
    .filter((u) => u.servicoId === servicoId)
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  const nome = item.servicoNome ?? 'este serviço';

  if (item.quantidade != null && doServico.length >= item.quantidade) {
    return {
      ok: false,
      motivo: `Os ${item.quantidade} usos de ${nome} deste pacote já foram usados.`,
    };
  }

  const { intervaloMinimoDias, maximoPorSemana } = pacote.limites ?? {};
  const ultimo = doServico.at(-1);
  if (
    intervaloMinimoDias &&
    ultimo &&
    diasEntre(ultimo.data, data) < intervaloMinimoDias
  ) {
    const libera = somarDias(ultimo.data, intervaloMinimoDias);
    return {
      ok: false,
      motivo: `Próximo uso de ${nome} liberado em ${diaEMes(libera)}.`,
    };
  }
  if (maximoPorSemana) {
    const semana = inicioDaSemana(data);
    const naSemana = usos.filter(
      (u) => u.data >= semana && u.data <= somarDias(semana, 6),
    ).length;
    if (naSemana >= maximoPorSemana) {
      return {
        ok: false,
        motivo: `Limite de ${maximoPorSemana} ${maximoPorSemana > 1 ? 'usos' : 'uso'} por semana atingido. Libera em ${diaEMes(somarDias(semana, 7))}.`,
      };
    }
  }
  return { ok: true };
}

/** Novo ciclo de um pacote recorrente: começa no dia seguinte ao fim do atual; o saldo zera. */
export function renovarAssinatura<A extends Assinatura>(
  pacote: Pick<Pacote, 'tipo' | 'validadeDias'>,
  assinatura: A,
): A | null {
  if (pacote.tipo !== 'recorrente') return null;
  return {
    ...assinatura,
    ...vigenciaDoPacote(pacote, somarDias(assinatura.fim, 1)),
  };
}

/**
 * Vigência do ciclo renovado, contada quando a renovação é paga (planejamento
 * 0034, etapa B): ainda em vigor, começa no dia seguinte ao fim do atual (o
 * cliente não perde dias); já vencido, começa no dia do pagamento. Só o pacote
 * recorrente renova: o de compra única é vendido de novo (null).
 */
export function cicloDaRenovacao(
  pacote: Pick<Pacote, 'tipo' | 'validadeDias'>,
  anterior: { fim?: string | null },
  hoje: string,
): { inicio: string; fim: string } | null {
  if (pacote.tipo !== 'recorrente') return null;
  const inicio =
    anterior.fim && anterior.fim >= hoje ? somarDias(anterior.fim, 1) : hoje;
  return vigenciaDoPacote(pacote, inicio);
}
