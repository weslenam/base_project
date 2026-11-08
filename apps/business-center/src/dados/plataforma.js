import { http } from './http.js';

// API do Business Center (planejamento 0028): tudo sob /api/plataforma.
const base = '/api/plataforma';

export const plataforma = {
  entrar: (email, senha, codigo) =>
    http('POST', `${base}/auth/entrar`, { email, senha, codigo }),
  sair: () => http('POST', `${base}/auth/sair`),
  eu: () => http('GET', `${base}/auth/eu`),
  barbearias: () => http('GET', `${base}/barbearias`),
  barbearia: (id) => http('GET', `${base}/barbearias/${id}`),
  modulo: (id, chave, acao, motivo) =>
    http('POST', `${base}/barbearias/${id}/modulos/${chave}/${acao}`, {
      motivo,
    }),
  suspender: (id, motivo) =>
    http('POST', `${base}/barbearias/${id}/suspender`, { motivo }),
  reativar: (id, motivo) =>
    http('POST', `${base}/barbearias/${id}/reativar`, { motivo }),
  transferirDono: (id, usuarioId, motivo) =>
    http('POST', `${base}/barbearias/${id}/dono`, { usuarioId, motivo }),
};
