import { ErroDeNegocio } from './erros.ts';
import { http } from './http.ts';
import type { EmJson, FidelidadeDoCliente } from '@barbertime/contratos';
import type { Api, Corpo, Recurso } from './tipos.ts';

/**
 * Camada de dados pela API real (planejamento 0019). Mesma interface da versão
 * em memória (api.js): as telas não sabem qual está em uso.
 * `base` cobre o que ainda não migrou para o banco (parte de clientes).
 */
const q = (params: Record<string, unknown>): string => {
  const s = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return s ? `?${s}` : '';
};

/** CRUD padrão: listar, salvar (POST/PUT pelo id) e excluir. */
const recurso = <T>(caminho: string): Recurso<T> => ({
  listar: () => http<T[]>('GET', caminho),
  salvar: (d: Corpo) =>
    d.id
      ? http<T>('PUT', `${caminho}/${String(d.id)}`, d)
      : http<T>('POST', caminho, d),
  excluir: (id: number) => http('DELETE', `${caminho}/${id}`),
});

export function criarApiHttp(base: Api): Api {
  const fidelidadeDo = (clienteId: number) =>
    http<EmJson<FidelidadeDoCliente>>(
      'GET',
      `/api/clientes/${clienteId}/fidelidade`,
    );
  const publicoUrl = (
    slug: string,
    codigo: string | undefined,
    sufixo = '',
    params: Record<string, unknown> = {},
  ) =>
    `/api/publico/${encodeURIComponent(slug)}${sufixo}${q({ c: codigo, ...params })}`;

  return {
    ...base,
    servicos: {
      ...recurso('/api/servicos'),
      contarFuturos: async (id) =>
        (await http<{ total: number }>('GET', `/api/servicos/${id}/futuros`))
          .total,
    },
    produtos: recurso('/api/produtos'),
    // Estoque e compras (planejamento 0027, parte 1): só com o módulo "estoque".
    estoque: {
      /** { produtos, comprar } */
      obter: () => http('GET', '/api/estoque'),
      movimentos: ({ produtoId, limite } = {}) =>
        http('GET', `/api/estoque/movimentos${q({ produtoId, limite })}`),
      consumir: (d) => http('POST', '/api/estoque/consumo', d),
      /** itens: [{ produtoId, contado }] → { ajustes } */
      inventario: (itens) => http('POST', '/api/estoque/inventario', { itens }),
    },
    fichas: {
      obter: (servicoId) => http('GET', `/api/servicos/${servicoId}/ficha`),
      salvar: (servicoId, itens) =>
        http('PUT', `/api/servicos/${servicoId}/ficha`, { itens }),
    },
    fornecedores: recurso('/api/fornecedores'),
    compras: {
      listar: () => http('GET', '/api/compras'),
      obter: (id) => http('GET', `/api/compras/${id}`),
      registrar: (d) => http('POST', '/api/compras', d),
      cancelar: (id) => http('POST', `/api/compras/${id}/cancelar`),
    },
    barbeiros: {
      ...recurso('/api/barbeiros'),
      /** Contas da barbearia que podem ser ligadas a um barbeiro (agenda própria). */
      contas: () => http('GET', '/api/barbeiros/contas'),
    },
    clientes: {
      ...base.clientes,
      ...recurso('/api/clientes'),
      resumo: (id) => http('GET', `/api/clientes/${id}/resumo`),
      comandas: (id, { limite = 5, deslocamento = 0 } = {}) =>
        http(
          'GET',
          `/api/clientes/${id}/comandas${q({ limite, deslocamento })}`,
        ),
      listar: ({ busca = '' } = {}) =>
        http('GET', `/api/clientes${q({ busca })}`),
      obter: (id) => http('GET', `/api/clientes/${id}`),
      historico: (id) => http('GET', `/api/clientes/${id}/historico`),
    },
    agendamentos: {
      listarDoDia: (data) => http('GET', `/api/agendamentos${q({ data })}`),
      obter: (id) => http('GET', `/api/agendamentos/${id}`),
      horariosLivres: (p) => http('GET', `/api/agendamentos/horarios${q(p)}`),
      criar: (d) => http('POST', '/api/agendamentos', d),
      bloquear: (d) => http('POST', '/api/agendamentos/bloqueios', d),
      alterarEstado: (id, estado) =>
        http('PUT', `/api/agendamentos/${id}/estado`, { estado }),
    },
    // Fidelidade no banco (planejamento 0034): configuração, saldo e extrato.
    fidelidade: {
      obterConfig: () => http('GET', '/api/fidelidade/config'),
      salvarConfig: (config) => http('PUT', '/api/fidelidade/config', config),
      saldo: async (clienteId) => (await fidelidadeDo(clienteId)).saldo,
      extrato: async (clienteId) => (await fidelidadeDo(clienteId)).extrato,
    },
    // Pacotes e assinaturas no banco (planejamento 0034, etapa B).
    pacotes: recurso('/api/pacotes'),
    assinaturas: {
      doCliente: (clienteId) =>
        http('GET', `/api/clientes/${clienteId}/assinaturas`),
      /** Abre a comanda da venda no caixa: { assinatura, comandaId }. */
      vender: (d) => http('POST', '/api/assinaturas', d),
      /** Renova o pacote mensal pelo caixa: { assinatura, comandaId }. */
      renovar: (id, d = {}) =>
        http('POST', `/api/assinaturas/${id}/renovar`, d),
      podeUsar: ({ assinaturaId, servicoId, jaNaComanda = [] }) =>
        http('POST', `/api/assinaturas/${assinaturaId}/pode-usar`, {
          servicoId,
          jaNaComanda,
        }),
    },
    // Financeiro (planejamento 0027, parte 2).
    financeiro: {
      categorias: recurso('/api/financeiro/categorias'),
      contas: {
        listar: (filtros = {}) =>
          http('GET', `/api/financeiro/contas${q(filtros)}`),
        salvar: (d) =>
          d.id
            ? http('PUT', `/api/financeiro/contas/${d.id}`, d)
            : http('POST', '/api/financeiro/contas', d),
        cancelar: (id) => http('POST', `/api/financeiro/contas/${id}/cancelar`),
        baixar: (id, d) =>
          http('POST', `/api/financeiro/contas/${id}/baixar`, d),
        estornar: (id) => http('POST', `/api/financeiro/contas/${id}/estornar`),
      },
      recorrencias: {
        listar: () => http('GET', '/api/financeiro/recorrencias'),
        salvar: (d) =>
          d.id
            ? http('PUT', `/api/financeiro/recorrencias/${d.id}`, d)
            : http('POST', '/api/financeiro/recorrencias', d),
        encerrar: (id) =>
          http('POST', `/api/financeiro/recorrencias/${id}/encerrar`),
      },
      previsao: (inicio?: string, fim?: string) => {
        const params = new URLSearchParams();
        if (inicio) params.set('inicio', inicio);
        if (fim) params.set('fim', fim);
        return http('GET', `/api/financeiro/previsao?${params}`);
      },
    },
    // Caixa e comandas (planejamento 0020, fase 1).
    caixa: {
      obterDoDia: () => http('GET', '/api/caixa'),
      abrir: (d) => http('POST', '/api/caixa/abrir', d),
      fechar: (d) => http('POST', '/api/caixa/fechar', d),
    },
    comandas: {
      listarDoDia: () => http('GET', '/api/comandas'),
      obter: (id) => http('GET', `/api/comandas/${id}`),
      salvar: (d) =>
        d.id
          ? http('PUT', `/api/comandas/${d.id}`, d)
          : http('POST', '/api/comandas', d),
      receber: (id, d = {}) => http('POST', `/api/comandas/${id}/receber`, d),
      cancelar: (id) => http('POST', `/api/comandas/${id}/cancelar`),
      abrirDoAgendamento: (id) =>
        http('POST', `/api/comandas/do-atendimento/${id}`),
    },
    /** Página pública: sem sessão; `codigo` é o ?c= do modo "só com o link". */
    publico: {
      carregar: (slug, codigo) => http('GET', publicoUrl(slug, codigo)),
      horarios: (slug, codigo, p) =>
        http('GET', publicoUrl(slug, codigo, '/horarios', p)),
      /**
       * Recusa (ex.: 429, limite contra varredura de telefones, ADR 0014) vira
       * "cliente novo": a saudação se perde, mas o agendamento segue.
       */
      reconhecer: (slug, codigo, telefone) =>
        http<{ primeiroNome: string } | null>(
          'GET',
          publicoUrl(slug, codigo, '/cliente', { telefone }),
        ).catch((erro) => {
          if (erro instanceof ErroDeNegocio) return null;
          throw erro;
        }),
      agendar: (slug, codigo, d) =>
        http('POST', publicoUrl(slug, codigo, '/agendamentos'), d),
    },
  };
}
