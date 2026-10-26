<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { computed, onUnmounted, shallowRef } from 'vue'
import { MathUtils } from 'three'
import type { Group } from 'three'
import {
  BLADE_LENGTH,
  HUB_Z,
  TOWER_HEIGHT,
  createBladeMaterial,
  geometries as g,
  materials as m,
  towerRadius,
} from '../lib/turbineParts'
import TipVortices from './TipVortices.vue'

const props = withDefaults(defineProps<{
  /** Doeltoerental van de rotor */
  rpm: number
  /** Richting waarin de rotor wijst, in graden rond Y */
  yawDeg: number
  /** Windsnelheid op ashoogte (m/s), voor de stuwkracht en het zog */
  hubSpeed: number
  /** Bladen in vaanstand (stormstop) */
  feathered?: boolean
  /** 0..1 hoe sterk de rukwinden het toerental laten variëren */
  gustiness?: number
  /** 's Nachts knippert het obstakellicht */
  night?: boolean
  position?: [number, number, number]
  scale?: number
  /** Faseverschuiving zodat molens in een park niet synchroon draaien */
  phase?: number
  /** Extra details (tipwervels, anemometer) enkel voor de hoofdmolen */
  detailed?: boolean
  wakeColor?: string
  /** Schaal van de rotor (bladlengte) ten opzichte van de standaardmolen */
  rotorScale?: number
}>(), {
  rotorScale: 1,
  feathered: false,
  gustiness: 0.1,
  night: false,
  position: () => [0, 0, 0],
  scale: 1,
  phase: 0,
  detailed: false,
  wakeColor: '#ffffff',
})

const bladeAngles = [0, 1, 2].map(i => (i * 2 * Math.PI) / 3)
const flanges = [8, 16].map(y => ({ y, r: towerRadius(y) + 0.02 }))
const coolerFins = [-0.6, -0.3, 0, 0.3, 0.6]
const { material: bladeMaterial, uniforms: bladeUniforms } = createBladeMaterial()

const swayRef = shallowRef<Group>()
const nacelleRef = shallowRef<Group>()
const rotorRef = shallowRef<Group>()
const anemometerRef = shallowRef<Group>()
const bladeRefs: Group[] = []

// Gedeeld met de tipwervels (bewust niet reactief: wordt elk frame overschreven)
const rotor = { angle: props.phase, omega: 0, wake: 0 }
let yaw = MathUtils.degToRad(props.yawDeg)
let pitch = 0
let thrust = 0
const initialYaw = yaw

const targetYaw = computed(() => MathUtils.degToRad(props.yawDeg))

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta, elapsed }) => {
  const t = elapsed + props.phase * 3

  // Rotor komt geleidelijk op gang en rolt uit, met kleine variaties door de rukwinden
  const gust = 1 + props.gustiness * (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3 + 1.7) * 0.4)
  const target = (props.rpm * gust * 2 * Math.PI) / 60
  rotor.omega = MathUtils.damp(rotor.omega, target, 0.6, delta)
  rotor.angle += rotor.omega * delta
  // Het zog stroomt trager weg dan de vrije wind: de rotor heeft er energie uit gehaald
  rotor.wake = MathUtils.damp(rotor.wake, Math.max(props.hubSpeed * 0.65, 1.5), 1, delta)
  if (rotorRef.value) rotorRef.value.rotation.z = rotor.angle

  // Gondel draait traag mee met de windrichting (kortste weg)
  const diff = MathUtils.euclideanModulo(targetYaw.value - yaw + Math.PI, Math.PI * 2) - Math.PI
  yaw += diff * (1 - Math.exp(-0.8 * delta))
  if (nacelleRef.value) nacelleRef.value.rotation.y = yaw

  // Bladhoek: vaanstand bij storm, licht bijgesteld boven nominale wind
  const pitchTarget = props.feathered ? Math.PI / 2 : MathUtils.clamp((props.hubSpeed - 12) * 0.03, 0, 0.35)
  pitch = MathUtils.damp(pitch, pitchTarget, 1.2, delta)
  for (const blade of bladeRefs) blade.rotation.y = pitch

  // Stuwkracht ~ toerental: buigt de bladen en laat de toren licht meewiegen
  thrust = MathUtils.damp(thrust, rotor.omega / 1.57, 1, delta)
  bladeUniforms.uFlex.value = thrust * 0.45 + Math.sin(t * 1.7) * 0.03 * thrust
  if (swayRef.value) {
    const lean = 0.0035 * thrust + 0.0012 * thrust * Math.sin(t * 0.55)
    // Benedenwinds = tegenovergesteld aan waar de rotor naartoe wijst
    const dx = -Math.sin(yaw)
    const dz = -Math.cos(yaw)
    swayRef.value.rotation.x = lean * dz
    swayRef.value.rotation.z = -lean * dx
  }

  if (anemometerRef.value) anemometerRef.value.rotation.y -= delta * (0.5 + props.hubSpeed * 0.9)

  // Obstakellicht: 's nachts knipperend (1 s aan, 1 s uit), overdag zacht aan
  m.light.emissiveIntensity = props.night ? (Math.floor(elapsed) % 2 === 0 ? 6 : 0.15) : 0.8
})

function setBlade(el: unknown, i: number) {
  if (el) bladeRefs[i] = el as Group
}

onUnmounted(() => bladeMaterial.dispose())
</script>

