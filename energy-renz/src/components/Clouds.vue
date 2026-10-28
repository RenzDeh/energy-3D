<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { onUnmounted, watchEffect } from 'vue'
import { Color, IcosahedronGeometry, InstancedMesh, MathUtils, MeshStandardMaterial, Object3D } from 'three'
import { seededRandom } from '../lib/random'

/** Wolken op hoogte die met de wind (en sneller dan aan de grond) over de scène drijven. */
const props = defineProps<{
  windSpeed: number
  windDir: { x: number, z: number }
  /** Bewolking in procent: bepaalt hoeveel wolken er zichtbaar zijn */
  cloudCover: number
  daylight: number
  tint: string
}>()

const CLOUDS = 26
const PUFFS = 8
const SPAN = 420

const rand = seededRandom(7)
const clouds = Array.from({ length: CLOUDS }, () => ({
  x: (rand() - 0.5) * SPAN,
  z: (rand() - 0.5) * SPAN,
  y: 60 + rand() * 30,
  size: 7 + rand() * 9,
  order: rand(),
  puffs: Array.from({ length: PUFFS }, (_, k) => ({
    dx: (rand() - 0.5) * 2.6 * (k === 0 ? 0 : 1),
    dy: rand() * 0.5,
    dz: (rand() - 0.5) * 1.2,
    s: 0.55 + rand() * 0.6 - k * 0.03,
  })),
}))
// Bij weinig bewolking blijven de "eerste" wolken zichtbaar
clouds.sort((a, b) => a.order - b.order)

const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.94, fog: false })
const mesh = new InstancedMesh(new IcosahedronGeometry(1, 3), material, CLOUDS * PUFFS)
mesh.frustumCulled = false

const dummy = new Object3D()
const tint = new Color()
const white = new Color('#ffffff')
const visible = new Float32Array(CLOUDS)
let speed = props.windSpeed

watchEffect(() => {
  tint.set(props.tint)
  // 's Nachts donkere wolken, overdag bijna wit; zwaar bewolkt = grijzer
  material.color.copy(white).lerp(tint, 0.35).multiplyScalar(0.25 + 0.75 * props.daylight)
  material.color.lerp(new Color('#8d969d'), props.cloudCover / 180)
  material.emissive.copy(tint).multiplyScalar(0.18 + 0.12 * props.daylight)
})

useLoop().onBeforeRender(({ delta }) => {
  speed += (props.windSpeed - speed) * Math.min(1, delta)
  // Hogerop waait het ongeveer dubbel zo hard
  const drift = Math.max(speed, 1) * 2.1 * delta
  const target = Math.round(MathUtils.clamp(props.cloudCover / 100, 0.08, 1) * CLOUDS)
  const half = SPAN / 2

  clouds.forEach((c, i) => {
    c.x += props.windDir.x * drift
    c.z += props.windDir.z * drift
    if (c.x > half) { c.x -= SPAN }
    else if (c.x < -half) { c.x += SPAN }
    if (c.z > half) { c.z -= SPAN }
    else if (c.z < -half) { c.z += SPAN }
    // Rustig in- en uitfaden als de bewolking verandert, en aan de rand van het veld
    const edge = 1 - MathUtils.smoothstep(Math.max(Math.abs(c.x), Math.abs(c.z)), half * 0.8, half)
    visible[i] = MathUtils.damp(visible[i], i < target ? 1 : 0, 0.8, delta)
    const show = visible[i] * edge
    // Wolken liggen in de windrichting een beetje uitgerekt
    const angle = Math.atan2(props.windDir.x, props.windDir.z) + Math.PI / 2

    c.puffs.forEach((p, k) => {
      const ca = Math.cos(angle)
      const sa = Math.sin(angle)
      const lx = p.dx * c.size
      const lz = p.dz * c.size
      dummy.position.set(c.x + lx * ca + lz * sa, c.y + p.dy * c.size * 0.4, c.z - lx * sa + lz * ca)
      const s = p.s * c.size * show
      dummy.scale.set(s, s * 0.55, s * 0.85)
      dummy.rotation.set(0, angle, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i * PUFFS + k, dummy.matrix)
    })
  })
  mesh.instanceMatrix.needsUpdate = true
})

onUnmounted(() => {
  mesh.geometry.dispose()
  material.dispose()
})
</script>

<template>
  <primitive :object="mesh" />
</template>
