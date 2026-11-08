import { http } from './http.js';

/** Chamadas da administração (planejamentos 0013 e 0017). Já falam com a API real. */
export const administracao = {
  usuarios: {
    listar: () => http('GET', '/api/usuarios'),
    convidar: (dados) => http('POST', '/api/usuarios', dados),
    alterar: (id, dados) => http('PUT', `/api/usuarios/${id}`, dados),
    remover: (id) => http('DELETE', `/api/usuarios/${id}`),
    definirSenha: (id, senha) =>
      http('PUT', `/api/usuarios/${id}/senha`, { senha }),
  },
  barbearia: {
    obter: () => http('GET', '/api/barbearia'),
    salvar: (dados) => http('PUT', '/api/barbearia', dados),
  },
  papeis: {
    listar: () => http('GET', '/api/papeis'),
    criar: (dados) => http('POST', '/api/papeis', dados),
    alterar: (id, dados) => http('PUT', `/api/papeis/${id}`, dados),
    excluir: (id) => http('DELETE', `/api/papeis/${id}`),
  },
  modulos: {
    listar: () => http('GET', '/api/modulos'),
    executar: (chave, acao) => http('POST', `/api/modulos/${chave}/${acao}`),
  },
};
