<script setup lang="ts">
import { watchEffect } from 'vue'
import { BackSide, Color, ShaderMaterial, SphereGeometry, Vector3 } from 'three'

const props = defineProps<{
  top: string
  horizon: string
  sunDir: [number, number, number]
  sunColor: string
  /** 0 = nacht, 1 = dag */
  daylight: number
  cloudCover: number
}>()

const material = new ShaderMaterial({
  side: BackSide,
  depthWrite: false,
  uniforms: {
    uTop: { value: new Color() },
    uHorizon: { value: new Color() },
    uSunDir: { value: new Vector3() },
    uSunColor: { value: new Color() },
    uSunVisible: { value: 1 },
    uNight: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww; // altijd op het verre vlak
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform float uSunVisible;
    uniform float uNight;
    varying vec3 vDir;

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    void main() {
      vec3 dir = normalize(vDir);
      float h = dir.y;
      vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.6, h));

      // Zonneschijf en gloed
      float s = max(dot(dir, normalize(uSunDir)), 0.0);
      col += uSunColor * (pow(s, 1200.0) * 6.0 + pow(s, 40.0) * 0.25 + pow(s, 6.0) * 0.12) * uSunVisible;

      // Sterren 's nachts
      if (uNight > 0.01 && h > 0.0) {
        vec3 cell = floor(dir * 260.0);
        float star = step(0.9975, hash(cell));
        col += vec3(star) * uNight * smoothstep(0.0, 0.25, h) * (0.6 + 0.4 * hash(cell + 3.0));
      }

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
})

const geometry = new SphereGeometry(450, 48, 24)

watchEffect(() => {
  const u = material.uniforms
  u.uTop.value.set(props.top)
  u.uHorizon.value.set(props.horizon)
  u.uSunDir.value.set(...props.sunDir)
  u.uSunColor.value.set(props.sunColor)
  u.uSunVisible.value = (props.sunDir[1] > -0.05 ? 1 : 0) * (1 - props.cloudCover / 115)
  u.uNight.value = (1 - props.daylight) * (1 - props.cloudCover / 100)
})
</script>

<template>
  <TresMesh :geometry="geometry" :material="material" :render-order="-1" :frustum-culled="false" />
</template>
