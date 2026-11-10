import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { DsApp, instalarUi } from '@barbertime/ui';
import { FIDELIDADE_PADRAO } from '@barbertime/dominio';
import router from '../router';
import { api } from '../dados/api.ts';
import { definirSessao } from '../sessao/sessao.ts';
import { SESSAO_DONO } from '../testes/apoio.ts';
import ComandaDialogo from './caixa/ComandaDialogo.vue';
import type { SaldoFidelidade } from '@barbertime/dominio';
import type { Cliente, Comanda } from '../dados/modelos.ts';

// Planejamento 0037 (revisão): reabrir outra comanda não pode apagar o
// resgate (prêmio e cashback) que ela já tinha.

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

// Só os campos que a comanda usa nesta tela.
const comanda = (id: number, clienteId: number, extra = {}) =>
  ({
    id,
    clienteId,
    clienteNome: `Cliente ${clienteId}`,
    barbeiroId: null,
    itens: [
      { tipo: 'servico', refId: 1, nome: 'Corte', preco: 50, quantidade: 1 },
    ],
    desconto: 0,
    premioFidelidade: false,
    cashbackUsado: 0,
    forma: null,
    estado: 'aberta',
    ...extra,
  }) as Comanda;

describe('comanda com resgate da fidelidade', () => {
  it('abrir A e depois B mantém o cashback e o prêmio de B', async () => {
    const a = comanda(1, 10);
    const b = comanda(2, 20, { premioFidelidade: true, cashbackUsado: 10 });
    vi.spyOn(api.comandas, 'obter').mockImplementation(async (id) =>
      id === 1 ? a : b,
    );
    vi.spyOn(api.clientes, 'obter').mockImplementation(
      async (clienteId) =>
        ({
          id: clienteId,
          nome: `Cliente ${clienteId}`,
          telefone: '11900000000',
        }) as Cliente,
    );
    vi.spyOn(api.fidelidade, 'obterConfig').mockResolvedValue(
      structuredClone(FIDELIDADE_PADRAO),
    );
    vi.spyOn(api.fidelidade, 'saldo').mockResolvedValue({
      selos: 0,
      cashback: 20,
    } as SaldoFidelidade);

    definirSessao(SESSAO_DONO);
    const id = ref(1);
    const aberto = ref(false);
    const Raiz = defineComponent(
      () => () =>
        h(DsApp, null, {
          default: () =>
            h(ComandaDialogo, {
              id: id.value,
              modelValue: aberto.value,
              'onUpdate:modelValue': (v) => (aberto.value = v),
            }),
        }),
    );
    const alvo = document.createElement('div');
    document.body.appendChild(alvo);
    const w = mount(Raiz, {
      attachTo: alvo,
      global: { plugins: [{ install: instalarUi }, router] },
    });

    aberto.value = true;
    await flushPromises();
    aberto.value = false;
    await flushPromises();
    id.value = 2;
    aberto.value = true;
    await flushPromises();
    await flushPromises();

    expect(b).toMatchObject({ premioFidelidade: true, cashbackUsado: 10 });
    w.unmount();
  });
});
