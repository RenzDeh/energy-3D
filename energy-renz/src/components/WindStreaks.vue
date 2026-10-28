<script setup lang="ts">
import { useLoop, useTres } from '@tresjs/core'
import { onUnmounted } from 'vue'
import { MathUtils, Vector3 } from 'three'
import { Ribbons } from '../lib/ribbons'
import { BLADE_LENGTH, HUB_HEIGHT, HUB_Z } from '../lib/turbineParts'

/**
 * Windlinten: zachte strepen die met een eenvoudig windveld meestromen.
 * Ze worden sneller hoger in de lucht (windprofiel), wervelen wat, buigen rond de mast
 * en vertragen en draaien achter de rotor.
 */
const props = defineProps<{
  /** Windsnelheid op 10 m (m/s) */
  windSpeed: number
  /** Richting waarin de wind waait, eenheidsvector in het XZ-vlak */
  windDir: { x: number, z: number }
  /** Richting van de rotor in graden rond Y */
  yawDeg: number
  color: string
}>()

const COUNT = 90
const POINTS = 34
const SAMPLE_DT = 0.07
const RADIUS = 48
const MAX_HEIGHT = 34

const ribbons = new Ribbons(COUNT, POINTS, { color: props.color, opacity: 0.5 })

interface Trail { x: number, y: number, z: number, age: number, life: number, timer: number }
const trails: Trail[] = Array.from({ length: COUNT }, () => ({ x: 0, y: 0, z: 0, age: 0, life: 0, timer: 0 }))

function spawn(i: number, anywhere: boolean) {
  const t = trails[i]
  const dir = props.windDir
  // Liefst bovenwinds starten, zodat de linten over de molen heen stromen
  const along = anywhere ? (Math.random() * 2 - 1) * RADIUS : -RADIUS * (0.3 + Math.random() * 0.7)
  const across = (Math.random() * 2 - 1) * RADIUS * 0.8
  t.x = dir.x * along - dir.z * across
  t.z = dir.z * along + dir.x * across
  t.y = 0.8 + Math.random() ** 1.6 * MAX_HEIGHT
  t.age = anywhere ? Math.random() * 3 : 0
  t.life = 5 + Math.random() * 5
  t.timer = 0
  ribbons.width[i] = 0.12 + Math.random() * 0.22
  ribbons.reset(i, t.x, t.y, t.z)
}
for (let i = 0; i < COUNT; i++) { spawn(i, true) }

const v = new Vector3()
let speed = props.windSpeed
let yaw = MathUtils.degToRad(props.yawDeg)

/** Snelheid van de lucht op punt (x, y, z), in scène-eenheden per seconde. */
function sampleWind(x: number, y: number, z: number, time: number) {
  const { x: dx, z: dz } = props.windDir
  // Windprofiel: hogerop waait het harder (machtswet met exponent 1/7)
  const profile = (Math.max(y, 0.5) / 10) ** 0.14
  const gust = 1 + 0.22 * Math.sin(time * 0.6 + x * 0.045 + z * 0.04)
  const base = speed * profile * gust
  const turb = 0.35 + speed * 0.07
  v.set(
    dx * base + Math.sin(z * 0.11 + time * 0.9 + y * 0.2) * turb,
    Math.sin(x * 0.09 + z * 0.07 + time * 1.1) * turb * 0.35,
    dz * base + Math.cos(x * 0.1 - time * 0.8 + y * 0.15) * turb,
  )

  // Rond de mast stroomt de lucht opzij
  const r = Math.hypot(x, z)
  if (r < 4 && y < HUB_HEIGHT && r > 0.01) {
    const push = ((4 - r) / 4) * base * 1.4
    v.x += (x / r) * push
    v.z += (z / r) * push
  }

  // Achter de rotor: trager (energie afgegeven) en met een draaiing tegen de rotor in
  const ax = Math.sin(yaw)
  const az = Math.cos(yaw)
  const ox = x - ax * HUB_Z
  const oy = y - HUB_HEIGHT
  const oz = z - az * HUB_Z
  const along = ox * ax + oz * az
  if (along < 0.5 && along > -45) {
    const rx = ox - ax * along
    const rz = oz - az * along
    const radial = Math.hypot(rx, oy, rz)
    const R = BLADE_LENGTH * (1 + -along * 0.006)
    if (radial < R) {
      const k = 1 - MathUtils.smoothstep(radial, R * 0.75, R)
      v.multiplyScalar(1 - 0.38 * k)
      // Tangentiële draaiing rond de rotoras
      const swirl = 0.08 * base * k
      v.x += (oy * az) * swirl / R * 3
      v.y += (rz * ax - rx * az) * swirl / R * 3
      v.z += (-oy * ax) * swirl / R * 3
    }
  }

  // Niet door de grond
  if (y < 0.6) { v.y += (0.6 - y) * 2 }
  return v
}

const { camera } = useTres()
const cam = new Vector3()

useLoop().onBeforeRender(({ delta, elapsed }) => {
  const dt = Math.min(delta, 0.05)
  speed += (props.windSpeed - speed) * Math.min(1, dt * 1.5)
  const yawTarget = MathUtils.degToRad(props.yawDeg)
  yaw += (MathUtils.euclideanModulo(yawTarget - yaw + Math.PI, Math.PI * 2) - Math.PI) * (1 - Math.exp(-0.8 * dt))
  ribbons.uniforms.uColor.value.set(props.color)

  // Bij weinig wind maar een handvol linten, bij veel wind het hele veld
  const density = MathUtils.clamp(0.15 + speed / 9, 0, 1) * COUNT
  const P = ribbons.points

  for (let i = 0; i < COUNT; i++) {
    const t = trails[i]
    const w = sampleWind(t.x, t.y, t.z, elapsed)
    t.x += w.x * dt
    t.y += w.y * dt
    t.z += w.z * dt
    t.age += dt
    t.timer += dt

    const base = i * POINTS * 3
    if (t.timer >= SAMPLE_DT) {
      t.timer -= SAMPLE_DT
      P.copyWithin(base + 6, base + 3, base + (POINTS - 1) * 3)
      P[base + 3] = t.x
      P[base + 4] = t.y
      P[base + 5] = t.z
    }
    P[base] = t.x
    P[base + 1] = t.y
    P[base + 2] = t.z

    const fade = MathUtils.smoothstep(t.age, 0, 1.2) * (1 - MathUtils.smoothstep(t.age, t.life - 1.5, t.life))
    ribbons.alpha[i] = fade * MathUtils.clamp(density - i, 0, 1)

    if (t.age > t.life || Math.hypot(t.x, t.z) > RADIUS * 1.25) { spawn(i, false) }
  }

  if (camera.value) { cam.setFromMatrixPosition(camera.value.matrixWorld) }
  ribbons.update(cam)
})

onUnmounted(() => ribbons.dispose())
</script>

<template>
  <primitive :object="ribbons.mesh" />
</template>
