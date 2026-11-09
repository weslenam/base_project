/**
 * Schemas de entrada das rotas (ADR 0014, planejamento 0022).
 *
 * Cuidam de TIPO e TAMANHO, não de regra de negócio: as mensagens próprias
 * ("Informe o nome", "Telefone inválido"...) continuam nas rotas e no domínio.
 * Por isso quase nada é `required` e os opcionais aceitam `null` (sem `null` no
 * tipo, o Ajv do Fastify transformaria null em 0 ou "" e mudaria o comportamento).
 * Objeto ou lista onde se espera valor simples vira 400: é o que barra a
 * confusão de tipo (ex.: `{ "email": { "$ne": null } }`).
 */

export const texto = (max) => ({ type: ['string', 'null'], maxLength: max });
export const inteiro = { type: ['integer', 'null'] };
export const numero = { type: ['number', 'null'] };
export const logico = { type: ['boolean', 'null'] };
/**
 * Valor numérico que as rotas já convertem com Number() e validam com mensagem
 * própria (o front pode mandar 12.5, "12.5" ou ""). Chega como texto: o número
 * vira "12.5" e o Number() da rota dá o mesmo valor. Objeto ou lista: 400.
 */
export const escalar = (max = 30) => ({
  type: ['string', 'null'],
  maxLength: max,
});

export const TAM = Object.freeze({
  nome: 120,
  email: 254,
  senha: 200,
  telefone: 20,
  cpf: 20,
  data: 10,
  hora: 5,
  slug: 80,
  observacao: 2000,
  codigo: 64,
});

/**
 * Data AAAA-MM-DD válida (o formato `date` confere mês e dia, inclusive 31/02)
 * e hora HH:MM. Vazio passa: a rota dá a mensagem própria ("Escolha o dia").
 * Fora do formato vira 400 antes de chegar ao banco (ADR 0014).
 */
export const campoData = {
  type: ['string', 'null'],
  maxLength: TAM.data,
  anyOf: [{ maxLength: 0 }, { format: 'date' }],
};
export const campoHora = {
  type: ['string', 'null'],
  pattern: '^(|([01][0-9]|2[0-3]):[0-5][0-9])$',
};

/** `{ body: { type: 'object', properties } }` (corpo ausente vira `{}` na guarda). */
export const corpo = (properties) => ({
  body: { type: 'object', properties },
});

export const query = (properties) => ({
  querystring: { type: 'object', properties },
});

export const clienteResumido = {
  type: ['object', 'null'],
  properties: {
    nome: texto(TAM.nome),
    telefone: texto(TAM.telefone),
  },
};

export const itensDeComanda = {
  type: ['array', 'null'],
  maxItems: 200,
  items: {
    type: 'object',
    properties: {
      tipo: texto(20),
      refId: inteiro,
      assinaturaId: inteiro,
      barbeiroId: inteiro,
      nome: texto(TAM.nome),
      quantidade: escalar(),
      preco: escalar(),
    },
  },
};
