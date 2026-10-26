<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import BasicWindmill from './components/BasicWindmill.vue'

</script>

<template>
  <TresCanvas
    clear-color="#a8d8f0"
    window-size
  >
    <BasicWindmill />
  </TresCanvas>
</template>