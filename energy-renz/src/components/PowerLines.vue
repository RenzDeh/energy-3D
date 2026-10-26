<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { computed, onUnmounted } from 'vue'
import { BoxGeometry, CatmullRomCurve3, Color, MeshStandardMaterial, ShaderMaterial, TubeGeometry, Vector3 } from 'three'
import { PARK_TURBINES } from '../lib/scenery'
import { terrainHeight } from '../lib/terrain'

/**
 * Stroomkabels van de molens naar het onderstation bij Kortrijk Weide en verder de stad in.
 * Lichtpulsen lopen naar de stad: hoe meer vermogen, hoe sneller en feller; de kleur volgt de stroomprijs.
 */
const props = defineProps<{
  /** Vermogen ten opzichte van het nominale vermogen van het park (0..1) */
  load: number
  /** Aantal molens dat meedraait (de hoofdmolen telt mee) */
  turbines: number
  /** Stroomprijs nu ten opzichte van de komende 24 uur (0 = goedkoop, 1 = duur): kleurt de pulsen */
  priceLevel: number
}>()

const SUBSTATION = { x: -86, z: -30 }
const CITY_END = { x: -118, z: -30 }
const GLOW = new Color('#5fe3ff')

function cable(from: { x: number, z: number }, to: { x: number, z: number }) {
  const length = Math.hypot(to.x - from.x, to.z - from.z)
  const steps = Math.max(4, Math.ceil(length / 6))
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const x = from.x + (to.x - from.x) * t
    const z = from.z + (to.z - from.z) * t
    return new Vector3(x, Math.max(terrainHeight(x, z), 0) + 0.3, z)
  })
  const geometry = new TubeGeometry(new CatmullRomCurve3(points), steps * 6, 0.22, 6)
  const material = new ShaderMaterial({
    uniforms: {
      uPhase: { value: 0 },
      uLoad: { value: 0 },
      uLength: { value: length },
      uGlow: { value: GLOW },
    },
    vertexShader: /* glsl */ `
      varying float vX;
      void main() {
        vX = uv.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uPhase;
      uniform float uLoad;
      uniform float uLength;
      uniform vec3 uGlow;
      varying float vX;
      void main() {
        // Pulsen om de 9 eenheden, met een scherpe kop in de stroomrichting
        float d = fract((vX * uLength - uPhase) / 9.0);
        float pulse = pow(d, 8.0);
        vec3 col = vec3(0.12, 0.13, 0.15) + uGlow * uLoad * (0.35 + pulse * 3.0);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  return { geometry, material }
}

// Elke molen een eigen kabel naar het onderstation, daarna één dikke lijn de stad in
const turbineCables = [{ x: 0, z: 0 }, ...PARK_TURBINES].map(t => cable(t, SUBSTATION))
const cityCable = cable(SUBSTATION, CITY_END)
const all = [...turbineCables, cityCable]
const visibleCables = computed(() => turbineCables.slice(0, props.turbines))

const stationGeometry = new BoxGeometry(5, 2.4, 3.5)
const stationMaterial = new MeshStandardMaterial({ color: '#8a9096', roughness: 0.7, metalness: 0.3 })
const lampGeometry = new BoxGeometry(5.1, 0.25, 3.6)
const lampMaterial = new MeshStandardMaterial({ color: '#1d2a30', emissive: GLOW, emissiveIntensity: 0 })
const stationY = terrainHeight(SUBSTATION.x, SUBSTATION.z)

let phase = 0
useLoop().onBeforeRender(({ delta }) => {
  // Groen bij goedkope stroom, via geel naar rood bij dure stroom
  GLOW.setHSL((130 - Math.min(Math.max(props.priceLevel, 0), 1) * 125) / 360, 0.85, 0.58)
  lampMaterial.emissive.copy(GLOW)
  phase += delta * (3 + props.load * 22)
  for (const c of all) {
    c.material.uniforms.uPhase.value = phase
    c.material.uniforms.uLoad.value += (props.load - c.material.uniforms.uLoad.value) * Math.min(1, delta * 2)
  }
  lampMaterial.emissiveIntensity = 0.2 + props.load * 2.5 * (0.75 + 0.25 * Math.sin(phase * 0.8))
})

onUnmounted(() => {
  for (const c of all) {
    c.geometry.dispose()
    c.material.dispose()
  }
  stationGeometry.dispose()
  stationMaterial.dispose()
  lampGeometry.dispose()
  lampMaterial.dispose()
})
</script>

<template>
  <TresMesh v-for="(c, i) in visibleCables" :key="i" :geometry="c.geometry" :material="c.material" />
  <TresMesh :geometry="cityCable.geometry" :material="cityCable.material" />
  <!-- Onderstation -->
  <TresGroup :position="[SUBSTATION.x, stationY, SUBSTATION.z]" :rotation="[0, 0.4, 0]">
    <TresMesh :geometry="stationGeometry" :material="stationMaterial" :position="[0, 1.2, 0]" cast-shadow receive-shadow />
    <TresMesh :geometry="lampGeometry" :material="lampMaterial" :position="[0, 2.2, 0]" />
  </TresGroup>
</template>
