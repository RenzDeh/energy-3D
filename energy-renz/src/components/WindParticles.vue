<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { onUnmounted } from 'vue'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector2,
} from 'three'

/**
 * Stofjes/pluisjes in de lucht en dwarrelende herfstbladeren.
 * Alles beweegt op de GPU; de CPU telt enkel de afgelegde windweg op (uTravel),
 * zodat een nieuwe windrichting niets laat verspringen.
 */
const props = defineProps<{
  windSpeed: number
  windDir: { x: number, z: number }
  daylight: number
}>()

const DUST = 1400
const LEAVES = 260
const SPAN = 90

const shared = {
  uTime: { value: 0 },
  uTravel: { value: new Vector2() },
  uWind: { value: 0 },
  uSpan: { value: SPAN },
}

// Gemeenschappelijke GLSL: positie in een omwikkelend veld rond de molen
const fieldChunk = /* glsl */ `
  uniform float uTime;
  uniform vec2 uTravel;
  uniform float uWind;
  uniform float uSpan;
  vec2 wrapField(vec2 start, float speedFactor) {
    float h = uSpan * 0.5;
    return mod(start * uSpan - h + uTravel * speedFactor + h, uSpan) - h;
  }
`

// --- Stof ---
const dustSeeds = new Float32Array(DUST * 4)
for (let i = 0; i < dustSeeds.length; i++) dustSeeds[i] = Math.random()
const dustGeometry = new BufferGeometry()
dustGeometry.setAttribute('position', new BufferAttribute(new Float32Array(DUST * 3), 3))
dustGeometry.setAttribute('aSeed', new BufferAttribute(dustSeeds, 4))

const dustMaterial = new ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  uniforms: {
    ...shared,
    uColor: { value: new Color('#fff6dc') },
    uOpacity: { value: 0.7 },
    uScale: { value: window.innerHeight / 2 },
  },
  vertexShader: /* glsl */ `
    ${fieldChunk}
    attribute vec4 aSeed;
    uniform float uScale;
    varying float vAlpha;
    void main() {
      float ph = aSeed.w * 6.2831;
      float height = 0.3 + aSeed.y * aSeed.y * 18.0;
      vec3 p = vec3(0.0, height, 0.0);
      p.xz = wrapField(aSeed.xz, 0.7 + aSeed.y * 0.6);
      float turb = 0.4 + uWind * 0.06;
      p.x += sin(uTime * 1.3 + ph + p.z * 0.2) * turb;
      p.z += cos(uTime * 1.1 + ph * 1.3 + p.x * 0.2) * turb;
      p.y += sin(uTime * (0.6 + aSeed.x) + ph) * 0.6;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (0.05 + aSeed.w * 0.07) * uScale / -mv.z;
      float edge = 1.0 - smoothstep(uSpan * 0.32, uSpan * 0.5, length(p.xz));
      vAlpha = edge * smoothstep(0.5, 4.0, uWind) * (0.5 + 0.5 * sin(uTime * 2.0 + ph));
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d) * vAlpha * uOpacity;
      if (a < 0.01) discard;
      gl_FragColor = vec4(uColor, a);
      #include <colorspace_fragment>
    }
  `,
})
const dust = new Points(dustGeometry, dustMaterial)
dust.frustumCulled = false

// --- Bladeren ---
const leafGeometry = new PlaneGeometry(0.26, 0.16, 2, 1)
// Licht geplooid, zodat een blad niet plat oogt
const lp = leafGeometry.attributes.position
for (let i = 0; i < lp.count; i++) lp.setZ(i, Math.abs(lp.getX(i)) * 0.35)
leafGeometry.computeVertexNormals()
const leafSeeds = new Float32Array(LEAVES * 4)
for (let i = 0; i < leafSeeds.length; i++) leafSeeds[i] = Math.random()
leafGeometry.setAttribute('aSeed', new InstancedBufferAttribute(leafSeeds, 4))

const leafMaterial = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.8 })
leafMaterial.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, shared)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      ${fieldChunk}
      attribute vec4 aSeed;
      mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
      mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
      mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0, -s, c, 0, 0, 0, 1); }`)
    .replace('#include <beginnormal_vertex>', `
      float ph = aSeed.w * 6.2831;
      // Hoe harder de wind, hoe wilder de bladeren tuimelen
      float spin = uTime * (1.0 + aSeed.y * 2.5) * (0.15 + uWind * 0.14) + ph;
      mat3 tumble = rotY(spin * 0.7 + ph) * rotX(spin) * rotZ(spin * 1.3);
      vec3 objectNormal = tumble * vec3(normal);
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3(tangent.xyz);
      #endif`)
    .replace('#include <begin_vertex>', `
      vec3 transformed = tumble * vec3(position);
      vec3 offset = vec3(0.0);
      offset.xz = wrapField(aSeed.xz, 0.8 + aSeed.y * 0.5);
      // Bladeren huppelen over de grond en vliegen op bij rukwinden
      float lift = smoothstep(2.0, 12.0, uWind);
      offset.y = 0.12 + abs(sin(uTime * (0.7 + aSeed.y) + ph)) * (0.2 + lift * 4.0 * aSeed.y);
      offset.x += sin(uTime * 1.7 + ph) * 0.5 * lift;
      offset.z += cos(uTime * 1.3 + ph) * 0.5 * lift;
      float edge = 1.0 - smoothstep(uSpan * 0.36, uSpan * 0.5, length(offset.xz));
      transformed = transformed * edge + offset;`)
}
const leaves = new InstancedMesh(leafGeometry, leafMaterial, LEAVES)
leaves.frustumCulled = false
const palette = ['#c2662d', '#d99a2b', '#9c3d23', '#b5872f', '#7d6a2b'].map(c => new Color(c))
for (let i = 0; i < LEAVES; i++) leaves.setColorAt(i, palette[i % palette.length])

let speed = props.windSpeed
useLoop().onBeforeRender(({ delta, elapsed }) => {
  speed += (props.windSpeed - speed) * Math.min(1, delta)
  shared.uTime.value = elapsed
  shared.uWind.value = speed
  shared.uTravel.value.x += props.windDir.x * speed * delta
  shared.uTravel.value.y += props.windDir.z * speed * delta
  // Overdag lichten de stofjes op in de zon, 's nachts zie je ze nauwelijks
  dustMaterial.uniforms.uOpacity.value = MathUtils.lerp(0.12, 0.7, props.daylight)
})

onUnmounted(() => {
  dustGeometry.dispose()
  dustMaterial.dispose()
  leafGeometry.dispose()
  leafMaterial.dispose()
})
</script>

<template>
  <primitive :object="dust" />
  <primitive :object="leaves" />
</template>
