// Configurações da barbearia (planejamento 0017, ADR 0012): dados do negócio,
// não preferências de exibição. Catálogo fechado, usado pela API e pelo front.
import { BALCAO_PADRAO } from './balcao.ts';

/** 0 = domingo ... 6 = sábado (igual a Date#getDay). */
export const DIAS_DA_SEMANA = Object.freeze([
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
]);

/** Horário de um dia da semana (0 = domingo). */
export interface DiaDeFuncionamento {
  dia: number;
  aberto: boolean;
  abre: string;
  fecha: string;
}

/** Configurações da barbearia (ADR 0012). */
export interface ConfigBarbearia {
  contato: { telefone: string | null; endereco: string; instagram: string };
  funcionamento: DiaDeFuncionamento[];
  agendamento: {
    antecedenciaMinimaHoras: number;
    diasAFrente: number;
    cancelamentoAteHoras: number;
  };
  paginaPublica: { modo: string };
  balcao: typeof BALCAO_PADRAO;
}

/** Configuração gravada: pode vir parcial (antiga ou vazia). */
export type ConfigBarbeariaGravada = {
  contato?: Partial<ConfigBarbearia['contato']>;
  funcionamento?: Partial<DiaDeFuncionamento>[];
  agendamento?: Partial<ConfigBarbearia['agendamento']>;
  paginaPublica?: Partial<ConfigBarbearia['paginaPublica']>;
  balcao?: Partial<ConfigBarbearia['balcao']>;
} | null;

export const CONFIG_BARBEARIA_PADRAO: Readonly<ConfigBarbearia> = Object.freeze(
  {
    contato: { telefone: null, endereco: '', instagram: '' },
    funcionamento: DIAS_DA_SEMANA.map((_, dia) => ({
      dia,
      aberto: dia !== 0,
      abre: '09:00',
      fecha: dia === 6 ? '17:00' : '19:00',
    })),
    agendamento: {
      antecedenciaMinimaHoras: 2,
      diasAFrente: 30,
      cancelamentoAteHoras: 2,
    },
    /** publica | com_link (exige o token do link) | desativada (ADR 0013). Começa desativada. */
    paginaPublica: { modo: 'desativada' },
    /** Balcão (planejamento 0020): folga entre atendimentos, tolerância de atraso. */
    balcao: { ...BALCAO_PADRAO },
  },
);

export const MODOS_DA_PAGINA_PUBLICA = Object.freeze([
  {
    valor: 'publica',
    rotulo: 'Pública',
    descricao:
      'Qualquer pessoa com o endereço agenda. Bom para Instagram e Google.',
  },
  {
    valor: 'com_link',
    rotulo: 'Só com o link',
    descricao:
      'O endereço leva um código. Quem não tem o link não encontra a página. Dá para trocar o código e invalidar o link antigo.',
  },
  {
    valor: 'desativada',
    rotulo: 'Desativada',
    descricao: 'Ninguém agenda pela internet; só a recepção marca.',
  },
]);

/** Data (AAAA-MM-DD) e hora (HH:MM) de um instante no fuso da barbearia. */
export function momentoNoFuso(
  instante = new Date(),
  fuso = 'America/Sao_Paulo',
) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  );
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

const minutos = (h: string): number =>
  Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hhmm = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Janela em que o cliente pode marcar pela página pública num dia, ou null:
 * dia fechado, dia passado, além do limite de dias à frente. Junta o horário da
 * barbearia, o expediente do barbeiro e a antecedência mínima.
 * Devolve { inicio, fim, aPartirDe? } para usar em horariosLivres.
 */
