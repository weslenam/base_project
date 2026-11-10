<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  DsBotao,
  DsCaixaDeSelecao,
  DsCartao,
  DsInput,
  DsPagina,
  DsSelect,
  useNotificacao,
} from '@barbertime/ui';
import { api } from '../../dados/api.ts';
import { useAcao } from '../../dados/useAcao.ts';
import type { ConfigFidelidade } from '@barbertime/dominio';
import type { Servico } from '../../dados/modelos.ts';

// Configuração do módulo Fidelidade (planejamento 0015): selos e/ou cashback.
const executar = useAcao();
const notificar = useNotificacao();

const config = ref<ConfigFidelidade | null>(null);
const servicos = ref<Servico[]>([]);
const salvando = ref(false);
const selosComValidade = ref(false);

onMounted(async () => {
  [config.value, servicos.value] = await Promise.all([
    api.fidelidade.obterConfig(),
    api.servicos.listar(),
  ]);
  selosComValidade.value = Boolean(config.value?.selos.validadeMeses);
});

const opcoesServicos = computed(() =>
  servicos.value.map((s) => ({ valor: s.id, rotulo: s.nome })),
);
const premioNome = computed(
  () =>
    servicos.value.find((s) => s.id === config.value?.selos.premioServicoId)
      ?.nome ?? 'o prêmio',
);

async function salvar() {
  const c = config.value;
  if (!c) return;
  const dados: ConfigFidelidade = {
    selos: {
      ...c.selos,
      necessarios: Number(c.selos.necessarios),
      validadeMeses: selosComValidade.value
        ? Number(c.selos.validadeMeses) || null
        : null,
    },
    cashback: {
      ...c.cashback,
      percentual: Number(c.cashback.percentual),
      validadeDias: Number(c.cashback.validadeDias),
    },
  };
  salvando.value = true;
  const salvo = await executar(() => api.fidelidade.salvarConfig(dados));
  salvando.value = false;
  if (salvo) {
    config.value = salvo;
    notificar.sucesso('Fidelidade atualizada.');
  }
}
</script>

<template>
  <DsPagina titulo="Fidelidade">
    <template #acoes>
      <DsBotao :carregando="salvando" @click="salvar">Salvar</DsBotao>
    </template>
    <p class="ds-corpo-sm ds-suave">
      Ligue os selos, o cashback ou os dois. Só acumula quem é identificado na
      comanda (cliente avulso não acumula), e só comandas pagas contam.
    </p>

    <div v-if="config" class="cartoes">
      <DsCartao titulo="Cartão de selos">
        <div class="campos">
          <DsCaixaDeSelecao
            v-model="config.selos.ativo"
            rotulo="Usar cartão de selos"
            descricao="1 selo por comanda paga com serviço (serviço de pacote não conta)"
          />
          <template v-if="config.selos.ativo">
            <div class="dupla">
              <DsInput
                v-model="config.selos.necessarios"
                tipo="numero"
                rotulo="Selos para o prêmio"
              />
              <DsSelect
                v-model="config.selos.premioServicoId"
                rotulo="Prêmio"
                :opcoes="opcoesServicos"
              />
            </div>
            <DsCaixaDeSelecao
              v-model="selosComValidade"
              rotulo="Selos vencem"
            />
            <DsInput
              v-if="selosComValidade"
              v-model="config.selos.validadeMeses"
              tipo="numero"
              rotulo="Validade dos selos (meses)"
            />
            <p class="exemplo">
              Exemplo: a cada {{ config.selos.necessarios }} atendimentos, o
              cliente ganha {{ premioNome }}.
            </p>
          </template>
        </div>
      </DsCartao>

      <DsCartao titulo="Cashback">
        <div class="campos">
          <DsCaixaDeSelecao
            v-model="config.cashback.ativo"
            rotulo="Usar cashback"
            descricao="Parte do valor pago vira crédito para a próxima visita"
          />
          <div v-if="config.cashback.ativo" class="dupla">
            <DsInput
              v-model="config.cashback.percentual"
              tipo="numero"
              rotulo="Cashback (%)"
            />
            <DsInput
              v-model="config.cashback.validadeDias"
              tipo="numero"
              rotulo="Validade do crédito (dias)"
            />
          </div>
          <p v-if="config.cashback.ativo" class="exemplo">
            Exemplo: numa comanda de R$ 100,00, o cliente ganha R$
            {{
              (Number(config.cashback.percentual) || 0)
                .toFixed(2)
                .replace('.', ',')
            }}
            de crédito.
          </p>
        </div>
      </DsCartao>
    </div>

    <DsCartao titulo="Como o cliente acompanha">
      <p class="ds-corpo-sm">
        O saldo de selos e cashback aparece no cadastro do cliente e na comanda.
        A consulta pelo próprio cliente e os avisos ao ganhar ou usar chegam com
        o canal verificado (e-mail ou WhatsApp), na próxima fase.
      </p>
    </DsCartao>
  </DsPagina>
</template>

<style scoped>
.cartoes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  gap: var(--esp-4);
  align-items: start;
}
.campos {
  display: grid;
  gap: var(--esp-3);
}
.dupla {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--esp-3);
}
.exemplo {
  margin: 0;
  padding: var(--esp-2) var(--esp-3);
  border-left: 4px solid var(--aco);
  border-radius: var(--raio-sm);
  background: var(--aco-suave);
  font: var(--tipo-corpo-sm);
}
p {
  margin: 0;
}
</style>
