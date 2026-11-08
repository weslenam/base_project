// Configurações da barbearia (planejamento 0017, ADR 0012): dados do negócio,
// não preferências de exibição. Catálogo fechado, usado pela API e pelo front.

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

export const CONFIG_BARBEARIA_PADRAO = Object.freeze({
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
});

export const LIMITES_DO_AGENDAMENTO = Object.freeze({
  antecedenciaMinimaHoras: { min: 0, max: 72 },
  diasAFrente: { min: 1, max: 180 },
  cancelamentoAteHoras: { min: 0, max: 72 },
});

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const INSTAGRAM = /^@?[A-Za-z0-9._]{1,30}$/;
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const copia = (v) => JSON.parse(JSON.stringify(v));

/** Completa o que vier gravado com os padrões (configuração antiga ou vazia). */
export function mesclarConfigBarbearia(gravada = {}) {
  const p = copia(CONFIG_BARBEARIA_PADRAO);
  const g = gravada ?? {};
  return {
    contato: { ...p.contato, ...(g.contato ?? {}) },
    funcionamento: p.funcionamento.map((padrao) => ({
      ...padrao,
      ...((g.funcionamento ?? []).find((d) => d?.dia === padrao.dia) ?? {}),
    })),
    agendamento: { ...p.agendamento, ...(g.agendamento ?? {}) },
  };
}

/** Motivo de configuração inválida, ou null. */
export function validarConfigBarbearia({
  contato,
  funcionamento,
  agendamento,
} = {}) {
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
    const nome = DIAS_DA_SEMANA[d?.dia];
    if (!nome) return 'Dia da semana inválido.';
    if (!d.aberto) continue;
    if (!HORA.test(d.abre ?? '') || !HORA.test(d.fecha ?? '')) {
      return `${nome}: informe abertura e fechamento (HH:MM).`;
    }
    if (d.abre >= d.fecha)
      return `${nome}: o fechamento precisa ser depois da abertura.`;
  }
  if (new Set(funcionamento.map((d) => d.dia)).size !== 7) {
    return 'Cada dia da semana aparece uma vez só.';
  }
  if (!funcionamento.some((d) => d.aberto)) {
    return 'A barbearia precisa abrir em pelo menos um dia.';
  }

  const rotulos = {
    antecedenciaMinimaHoras: 'A antecedência mínima',
    diasAFrente: 'O limite de dias à frente',
    cancelamentoAteHoras: 'O prazo de cancelamento',
  };
  for (const [campo, { min, max }] of Object.entries(LIMITES_DO_AGENDAMENTO)) {
    const v = agendamento[campo];
    if (!(Number.isInteger(v) && v >= min && v <= max)) {
      return `${rotulos[campo]} precisa ser um número inteiro entre ${min} e ${max}.`;
    }
  }
  return null;
}
