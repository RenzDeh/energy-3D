<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { ACESFilmicToneMapping } from 'three'
import TheScene from './components/TheScene.vue'
import VoicePanel from './components/VoicePanel.vue'
import WindHud from './components/WindHud.vue'
import { useEnvironment } from './composables/useEnvironment'

const { colors } = useEnvironment()
</script>

<template>
  <TresCanvas
    :clear-color="colors.horizon"
    shadows
    window-size
    :tone-mapping="ACESFilmicToneMapping"
    :tone-mapping-exposure="1.05"
  >
    <TheScene />
  </TresCanvas>
  <WindHud />
  <VoicePanel />
</template>