export function janelaDoAgendamentoOnline({
  config,
  barbeiro,
  data,
  agora,
}: {
  config: ConfigBarbeariaGravada;
  barbeiro: { inicio: string; fim: string };
  data: string;
  agora: { data: string; hora: string };
}): { inicio: string; fim: string; aPartirDe?: string } | null {
  const c = mesclarConfigBarbearia(config);
  if (data < agora.data) return null;
  const limite = new Date(`${agora.data}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + c.agendamento.diasAFrente);
  if (data > limite.toISOString().slice(0, 10)) return null;
  const dia = c.funcionamento.find(
    (d) => d.dia === new Date(`${data}T12:00:00Z`).getUTCDay(),
  );
  if (!dia?.aberto) return null;
  const inicio = hhmm(Math.max(minutos(dia.abre), minutos(barbeiro.inicio)));
  const fim = hhmm(Math.min(minutos(dia.fecha), minutos(barbeiro.fim)));
  if (inicio >= fim) return null;
  // Antecedência: conta a partir de agora; pode cair num dia seguinte.
  const antecede =
    minutos(agora.hora) + c.agendamento.antecedenciaMinimaHoras * 60;
  const diasDepois = Math.round(
    (new Date(`${data}T12:00:00Z`).getTime() -
      new Date(`${agora.data}T12:00:00Z`).getTime()) /
      86_400_000,
  );
  const aPartirDeMin = antecede - diasDepois * 1440;
  if (aPartirDeMin >= minutos(fim)) return null;
  return aPartirDeMin > minutos(inicio)
    ? { inicio, fim, aPartirDe: hhmm(aPartirDeMin) }
    : { inicio, fim };
}

export const LIMITES_DO_AGENDAMENTO = Object.freeze({
  antecedenciaMinimaHoras: { min: 0, max: 72 },
  diasAFrente: { min: 1, max: 180 },
  cancelamentoAteHoras: { min: 0, max: 72 },
});

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const INSTAGRAM = /^@?[A-Za-z0-9._]{1,30}$/;
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Completa o que vier gravado com os padrões (configuração antiga ou vazia). */
export function mesclarConfigBarbearia(
  gravada: ConfigBarbeariaGravada = {},
): ConfigBarbearia {
  const p = copia(CONFIG_BARBEARIA_PADRAO);
  const g = gravada ?? {};
  return {
    contato: { ...p.contato, ...(g.contato ?? {}) },
    funcionamento: p.funcionamento.map((padrao) => ({
      ...padrao,
      ...((g.funcionamento ?? []).find((d) => d?.dia === padrao.dia) ?? {}),
    })),
    agendamento: { ...p.agendamento, ...(g.agendamento ?? {}) },
    paginaPublica: { ...p.paginaPublica, ...(g.paginaPublica ?? {}) },
    balcao: { ...p.balcao, ...(g.balcao ?? {}) },
  };
}

/** Motivo de configuração inválida, ou null. */
export function validarConfigBarbearia({
  contato,
  funcionamento,
  agendamento,
  paginaPublica,
  balcao,
}: ConfigBarbeariaGravada & object = {}): string | null {
  if (!contato || !Array.isArray(funcionamento) || !agendamento) {
    return 'Configuração incompleta.';
  }
  const tel = contato.telefone;
  if (tel != null && tel !== '' && !/^\d{10,11}$/.test(String(tel))) {
    return 'Telefone inválido: use DDD + número.';
  }
  if (String(contato.endereco ?? '').length > 200) {
    return 'O endereço pode ter até 200 caracteres.';
  }
  const insta = String(contato.instagram ?? '').trim();
  if (insta && !INSTAGRAM.test(insta)) {
    return 'Instagram inválido: use só letras, números, ponto e sublinhado.';
  }

  if (funcionamento.length !== 7)
    return 'Informe o horário dos 7 dias da semana.';
  for (const d of funcionamento) {
    const nome = DIAS_DA_SEMANA[d?.dia ?? -1];
    if (!nome) return 'Dia da semana inválido.';
    if (!d.aberto) continue;
    if (!HORA.test(d.abre ?? '') || !HORA.test(d.fecha ?? '')) {
      return `${nome}: informe abertura e fechamento (HH:MM).`;
    }
    if ((d.abre ?? '') >= (d.fecha ?? ''))
      return `${nome}: o fechamento precisa ser depois da abertura.`;
  }
  if (new Set(funcionamento.map((d) => d.dia)).size !== 7) {
    return 'Cada dia da semana aparece uma vez só.';
  }
  if (!funcionamento.some((d) => d.aberto)) {
    return 'A barbearia precisa abrir em pelo menos um dia.';
  }

  const modo = paginaPublica?.modo;
  if (modo && !MODOS_DA_PAGINA_PUBLICA.some((m) => m.valor === modo)) {
    return 'Modo da página pública inválido.';
  }

  if (balcao) {
    const { folgaMinutos: f, toleranciaMinutos: t } = balcao;
    if (!(Number.isInteger(f) && Number(f) >= 0 && Number(f) <= 60))
      return 'A folga entre atendimentos precisa ficar entre 0 e 60 minutos.';
    if (!(Number.isInteger(t) && Number(t) >= 0 && Number(t) <= 60))
      return 'A tolerância de atraso precisa ficar entre 0 e 60 minutos.';
  }

  const rotulos: Record<string, string> = {
    antecedenciaMinimaHoras: 'A antecedência mínima',
    diasAFrente: 'O limite de dias à frente',
    cancelamentoAteHoras: 'O prazo de cancelamento',
  };
  for (const [campo, { min, max }] of Object.entries(LIMITES_DO_AGENDAMENTO)) {
    const v = (agendamento as Record<string, unknown>)[campo];
    if (!(Number.isInteger(v) && Number(v) >= min && Number(v) <= max)) {
      return `${rotulos[campo]} precisa ser um número inteiro entre ${min} e ${max}.`;
    }
  }
  return null;
}
