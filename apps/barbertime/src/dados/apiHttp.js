import { http } from './http.js';

/**
 * Camada de dados pela API real (planejamento 0019). Mesma interface da versão
 * em memória (api.js): as telas não sabem qual está em uso.
 * `base` cobre o que ainda não migrou para o banco (partes 2 e 3 do 0019).
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
    barbeiros: recurso('/api/barbeiros'),
    clientes: {
      ...base.clientes, // resumo e comandas: parte 2
      ...recurso('/api/clientes'),
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
    /** Página pública: sem sessão; `codigo` é o ?c= do modo "só com o link". */
    publico: {
      carregar: (slug, codigo) => http('GET', publicoUrl(slug, codigo)),
      horarios: (slug, codigo, p) =>
        http('GET', publicoUrl(slug, codigo, '/horarios', p)),
      reconhecer: (slug, codigo, telefone) =>
        http('GET', publicoUrl(slug, codigo, '/cliente', { telefone })),
      agendar: (slug, codigo, d) =>
        http('POST', publicoUrl(slug, codigo, '/agendamentos'), d),
    },
  };
}
