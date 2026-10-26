<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { onUnmounted } from 'vue'
import { BufferAttribute, BufferGeometry, Color, LineSegments, ShaderMaterial, Vector2 } from 'three'

/** Regen die schuin valt met de wind; de hoeveelheid volgt de gemeten neerslag. */
const props = defineProps<{
  /** Neerslag in mm per kwartier */
  precipitation: number
  windSpeed: number
  windDir: { x: number, z: number }
}>()

const DROPS = 9000
const SPAN = 80
const HEIGHT = 40

const seeds = new Float32Array(DROPS * 2 * 4)
const ends = new Float32Array(DROPS * 2)
for (let i = 0; i < DROPS; i++) {
  const s = [Math.random(), Math.random(), Math.random(), Math.random()]
  seeds.set(s, i * 8)
  seeds.set(s, i * 8 + 4)
  ends[i * 2 + 1] = 1
}
const geometry = new BufferGeometry()
geometry.setAttribute('position', new BufferAttribute(new Float32Array(DROPS * 2 * 3), 3))
geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4))
geometry.setAttribute('aEnd', new BufferAttribute(ends, 1))

const material = new ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uWindVel: { value: new Vector2() },
    uTravel: { value: new Vector2() },
    uIntensity: { value: 0 },
    uColor: { value: new Color('#c9d6e2') },
  },
  vertexShader: /* glsl */ `
    attribute vec4 aSeed;
    attribute float aEnd;
    uniform float uTime;
    uniform vec2 uWindVel;
    uniform vec2 uTravel;
    uniform float uIntensity;
    varying float vAlpha;
    const float SPAN = ${SPAN.toFixed(1)};
    const float HEIGHT = ${HEIGHT.toFixed(1)};
    void main() {
      float fall = 16.0 + aSeed.w * 6.0;
      float y = mod(aSeed.y * HEIGHT - uTime * fall, HEIGHT);
      // Wat hoger hangt, is nog bovenwinds: zo valt alles in schuine lijnen
      vec2 xz = aSeed.xz * SPAN - SPAN * 0.5 + uTravel - uWindVel * (y / fall);
      xz = mod(xz + SPAN * 0.5, SPAN) - SPAN * 0.5;
      vec3 vel = vec3(uWindVel.x, -fall, uWindVel.y);
      vec3 p = vec3(xz.x, y, xz.y) - normalize(vel) * aEnd * (0.5 + length(uWindVel) * 0.03);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float show = step(fract(aSeed.w * 91.7), uIntensity);
      vAlpha = show * (1.0 - smoothstep(SPAN * 0.3, SPAN * 0.5, length(xz))) * mix(0.55, 0.2, aEnd);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    varying float vAlpha;
    void main() {
      if (vAlpha < 0.01) discard;
      gl_FragColor = vec4(uColor, vAlpha);
      #include <colorspace_fragment>
    }
  `,
})
const rain = new LineSegments(geometry, material)
rain.frustumCulled = false

useLoop().onBeforeRender(({ elapsed, delta }) => {
  const u = material.uniforms
  u.uTime.value = elapsed
  // 0,1 mm per kwartier = motregen, 2 mm = stevige bui
  const target = props.precipitation > 0 ? Math.min(1, 0.08 + props.precipitation / 2) : 0
  u.uIntensity.value += (target - u.uIntensity.value) * Math.min(1, delta * 0.8)
  const s = props.windSpeed * 1.1
  u.uWindVel.value.x += (props.windDir.x * s - u.uWindVel.value.x) * Math.min(1, delta)
  u.uWindVel.value.y += (props.windDir.z * s - u.uWindVel.value.y) * Math.min(1, delta)
  u.uTravel.value.addScaledVector(u.uWindVel.value, delta)
  rain.visible = u.uIntensity.value > 0.005
})

onUnmounted(() => {
  geometry.dispose()
  material.dispose()
})
</script>

<template>
  <primitive :object="rain" />
</template>
