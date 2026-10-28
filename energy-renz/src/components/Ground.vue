<script setup lang="ts">
import { onUnmounted } from 'vue'
import { BufferAttribute, Color, MathUtils, MeshStandardMaterial, PlaneGeometry } from 'three'
import { OFFICE } from '../lib/town'
import { CITY, terrainHeight } from '../lib/terrain'

const SIZE = 700
const SEGMENTS = 240
const FIELD_ANGLE = 0.35 // akkers liggen niet netjes noord-zuid

// Lappendeken van akkers: weiland, wintergraan, stoppels en omgeploegde grond
const FIELDS = ['#3f6b2c', '#4d7a31', '#5f8436', '#7c8a43', '#8b7a4a', '#6b5638', '#456f2f'].map(c => new Color(c))
const MEADOW = new Color('#3f6b2c')
const PAVING = new Color('#7d776c')
const PARK = new Color('#55803a')

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const geometry = new PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
geometry.rotateX(-Math.PI / 2)
const position = geometry.attributes.position
const colors = new Float32Array(position.count * 3)
const color = new Color()
const ca = Math.cos(FIELD_ANGLE)
const sa = Math.sin(FIELD_ANGLE)
for (let i = 0; i < position.count; i++) {
  const x = position.getX(i)
  const z = position.getZ(i)
  position.setY(i, terrainHeight(x, z))

  const u = x * ca - z * sa
  const v = x * sa + z * ca
  const cell = hash(Math.floor(u / 46), Math.floor(v / 32))
  color.copy(FIELDS[Math.floor(cell * FIELDS.length)])
  // Ploegvoren / rijen in het gewas
  color.multiplyScalar(0.93 + 0.07 * Math.sin(v * (cell > 0.5 ? 2.2 : 1.4)))
  // Rond de molen blijft het weiland, zodat het gras er naadloos in overgaat
  color.lerp(MEADOW, 1 - MathUtils.smoothstep(Math.hypot(x, z), 38, 60))
  // Stad: straten en pleinen, met een park rond het kantoorgebouw
  color.lerp(PAVING, 1 - MathUtils.smoothstep(Math.hypot(x - CITY.x, z - CITY.z), CITY.radius * 0.7, CITY.radius * 1.05))
  color.lerp(PARK, 1 - MathUtils.smoothstep(Math.hypot(x - OFFICE.x, z - OFFICE.z), OFFICE.radius + 16, OFFICE.radius + 24))
  color.toArray(colors, i * 3)
}
geometry.setAttribute('color', new BufferAttribute(colors, 3))
geometry.computeVertexNormals()

const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1 })

onUnmounted(() => {
  geometry.dispose()
  material.dispose()
})
</script>

<template>
  <TresMesh :geometry="geometry" :material="material" receive-shadow />
</template>
