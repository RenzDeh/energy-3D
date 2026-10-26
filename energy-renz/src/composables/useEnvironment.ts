import { computed, onScopeDispose, ref } from 'vue'
import { Color, MathUtils } from 'three'
import { sunDirection, sunPosition } from '../lib/sun'
import { LOCATION, playbackDate, useWindData } from './useWindData'

const NIGHT_TOP = new Color('#060b18')
const NIGHT_HORIZON = new Color('#1a2440')
const DAY_TOP = new Color('#3f84d4')
const DAY_HORIZON = new Color('#c4e2f4')
const DUSK_HORIZON = new Color('#f29b63')
const DUSK_TOP = new Color('#4a5f9c')
const OVERCAST = new Color('#a3adb5')
const SUN_LOW = new Color('#ffad70')
const SUN_HIGH = new Color('#fff3df')
const MOON = new Color('#9fb6e8')

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined
let users = 0

const hex = (c: Color) => `#${c.getHexString()}`

/** Licht en luchtkleuren op basis van de echte zonnestand (of het gesimuleerde uur) en de bewolking. */
export function useEnvironment() {
  const { wind, simulation, playbackHours } = useWindData()
  if (users++ === 0) timer = setInterval(() => (now.value = new Date()), 30_000)
  onScopeDispose(() => {
    if (--users === 0) clearInterval(timer)
  })

  const date = computed(() => {
    const sim = simulation.value
    if (!sim) {
      // Tijdens het afspelen van de dag loopt de zon mee
      const replay = playbackHours.value === null ? null : playbackDate(wind.value.forecast, playbackHours.value)
      return replay ?? now.value
    }
    const d = new Date(now.value)
    d.setHours(0, 0, 0, 0)
    d.setTime(d.getTime() + sim.hour * 3600_000)
    return d
  })

  const sun = computed(() => sunPosition(date.value, LOCATION.latitude, LOCATION.longitude))
  const elevationDeg = computed(() => MathUtils.radToDeg(sun.value.altitude))
  /** 0 = nacht, 1 = volle dag (met schemering ertussen) */
  const daylight = computed(() => MathUtils.smoothstep(elevationDeg.value, -7, 7))
  /** Hoe sterk de oranje gloed van zonsop- of ondergang is */
  const dusk = computed(() => Math.max(0, 1 - Math.abs(elevationDeg.value - 1) / 9) * (1 - wind.value.cloudCover / 140))
  const overcast = computed(() => (wind.value.cloudCover / 100) * 0.65)

  const colors = computed(() => {
    const day = daylight.value
    const top = NIGHT_TOP.clone().lerp(DAY_TOP, day).lerp(DUSK_TOP, dusk.value * 0.5)
    const horizon = NIGHT_HORIZON.clone().lerp(DAY_HORIZON, day).lerp(DUSK_HORIZON, dusk.value * 0.75)
    top.lerp(OVERCAST.clone().multiplyScalar(0.35 + day * 0.65), overcast.value)
    horizon.lerp(OVERCAST.clone().multiplyScalar(0.3 + day * 0.7), overcast.value)
    return { top: hex(top), horizon: hex(horizon) }
  })

  const sunDir = computed(() => sunDirection(sun.value))
  /** Positie van het hoofdlicht: de zon overdag, de maan (tegenover) 's nachts */
  const light = computed(() => {
    const [x, y, z] = sunDir.value
    const isSun = y > -0.05
    const dir = isSun ? [x, Math.max(y, 0.06), z] : [-x, Math.max(-y, 0.3), -z]
    const len = Math.hypot(dir[0], dir[1], dir[2])
    const position = dir.map(v => (v / len) * 90) as [number, number, number]
    const cloudDim = 1 - (wind.value.cloudCover / 100) * 0.6
    const color = isSun
      ? hex(SUN_LOW.clone().lerp(SUN_HIGH, MathUtils.smoothstep(elevationDeg.value, 0, 25)))
      : hex(MOON)
    const intensity = isSun
      ? 3.4 * MathUtils.smoothstep(elevationDeg.value, -3, 10) * cloudDim + 0.05
      : 0.45 * cloudDim
    return { position, color, intensity }
  })

  const ambient = computed(() => 0.32 + daylight.value * 1.15)

  return { date, sun, sunDir, elevationDeg, daylight, dusk, colors, light, ambient }
}
