import type {
  BarbeariaNaLista,
  EmJson,
  MudancaDeModulo,
  OperadorPublico,
  PainelDaBarbearia,
  TransferenciaDeDono,
} from '@barbertime/contratos';
import { http } from './http.ts';

// API do Business Center (planejamento 0028): tudo sob /api/plataforma.
// Respostas tipadas pelos contratos da API, como chegam pelo JSON.
const base = '/api/plataforma';

export type BarbeariaDaLista = EmJson<BarbeariaNaLista>;
export type Painel = EmJson<PainelDaBarbearia>;
export type Operador = OperadorPublico;

/** Ação sobre um módulo da barbearia. */
export type AcaoDeModulo = 'confirmar_contratacao' | 'ativar' | 'desativar';

export const plataforma = {
  entrar: (email: string, senha: string, codigo: string) =>
    http<{ operador: Operador }>('POST', `${base}/auth/entrar`, {
      email,
      senha,
      codigo,
    }),
  sair: () => http<null>('POST', `${base}/auth/sair`),
  eu: () => http<{ operador: Operador }>('GET', `${base}/auth/eu`),
  barbearias: () => http<BarbeariaDaLista[]>('GET', `${base}/barbearias`),
  barbearia: (id: number) => http<Painel>('GET', `${base}/barbearias/${id}`),
  modulo: (id: number, chave: string, acao: AcaoDeModulo, motivo: string) =>
    http<MudancaDeModulo>(
      'POST',
      `${base}/barbearias/${id}/modulos/${chave}/${acao}`,
      { motivo },
    ),
  suspender: (id: number, motivo: string) =>
    http<unknown>('POST', `${base}/barbearias/${id}/suspender`, { motivo }),
  reativar: (id: number, motivo: string) =>
    http<unknown>('POST', `${base}/barbearias/${id}/reativar`, { motivo }),
  transferirDono: (id: number, usuarioId: number, motivo: string) =>
    http<TransferenciaDeDono>('POST', `${base}/barbearias/${id}/dono`, {
      usuarioId,
      motivo,
    }),
};
