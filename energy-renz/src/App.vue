<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import BasicWindmill from './components/BasicWindmill.vue'

</script>

<template>
  <TresCanvas
    clear-color="#82DBC5"
    window-size
  >
    <BasicWindmill />
  </TresCanvas>
</template>