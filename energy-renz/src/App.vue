<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { ACESFilmicToneMapping } from 'three'
import TheScene from './components/TheScene.vue'
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'
import { watchEffect } from 'vue'
import { useEnvironment } from './composables/useEnvironment'
import { useLocation } from './composables/useLocation'

const { colors } = useEnvironment()
const { place } = useLocation()
watchEffect(() => (document.title = `Windmolen ${place.value.name} – live wind`))
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
  <TopBar />
  <Sidebar />
</template>
