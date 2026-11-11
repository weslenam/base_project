<script setup lang="ts">
import { DsCartao, DsPagina } from '@barbertime/ui';
</script>

<template>
  <DsPagina titulo="Sem acesso">
    <DsCartao>
      <p>
        Seu papel nesta barbearia não permite abrir essa tela, ou o módulo dela
        não está ativo. Fale com o dono da barbearia se precisar do acesso.
      </p>
    </DsCartao>
  </DsPagina>
</template>
