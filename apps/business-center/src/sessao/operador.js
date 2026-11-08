import { ref } from 'vue';
import { plataforma } from '../dados/plataforma.js';

// Operador logado no Business Center. A sessão mora no cookie HttpOnly
// (bt_operador); aqui fica só quem é, para o cabeçalho e o guarda das rotas.
const operador = ref(null);
let verificado = false;

export function definirOperador(valor) {
  operador.value = valor;
  verificado = true;
}

export async function carregarOperador() {
  if (verificado) return operador.value;
  try {
    operador.value = (await plataforma.eu()).operador;
  } catch {
    operador.value = null;
  }
  verificado = true;
  return operador.value;
}

export function useOperador() {
  return {
    operador,
    async entrar(email, senha, codigo) {
      const r = await plataforma.entrar(email, senha, codigo);
      definirOperador(r.operador);
    },
    async sair() {
      await plataforma.sair().catch(() => undefined);
      definirOperador(null);
    },
  };
}
