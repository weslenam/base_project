import { ErroDeNegocio } from './erros.js';
import { http } from './http.js';

/**
 * Camada de dados pela API real (planejamento 0019). Mesma interface da versão
 * em memória (api.js): as telas não sabem qual está em uso.
 * `base` cobre o que ainda não migrou para o banco (fidelidade e pacotes).
 */
const q = (params) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== ''),
  ).toString();
  return s ? `?${s}` : '';
};

/** CRUD padrão: listar, salvar (POST/PUT pelo id) e excluir. */
const recurso = (caminho) => ({
  listar: () => http('GET', caminho),
  salvar: (d) =>
    d.id ? http('PUT', `${caminho}/${d.id}`, d) : http('POST', caminho, d),
  excluir: (id) => http('DELETE', `${caminho}/${id}`),
});

export function criarApiHttp(base) {
  const publicoUrl = (slug, codigo, sufixo = '', params = {}) =>
    `/api/publico/${encodeURIComponent(slug)}${sufixo}${q({ c: codigo, ...params })}`;

  return {
    ...base,
    servicos: {
      ...recurso('/api/servicos'),
      contarFuturos: async (id) =>
        (await http('GET', `/api/servicos/${id}/futuros`)).total,
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
    // Fidelidade ainda em memória (parte 3 do 0019), mas o prêmio é um serviço
    // real: confere na API, não no catálogo de exemplo da memória.
    fidelidade: base.fidelidade && {
      ...base.fidelidade,
      // Prêmio que não é serviço desta barbearia (ex.: o "1" do catálogo de
      // exemplo) chega vazio, para o seletor pedir a escolha em vez de mostrar o id.
      async obterConfig() {
        const [config, servicos] = await Promise.all([
          base.fidelidade.obterConfig(),
          http('GET', '/api/servicos'),
        ]);
        const id = Number(config.selos?.premioServicoId);
        if (config.selos && !servicos.some((s) => s.id === id))
          config.selos.premioServicoId = null;
        return config;
      },
      async salvarConfig(config) {
        if (config.selos?.ativo) {
          const servicos = await http('GET', '/api/servicos');
          const id = Number(config.selos.premioServicoId);
          if (!servicos.some((s) => s.id === id))
            throw new ErroDeNegocio('Serviço de prêmio não encontrado.');
        }
        return base.fidelidade.salvarConfig(config, { servicoConferido: true });
      },
    },
    // Caixa e comandas (planejamento 0020, fase 1). Pacotes e fidelidade: parte 3 do 0019.
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
        http('GET', publicoUrl(slug, codigo, '/cliente', { telefone })).catch(
          (erro) => {
            if (erro instanceof ErroDeNegocio) return null;
            throw erro;
          },
        ),
      agendar: (slug, codigo, d) =>
        http('POST', publicoUrl(slug, codigo, '/agendamentos'), d),
    },
  };
}
