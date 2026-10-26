<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { onUnmounted } from 'vue'
import {
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  Vector2,
} from 'three'
import type { WebGLProgramParametersWithUniforms } from 'three'
import { treeSpots } from '../lib/scenery'

/** Bomen die met de wind meebuigen (in de vertex shader, net zoals het gras). */
const props = defineProps<{
  windSpeed: number
  windDir: { x: number, z: number }
}>()

const uniforms = {
  uTime: { value: 0 },
  uWind: { value: 0 },
  uWindDir: { value: new Vector2(1, 0) },
}

/** Buiging toevoegen: hoe hoger in de boom, hoe verder hij meegeeft. `height` = hoogte van de geometrie. */
function addSway(material: MeshStandardMaterial, height: number, amount: number) {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform float uWind;
        uniform vec2 uWindDir;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 ip = instanceMatrix[3].xz;
        float k = clamp(position.y / ${height.toFixed(2)}, 0.0, 1.0);
        float gust = sin(dot(ip, uWindDir) * 0.08 - uTime * (0.9 + uWind * 0.12)) * 0.5 + 0.5;
        float rustle = sin(uTime * (2.0 + uWind * 0.25) + ip.x * 0.7 + position.x * 3.0) * 0.5 + 0.5;
        float bend = k * k * ${amount.toFixed(3)} * (0.4 + uWind * (0.5 + 0.5 * gust) * 0.18 + uWind * 0.03 * rustle);
        vec3 worldShift = vec3(uWindDir.x, -bend * 0.15, uWindDir.y) * bend;
        float s2 = dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz);
        transformed += (worldShift * mat3(instanceMatrix)) / s2;`)
  }
}

const TREE_HEIGHT = 3

const trunkGeometry = new CylinderGeometry(0.09, 0.15, 1.6, 6)
trunkGeometry.translate(0, 0.8, 0)
const canopyGeometry = new IcosahedronGeometry(0.85, 1)
canopyGeometry.scale(1, 1.15, 1)
canopyGeometry.translate(0, 2.05, 0)
// Een beetje onregelmatige kruin
const cp = canopyGeometry.attributes.position
for (let i = 0; i < cp.count; i++) {
  const n = Math.sin(cp.getX(i) * 5.1) * Math.cos(cp.getZ(i) * 4.3) * 0.09
  cp.setXYZ(i, cp.getX(i) * (1 + n), cp.getY(i) + n, cp.getZ(i) * (1 + n))
}
canopyGeometry.computeVertexNormals()

const trunkMaterial = new MeshStandardMaterial({ color: '#5b4633', roughness: 1 })
const canopyMaterial = new MeshStandardMaterial({ roughness: 0.9, flatShading: true })
addSway(trunkMaterial, TREE_HEIGHT, 0.12)
addSway(canopyMaterial, TREE_HEIGHT, 0.12)

const spots = treeSpots()
const trunks = new InstancedMesh(trunkGeometry, trunkMaterial, spots.length)
const canopies = new InstancedMesh(canopyGeometry, canopyMaterial, spots.length)
for (const mesh of [trunks, canopies]) {
  mesh.castShadow = true
  mesh.receiveShadow = true
}

// Herfst: een mix van groen, geel en roestbruin
const autumn = ['#4f7a34', '#6d8a32', '#a08a2f', '#b8702c', '#8a4b26'].map(c => new Color(c))
const dummy = new Object3D()
const color = new Color()
spots.forEach((s, i) => {
  dummy.position.set(s.x, s.y - 0.05, s.z)
  dummy.rotation.set(0, s.rotation, 0)
  dummy.scale.setScalar(s.scale)
  dummy.updateMatrix()
  trunks.setMatrixAt(i, dummy.matrix)
  canopies.setMatrixAt(i, dummy.matrix)
  const idx = Math.floor(s.hue * autumn.length)
  color.copy(autumn[idx]).lerp(autumn[(idx + 1) % autumn.length], (s.hue * autumn.length) % 1 * 0.5)
  canopies.setColorAt(i, color)
})
trunks.computeBoundingSphere()
canopies.computeBoundingSphere()

useLoop().onBeforeRender(({ elapsed }) => {
  uniforms.uTime.value = elapsed
  uniforms.uWind.value = MathUtils.lerp(uniforms.uWind.value, Math.min(props.windSpeed, 22), 0.03)
  uniforms.uWindDir.value.set(props.windDir.x, props.windDir.z)
})

onUnmounted(() => {
  trunkGeometry.dispose()
  canopyGeometry.dispose()
  trunkMaterial.dispose()
  canopyMaterial.dispose()
})
</script>

<template>
  <primitive :object="trunks" />
  <primitive :object="canopies" />
</template>
