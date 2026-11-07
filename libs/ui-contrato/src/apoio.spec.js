import { botaoPorTexto, textoDoDocumento } from './apoio.js';

describe('apoio dos contratos', () => {
  it('encontra botão pelo texto e lê o documento', () => {
    document.body.innerHTML = '<button> Ok </button><p>Olá</p>';
    expect(botaoPorTexto('Ok')).toBeInstanceOf(HTMLButtonElement);
    expect(textoDoDocumento()).toContain('Olá');
  });
});
