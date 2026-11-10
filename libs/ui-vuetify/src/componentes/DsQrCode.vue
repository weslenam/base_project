<script setup lang="ts">
import { ref, watch } from 'vue';
import QRCode from 'qrcode';

/** QR code de um texto (ex.: link da página pública para o balcão). */
const props = defineProps({
  valor: { type: String, required: true },
  /** Texto alternativo (o que o QR abre). */
  rotulo: { type: String, required: true },
  /** Lado em pixels. */
  tamanho: { type: Number, default: 160 },
});

const imagem = ref('');
watch(
  () => [props.valor, props.tamanho],
  async () => {
    imagem.value = props.valor
      ? await QRCode.toDataURL(props.valor, {
          width: props.tamanho,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
      : '';
  },
  { immediate: true },
);
</script>

<template>
  <img
    v-if="imagem"
    class="ds-qrcode"
    :src="imagem"
    :alt="rotulo"
    :width="tamanho"
    :height="tamanho"
  />
</template>

<style scoped>
.ds-qrcode {
  display: block;
  padding: var(--esp-2);
  border: 1px solid var(--linha);
  border-radius: var(--raio-sm);
  background: #fff;
}
</style>
