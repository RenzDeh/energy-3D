import { computed, ref, watch } from 'vue'
import { RATED_POWER_KW, powerKw } from '../lib/turbine'
import { useLocation } from './useLocation'
import { useWindData } from './useWindData'

/** Gemiddeld Vlaams gezin: ongeveer 3500 kWh elektriciteit per jaar */
export const HOUSEHOLD_KWH_YEAR = 3500
/** Gemiddeld vermogen van één gezin (kW) */
export const HOUSEHOLD_KW = HOUSEHOLD_KWH_YEAR / 8760
export const MAX_TURBINES = 6

// Regelbare parameters, gedeeld met de scène, de HUD en de spraakbesturing
const turbineCount = ref(MAX_TURBINES)
/** Rotordiameter ten opzichte van de standaardmolen (0,7..1,3); vermogen schaalt met de rotoroppervlakte */
const rotorScale = ref(1)
/** Hoeveel uur verwachting er per seconde voorbijgaat bij het afspelen */
const playbackRate = ref(0.4)
const playing = ref(false)

/** Vermogen van het hele park bij een windsnelheid op ashoogte (kW). */
function farmKw(v100: number): number {
  return powerKw(v100) * rotorScale.value ** 2 * turbineCount.value
}

let raf = 0
let last = 0
let watching = false

export function useEnergy() {
  const { wind, playbackHours, simulation } = useWindData()
  const { households: cityHouseholds } = useLocation()

  // Een simulatie starten onderbreekt het afspelen
  if (!watching) {
    watching = true
    watch(simulation, (sim) => {
      if (sim) pause()
    })
  }

  const kw = computed(() => farmKw(wind.value.speed100))
  const ratedKw = computed(() => RATED_POWER_KW * rotorScale.value ** 2 * turbineCount.value)
  const households = computed(() => kw.value / HOUSEHOLD_KW)
  /** Aandeel van de gezinnen in de gekozen stad dat nu van stroom voorzien wordt (0..1) */
  const cityShare = computed(() => Math.min(1, households.value / cityHouseholds.value))

  /** Vermogen per uur volgens de verwachting */
  const curve = computed(() => wind.value.forecast.map(p => ({ time: p.time, iso: p.iso, kw: farmKw(p.speed100) })))
  const hours = computed(() => Math.max(0, curve.value.length - 1))

  /** Energie (kWh) tussen het begin van de verwachting en `t` uur later (trapeziumregel) */
  function energyUntil(t: number): number {
    const c = curve.value
    let total = 0
    for (let i = 0; i < c.length - 1 && i < t; i++) {
      const span = Math.min(1, t - i)
      const end = c[i].kw + (c[i + 1].kw - c[i].kw) * span
      total += ((c[i].kw + end) / 2) * span
    }
    return total
  }

  const position = computed(() => playbackHours.value ?? 0)
  const energyKwh = computed(() => energyUntil(position.value))
  const dayKwh = computed(() => energyUntil(hours.value))
  // In simulatie is de wind constant: energie per dag = vermogen × 24 u
  const simDayKwh = computed(() => kw.value * 24)

  function tick(time: number) {
    const dt = Math.min(0.1, (time - last) / 1000)
    last = time
    const next = (playbackHours.value ?? 0) + dt * playbackRate.value
    if (next >= hours.value) {
      playbackHours.value = hours.value
      playing.value = false
      return
    }
    playbackHours.value = next
    raf = requestAnimationFrame(tick)
  }

  function play() {
    if (!hours.value) return
    if (simulation.value) simulation.value = null
    if (playbackHours.value === null || playbackHours.value >= hours.value) playbackHours.value = 0
    playing.value = true
    cancelAnimationFrame(raf)
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }

  function pause() {
    playing.value = false
    cancelAnimationFrame(raf)
  }

  /** Afspelen stoppen en terug naar het huidige moment */
  function reset() {
    pause()
    playbackHours.value = null
  }

  function seek(t: number) {
    if (simulation.value) simulation.value = null
    playbackHours.value = Math.min(Math.max(t, 0), hours.value)
  }

  return {
    kw,
    ratedKw,
    households,
    cityShare,
    cityHouseholds,
    curve,
    hours,
    position,
    energyKwh,
    dayKwh,
    simDayKwh,
    turbineCount,
    rotorScale,
    playbackRate,
    playing,
    playbackHours,
    play,
    pause,
    reset,
    seek,
  }
}

