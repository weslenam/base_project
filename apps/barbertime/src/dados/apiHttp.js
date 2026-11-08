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
