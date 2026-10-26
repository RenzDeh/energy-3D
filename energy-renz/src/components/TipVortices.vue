<script setup lang="ts">
import { useLoop, useTres } from '@tresjs/core'
import { onUnmounted } from 'vue'
import { MathUtils, Vector3 } from 'three'
import { Ribbons } from '../lib/ribbons'

/**
 * Tipwervels: de bladtippen laten een spiraalvormig spoor achter dat met de wind wordt meegevoerd.
 * Wordt in de ruimte van de gondel geplaatst; het rotorvlak ligt op z = hubZ, benedenwinds is -Z.
 */
const props = defineProps<{
  /** Gedeelde, niet-reactieve rotorstatus die de molen elk frame bijwerkt */
  rotor: { angle: number, omega: number, wake: number }
  radius: number
  hubY: number
  hubZ: number
  color: string
}>()

const BLADES = 3
const POINTS = 90
const DURATION = 3.6 // seconden spoor

const ribbons = new Ribbons(BLADES, POINTS, { color: props.color, opacity: 0.55 })
for (let b = 0; b < BLADES; b++) ribbons.width[b] = 0.28

const { camera } = useTres()
const cam = new Vector3()
let visibility = 0

useLoop().onBeforeRender(({ delta }) => {
  const { angle, omega, wake } = props.rotor
  // Alleen zichtbaar als de rotor echt draait
  visibility = MathUtils.damp(visibility, MathUtils.smoothstep(omega, 0.25, 1.1), 2, delta)
  ribbons.uniforms.uColor.value.set(props.color)

  const P = ribbons.points
  for (let b = 0; b < BLADES; b++) {
    ribbons.alpha[b] = visibility
    const offset = (b * 2 * Math.PI) / BLADES
    for (let j = 0; j < POINTS; j++) {
      const age = (j / (POINTS - 1)) * DURATION
      // Waar de tip `age` seconden geleden was, en hoe ver dat punt sindsdien is weggedreven
      const theta = angle - omega * age + offset
      const r = props.radius * (1 + 0.12 * (age / DURATION))
      const o = (b * POINTS + j) * 3
      P[o] = -Math.sin(theta) * r
      P[o + 1] = props.hubY + Math.cos(theta) * r
      P[o + 2] = props.hubZ - 0.2 - wake * age
    }
  }

  if (camera.value) {
    cam.setFromMatrixPosition(camera.value.matrixWorld)
    ribbons.mesh.worldToLocal(cam)
  }
  ribbons.update(cam)
})

onUnmounted(() => ribbons.dispose())
</script>

<template>
  <primitive :object="ribbons.mesh" />
</template>
