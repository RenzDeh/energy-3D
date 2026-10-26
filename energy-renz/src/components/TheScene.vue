<script setup lang="ts">
import { OrbitControls } from '@tresjs/cientos'
import { useTres } from '@tresjs/core'
import { computed, watchEffect } from 'vue'
import { Fog } from 'three'
import { useEnvironment } from '../composables/useEnvironment'
import { useWindData } from '../composables/useWindData'
import { PARK_TURBINES } from '../lib/scenery'
import { rotorRpm, turbineState, windVector } from '../lib/turbine'
import Clouds from './Clouds.vue'
import Grass from './Grass.vue'
import Kortrijk from './Kortrijk.vue'
import Ground from './Ground.vue'
import Rain from './Rain.vue'
import SkyDome from './SkyDome.vue'
import Trees from './Trees.vue'
import WindParticles from './WindParticles.vue'
import WindStreaks from './WindStreaks.vue'
import Windmill from './Windmill.vue'

const { wind } = useWindData()
const { colors, light, ambient, daylight, sunDir } = useEnvironment()

// De turbine reageert op de wind op ashoogte, het gras en de strepen op de wind dichtbij de grond
const hubSpeed = computed(() => wind.value.speed100)
const rpm = computed(() => rotorRpm(hubSpeed.value))
const feathered = computed(() => turbineState(hubSpeed.value) === 'storm')
const blowing = computed(() => windVector(wind.value.directionDeg))
// De rotor wijst naar waar de wind vandaan komt
const yawDeg = computed(() => {
  const from = { x: -blowing.value.x, z: -blowing.value.z }
  return (Math.atan2(from.x, from.z) * 180) / Math.PI
})
// Gust-gevoeligheid: hoe meer rukwinden tegenover de gemiddelde wind, hoe onrustiger de rotor
const gustiness = computed(() => {
  const { speed10, gusts } = wind.value
  return Math.min(0.2, Math.max(0.03, (gusts - speed10) / Math.max(speed10, 1) * 0.15))
})

// Mist in de kleur van de horizon, zodat het landschap in de lucht overloopt
const fog = new Fog(colors.value.horizon, 80, 320)
useTres().scene.value.fog = fog
watchEffect(() => fog.color.set(colors.value.horizon))

const night = computed(() => daylight.value < 0.35)
// Windlinten: wit overdag, zachtblauw 's nachts
const streakColor = computed(() => (night.value ? '#8fb3ff' : '#ffffff'))
</script>

<template>
  <TresPerspectiveCamera :position="[46, 12, 22]" :fov="45" :near="0.5" :far="1000" />
  <OrbitControls
    :target="[0, 14, 0]"
    :enable-damping="true"
    :damping-factor="0.06"
    :min-distance="14"
    :max-distance="110"
    :max-polar-angle="Math.PI / 2 - 0.04"
    :enable-pan="false"
  />

  <SkyDome
    :top="colors.top"
    :horizon="colors.horizon"
    :sun-dir="sunDir"
    :sun-color="light.color"
    :daylight="daylight"
    :cloud-cover="wind.cloudCover"
  />

  <TresHemisphereLight :color="colors.top" ground-color="#4d6b3a" :intensity="ambient" />
  <TresDirectionalLight
    :position="light.position"
    :intensity="light.intensity"
    :color="light.color"
    cast-shadow
    :shadow-mapSize-width="2048"
    :shadow-mapSize-height="2048"
    :shadow-camera-left="-48"
    :shadow-camera-right="48"
    :shadow-camera-top="48"
    :shadow-camera-bottom="-48"
    :shadow-camera-near="10"
    :shadow-camera-far="200"
    :shadow-bias="-0.0004"
    :shadow-normal-bias="0.04"
  />

  <Ground />
  <Grass :wind-speed="wind.speed10" :wind-dir="blowing" />
  <Trees :wind-speed="wind.speed10" :wind-dir="blowing" />
  <Kortrijk :night="night" />
  <Clouds
    :wind-speed="wind.speed10"
    :wind-dir="blowing"
    :cloud-cover="wind.cloudCover"
    :daylight="daylight"
    :tint="colors.horizon"
  />

  <Windmill
    :rpm="rpm"
    :yaw-deg="yawDeg"
    :hub-speed="hubSpeed"
    :feathered="feathered"
    :gustiness="gustiness"
    :night="night"
    :wake-color="streakColor"
    detailed
  />
  <Windmill
    v-for="t in PARK_TURBINES"
    :key="t.x"
    :rpm="rpm"
    :yaw-deg="yawDeg"
    :hub-speed="hubSpeed"
    :feathered="feathered"
    :gustiness="gustiness"
    :night="night"
    :position="[t.x, t.y, t.z]"
    :scale="t.scale"
    :phase="t.phase"
  />

  <WindStreaks :wind-speed="wind.speed10" :wind-dir="blowing" :yaw-deg="yawDeg" :color="streakColor" />
  <WindParticles :wind-speed="wind.speed10" :wind-dir="blowing" :daylight="daylight" />
  <Rain :precipitation="wind.precipitation" :wind-speed="wind.speed10" :wind-dir="blowing" />
</template>
