<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  Vector2,
} from 'three'
import { terrainHeight } from '../lib/terrain'

const props = defineProps<{
  /** Windsnelheid op 10 m (m/s) */
  windSpeed: number
  /** Richting waarin de wind waait, eenheidsvector in het XZ-vlak */
  windDir: { x: number, z: number }
}>()

const COUNT = 60000
const RADIUS = 42
const CLEARING = 3.4 // geen gras onder de fundering

// Grasspriet langs +Y met hoogte 1: drie segmenten en een punt
function createBladeGeometry(): BufferGeometry {
  const rows = [
    { y: 0, w: 0.05 },
    { y: 0.4, w: 0.04 },
    { y: 0.75, w: 0.026 },
  ]
  const positions: number[] = []
  for (const { y, w } of rows) { positions.push(-w, y, 0, w, y, 0) }
  positions.push(0, 1, 0)
  const indices = [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const uniforms = {
  uTime: { value: 0 },
  uWind: { value: 0 },
  uWindDir: { value: new Vector2(1, 0) },
}

const material = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.9 })
material.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, uniforms)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      uniform float uTime;
      uniform float uWind;
      uniform vec2 uWindDir;
      varying float vHeight;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vHeight = position.y;
      vec2 ip = instanceMatrix[3].xz;
      float s2 = dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz);
      // Windvlagen rollen als golven over het veld in de windrichting
      float wave = sin(dot(ip, uWindDir) * 0.18 - uTime * (1.2 + uWind * 0.25)) * 0.5 + 0.5;
      float flutter = sin(uTime * 3.0 + ip.x * 1.7 + ip.y * 2.3) * 0.5 + 0.5;
      float bend = position.y * position.y * s2 * (0.06 + uWind * 0.045 * (0.55 + 0.45 * wave) + uWind * 0.01 * flutter);
      vec3 worldShift = vec3(uWindDir.x, -bend * 0.25, uWindDir.y) * bend;
      // Verschuiving naar de lokale ruimte van de instantie brengen (rotatie + schaal ongedaan maken)
      transformed += (worldShift * mat3(instanceMatrix)) / s2;`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      varying float vHeight;`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= mix(0.4, 1.15, vHeight);`)
}

const mesh = new InstancedMesh(createBladeGeometry(), material, COUNT)
mesh.frustumCulled = false
mesh.receiveShadow = true

const dummy = new Object3D()
const color = new Color()
for (let i = 0; i < COUNT; i++) {
  const r = Math.sqrt(MathUtils.lerp(CLEARING ** 2, RADIUS ** 2, Math.random()))
  const a = Math.random() * Math.PI * 2
  const x = Math.cos(a) * r
  const z = Math.sin(a) * r
  dummy.position.set(x, terrainHeight(x, z) - 0.02, z)
  dummy.rotation.y = Math.random() * Math.PI
  // Hoger en dichter gras buiten de directe omgeving van de molen
  // Naar de rand toe korter, zodat het grasveld zacht overgaat in de weide
  dummy.scale.setScalar((0.5 + Math.random() * 0.8) * (1 - 0.75 * MathUtils.smoothstep(r, RADIUS * 0.7, RADIUS)))
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
  color.setHSL(0.24 + Math.random() * 0.06, 0.5 + Math.random() * 0.2, 0.3 + Math.random() * 0.14)
  mesh.setColorAt(i, color)
}

const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  uniforms.uTime.value = elapsed
  // Zachte aanloop, zodat het gras niet schokkerig reageert op nieuwe data
  uniforms.uWind.value = MathUtils.lerp(uniforms.uWind.value, Math.min(props.windSpeed, 18), 0.03)
  uniforms.uWindDir.value.set(props.windDir.x, props.windDir.z)
})
</script>

<template>
  <primitive :object="mesh" />
</template>
