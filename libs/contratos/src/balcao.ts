// Contratos do balcão (planejamento 0020; tipos no planejamento 0040, etapa 9).
import type {
  ConfigBarbearia,
  SituacaoDoBarbeiro,
  sugerirEncaixe,
} from '@barbertime/dominio';
import type { AtendimentoNaAgenda } from './agenda.ts';

/** Regras do balcão da barbearia (configurações). */
export type ConfigDoBalcao = ConfigBarbearia['balcao'];

/** Barbeiro no painel: situação de agora, quem atende e o próximo. */
export type BarbeiroNoBalcao = Omit<
  SituacaoDoBarbeiro,
  'atual' | 'reservados'
> & {
  usuarioId: number | null;
  atual: {
    id: number;
    clienteNome: string;
    servicoNome: string;
    comandaId: number | null;
  } | null;
  proximo: { id: number; inicio: string | null; clienteNome: string } | null;
  reservados: undefined;
};

/** Quem está na fila, com a previsão de espera. */
export type ItemDaFila = AtendimentoNaAgenda & {
  atrasado: boolean;
  esperaMin: number | null;
  barbeiroSugeridoId: number | null;
  podeAgora: boolean;
};

/** Serviço com as vendas dos últimos 90 dias (ordem dos atalhos). */
export interface ServicoDoBalcao {
  id: number;
  nome: string;
  duracao: number;
  preco: number;
  vendas: number;
}

/** `GET /balcao`: tudo do dia que o balcão precisa. */
export interface PainelDoBalcao {
  data: string;
  agora: string;
  config: ConfigDoBalcao;
  caixaAberto: boolean;
  barbeiros: BarbeiroNoBalcao[];
  fila: ItemDaFila[];
  proximos: AtendimentoNaAgenda[];
  atrasados: AtendimentoNaAgenda[];
  aCobrar: AtendimentoNaAgenda[];
  servicos: ServicoDoBalcao[];
}

type Sugestao = ReturnType<typeof sugerirEncaixe>;

/** `GET /balcao/encaixe`: quem pode agora e a espera com cada barbeiro. */
export interface EncaixeDoBalcao {
  porBarbeiro: (Sugestao['porBarbeiro'][number] & {
    barbeiroNome: string | undefined;
    estado: SituacaoDoBarbeiro['estado'] | undefined;
  })[];
  primeiroLivre:
    | (NonNullable<Sugestao['primeiroLivre']> & {
        barbeiroNome: string | undefined;
      })
    | null;
}
