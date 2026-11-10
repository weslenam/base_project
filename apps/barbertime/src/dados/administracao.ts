import type {
  BarbeariaConfigurada,
  EmJson,
  ModuloDaBarbearia,
  PapelDaBarbearia,
  UsuarioDaBarbearia,
} from '@barbertime/contratos';
import { http } from './http.ts';
import type { Corpo } from './tipos.ts';

/** Chamadas da administração (planejamentos 0013 e 0017). Já falam com a API real. */
export const administracao = {
  usuarios: {
    listar: () => http<EmJson<UsuarioDaBarbearia>[]>('GET', '/api/usuarios'),
    convidar: (dados: Corpo) =>
      http<EmJson<UsuarioDaBarbearia>>('POST', '/api/usuarios', dados),
    alterar: (id: number, dados: Corpo) =>
      http<EmJson<UsuarioDaBarbearia>>('PUT', `/api/usuarios/${id}`, dados),
    remover: (id: number) => http<unknown>('DELETE', `/api/usuarios/${id}`),
  },
  barbearia: {
    obter: () => http<EmJson<BarbeariaConfigurada>>('GET', '/api/barbearia'),
    salvar: (dados: Corpo) =>
      http<EmJson<BarbeariaConfigurada>>('PUT', '/api/barbearia', dados),
    /** Novo código do link "só com o link": o antigo deixa de funcionar. */
    novoCodigo: () =>
      http<EmJson<BarbeariaConfigurada>>('POST', '/api/barbearia/token'),
  },
  papeis: {
    listar: () => http<EmJson<PapelDaBarbearia>[]>('GET', '/api/papeis'),
  },
  modulos: {
    listar: () => http<EmJson<ModuloDaBarbearia>[]>('GET', '/api/modulos'),
    executar: (chave: string, acao: string) =>
      http<EmJson<ModuloDaBarbearia>>('POST', `/api/modulos/${chave}/${acao}`),
  },
};