<template>
  <TresGroup :position="position" :scale="scale">
    <!-- Fundering -->
    <TresMesh :geometry="g.foundation" :material="m.concrete" :position="[0, 0.1, 0]" cast-shadow receive-shadow />
    <TresMesh :geometry="g.plinth" :material="m.concrete" :position="[0, 0.52, 0]" cast-shadow receive-shadow />

    <!-- Alles boven de fundering wiegt een heel klein beetje mee met de wind -->
    <TresGroup ref="swayRef" :position="[0, 0.5, 0]">
      <TresMesh :geometry="g.tower" :material="m.tower" cast-shadow receive-shadow />
      <TresMesh
        v-for="f in flanges"
        :key="f.y"
        :geometry="g.flange"
        :material="m.flange"
        :position="[0, f.y, 0]"
        :scale="[f.r, 1, f.r]"
        cast-shadow
      />
      <!-- Groene band onderaan de mast -->
      <TresMesh :position="[0, 1.5, 0]" :material="m.band" cast-shadow>
        <TresCylinderGeometry :args="[1.035, 1.05, 1.6, 64, 1, true]" />
      </TresMesh>

      <!-- Toegangsdeur met trapje -->
      <TresGroup :position="[0, 0, 0]">
        <TresMesh :geometry="g.doorFrame" :material="m.flange" :position="[0, 1.15, 1.03]" />
        <TresMesh :geometry="g.door" :material="m.door" :position="[0, 1.15, 1.07]" />
        <TresMesh :geometry="g.step" :material="m.metal" :position="[0, 0.3, 1.45]" cast-shadow />
        <TresMesh :geometry="g.railing" :material="m.metal" :position="[0.52, 0.6, 1.6]" />
        <TresMesh :geometry="g.railing" :material="m.metal" :position="[-0.52, 0.6, 1.6]" />
      </TresGroup>

      <!-- Gondel + rotor draaien samen mee met de wind (yaw) -->
      <TresGroup ref="nacelleRef" :position="[0, TOWER_HEIGHT, 0]" :rotation="[0, initialYaw, 0]">
        <TresMesh :geometry="g.yawBearing" :material="m.dark" :position="[0, 0.12, 0]" />
        <TresMesh :geometry="g.nacelle" :material="m.shell" :position="[0, 1.05, 0]" cast-shadow receive-shadow />

        <!-- Koeler bovenaan achteraan -->
        <TresMesh :geometry="g.cooler" :material="m.flange" :position="[0, 2.32, -2.5]" cast-shadow />
        <TresMesh
          v-for="z in coolerFins"
          :key="z"
          :geometry="g.coolerFin"
          :material="m.dark"
          :position="[0, 2.6, -2.5 + z]"
        />

        <!-- Meetmast met draaiende anemometer en windvaan -->
        <TresGroup :position="[0, 2.25, -3.3]">
          <TresMesh :geometry="g.mast" :material="m.dark" :position="[0.35, 0.45, 0]" />
          <TresMesh :geometry="g.mast" :material="m.dark" :position="[-0.35, 0.45, 0]" />
          <TresGroup v-if="detailed" ref="anemometerRef" :position="[0.35, 0.95, 0]">
            <TresMesh :geometry="g.arm" :material="m.dark" :scale="[0.5, 1, 1]" />
            <TresMesh :geometry="g.arm" :material="m.dark" :scale="[0.5, 1, 1]" :rotation="[0, Math.PI / 1.5, 0]" />
            <TresMesh :geometry="g.arm" :material="m.dark" :scale="[0.5, 1, 1]" :rotation="[0, -Math.PI / 1.5, 0]" />
            <TresMesh
              v-for="a in [0, 1, 2]"
              :key="a"
              :geometry="g.cup"
              :material="m.dark"
              :position="[Math.cos((a * 2 * Math.PI) / 3) * 0.22, 0, Math.sin((a * 2 * Math.PI) / 3) * 0.22]"
              :rotation="[0, -(a * 2 * Math.PI) / 3, Math.PI / 2]"
            />
          </TresGroup>
          <TresMesh :geometry="g.vane" :material="m.dark" :position="[-0.35, 0.95, -0.12]" />
          <TresMesh :geometry="g.light" :material="m.light" :position="[0, 0.72, 0.25]" />
        </TresGroup>

        <!-- Rotor: naaf, spinner en 3 bladen -->
        <TresGroup ref="rotorRef" :position="[0, 1.05, HUB_Z]" :rotation="[0, 0, phase]" :scale="[rotorScale, rotorScale, rotorScale]">
          <TresMesh :geometry="g.hubRing" :material="m.shell" :position="[0, 0, -0.2]" cast-shadow />
          <TresMesh :geometry="g.spinner" :material="m.shell" :position="[0, 0, 0.05]" cast-shadow />
          <TresGroup v-for="(a, i) in bladeAngles" :key="i" :rotation="[0, 0, a]">
            <TresGroup :ref="(el: unknown) => setBlade(el, i)">
              <TresMesh :geometry="g.pitchBearing" :material="m.dark" :position="[0, 0.95, -0.1]" />
              <TresMesh :geometry="g.bladeRoot" :material="m.shell" :position="[0, 1.45, -0.1]" cast-shadow />
              <TresMesh :geometry="g.blade" :material="bladeMaterial" :position="[0, 0, -0.1]" cast-shadow receive-shadow />
            </TresGroup>
          </TresGroup>
        </TresGroup>

        <TipVortices
          v-if="detailed"
          :rotor="rotor"
          :radius="BLADE_LENGTH * 0.98 * rotorScale"
          :hub-y="1.05"
          :hub-z="HUB_Z"
          :color="wakeColor"
        />
      </TresGroup>
    </TresGroup>
  </TresGroup>
</template>
