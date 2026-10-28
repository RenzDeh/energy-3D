import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useLocation } from './useLocation'
import type { Place } from './useLocation'

const REFRESH_MS = 10 * 60 * 1000
const TIMEOUT_MS = 10 * 1000
const FALLBACK_SPEED = 6

export interface ForecastPoint {
  /** Lokale tijd, bv. "14:00" */
  time: string
  /** Volledige lokale tijd, bv. "2026-10-26T14:00" */
  iso: string
  /** Hetzelfde tijdstip in ms sinds 1970 (UTC), los van de tijdzone van de browser */
  unix: number
  speed10: number
  speed100: number
  directionDeg: number
  cloudCover: number
  precipitation: number
}

export interface WindData {
  /** Windsnelheid op 10 m hoogte (m/s) */
  speed10: number
  /** Windsnelheid op 100 m hoogte, ongeveer ashoogte (m/s) */
  speed100: number
  /** Rukwinden op 10 m (m/s) */
  gusts: number
  /** Waar de wind vandaan komt, graden vanaf noord */
  directionDeg: number
  temperature: number
  isDay: boolean
  /** Bewolking in procent */
  cloudCover: number
  /** Neerslag in mm (afgelopen kwartier) */
  precipitation: number
  /** Tijdstip van de meting in lokale tijd, bv. "14:15" */
  observedAt: string | null
  /** Verwachting voor de komende 24 uur */
  forecast: ForecastPoint[]
  /** Verschil tussen de lokale tijd van de stad en UTC (seconden) */
  utcOffsetSeconds: number
}

interface OpenMeteoResponse {
  utc_offset_seconds: number
  current: {
    time: string
    wind_speed_10m: number
    wind_direction_10m: number
    wind_gusts_10m: number
    temperature_2m: number
    is_day: number
    cloud_cover: number
    precipitation: number
  }
  hourly: {
    time: string[]
    wind_speed_10m: (number | null)[]
    wind_speed_100m: (number | null)[]
    wind_direction_10m: (number | null)[]
    cloud_cover: (number | null)[]
    precipitation: (number | null)[]
  }
}

const apiUrl = (p: Place) => `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
  latitude: String(p.latitude),
  longitude: String(p.longitude),
  current: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,is_day,cloud_cover,precipitation',
  hourly: 'wind_speed_10m,wind_speed_100m,wind_direction_10m,cloud_cover,precipitation',
  wind_speed_unit: 'ms',
  timezone: p.timezone,
  forecast_days: '2',
})}`

/** Lokale tijd van Open-Meteo ("2026-10-26T14:00") omzetten naar een echt tijdstip */
const toUnix = (iso: string, offsetSeconds: number) => Date.parse(`${iso}Z`) - offsetSeconds * 1000

/** Wind op 100 m lineair interpoleren tussen de twee uren rond het huidige tijdstip. */
function hubSpeedAt(time: string, hourly: OpenMeteoResponse['hourly']): number | null {
  const i = hourly.time.findLastIndex(t => t <= time)
  if (i === -1) return null
  const a = hourly.wind_speed_100m[i]
  const b = hourly.wind_speed_100m[i + 1] ?? a
  if (a == null || b == null) return a ?? null
  const minutes = Number(time.slice(14, 16)) || 0
  return a + (b - a) * (minutes / 60)
}

function forecastFrom(time: string, hourly: OpenMeteoResponse['hourly'], offset: number): ForecastPoint[] {
  const start = Math.max(0, hourly.time.findLastIndex(t => t <= time))
  const points: ForecastPoint[] = []
  for (let i = start; i < Math.min(start + 25, hourly.time.length); i++) {
    const speed10 = hourly.wind_speed_10m[i]
    if (speed10 == null) continue
    points.push({
      time: hourly.time[i].slice(11, 16),
      iso: hourly.time[i],
      unix: toUnix(hourly.time[i], offset),
      speed10,
      speed100: hourly.wind_speed_100m[i] ?? speed10 * 1.35,
      directionDeg: hourly.wind_direction_10m[i] ?? 225,
      cloudCover: hourly.cloud_cover[i] ?? 30,
      // Uurlijkse neerslag omzetten naar mm per kwartier, zoals de huidige meting
      precipitation: (hourly.precipitation[i] ?? 0) / 4,
    })
  }
  return points
}

async function fetchWind(p: Place): Promise<WindData> {
  const res = await fetch(apiUrl(p), { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Open-Meteo antwoordde met ${res.status}`)
  const json: OpenMeteoResponse = await res.json()
  const c = json.current
  return {
    speed10: c.wind_speed_10m,
    // Zonder 100 m-data schatten we de ashoogte-wind met een typische windprofielfactor
    speed100: hubSpeedAt(c.time, json.hourly) ?? c.wind_speed_10m * 1.35,
    gusts: c.wind_gusts_10m,
    directionDeg: c.wind_direction_10m,
    temperature: c.temperature_2m,
    isDay: c.is_day === 1,
    cloudCover: c.cloud_cover,
    precipitation: c.precipitation,
    observedAt: c.time.slice(11, 16),
    forecast: forecastFrom(c.time, json.hourly, json.utc_offset_seconds),
    utcOffsetSeconds: json.utc_offset_seconds,
  }
}

/** Handmatige instellingen om de scène te testen zonder op het weer te wachten. */
export interface Simulation {
  speed10: number
  directionDeg: number
  cloudCover: number
  precipitation: number
  /** Uur van de dag (0..24) voor de zonnestand */
  hour: number
}

// Debug: ?wind=10&dir=270&rain=2&clouds=80&hour=19 start meteen in simulatie
function readOverride(): Simulation | null {
  const params = new URLSearchParams(window.location.search)
  const keys = ['wind', 'dir', 'rain', 'clouds', 'hour']
  if (!keys.some(k => params.has(k))) return null
  const num = (key: string, fallback: number) => (params.has(key) ? Number(params.get(key)) : fallback)
  const now = new Date()
  return {
    speed10: num('wind', FALLBACK_SPEED),
    directionDeg: num('dir', 225),
    precipitation: num('rain', 0),
    cloudCover: num('clouds', 30),
    hour: num('hour', now.getHours() + now.getMinutes() / 60),
  }
}

// Eén gedeelde toestand voor de scène en de HUD
const live = shallowRef<WindData | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const simulation = ref<Simulation | null>(readOverride())
/** Afspelen van de verwachting: aantal uren na het eerste verwachtingsuur, of null voor live */
const playbackHours = ref<number | null>(null)
let users = 0
let timer: ReturnType<typeof setInterval> | undefined
const { place } = useLocation()

async function refresh() {
  const p = place.value
  loading.value = true
  try {
    const data = await fetchWind(p)
    // Intussen een andere stad gekozen: dit antwoord is niet meer nodig
    if (p !== place.value) return
    live.value = data
    error.value = null
  }
  catch (e) {
    if (p === place.value) error.value = e instanceof Error ? e.message : 'Onbekende fout'
  }
  finally {
    if (p === place.value) loading.value = false
  }
}

// Andere stad: oude data weg en meteen het weer van de nieuwe stad ophalen
watch(place, () => {
  live.value = null
  error.value = null
  playbackHours.value = null
  if (users) refresh()
})

/** Verwachting op een willekeurig moment (uren na het eerste uur), lineair geïnterpoleerd. */
export function forecastAt(forecast: ForecastPoint[], hours: number): ForecastPoint | null {
  if (!forecast.length) return null
  const i = Math.min(Math.max(Math.floor(hours), 0), forecast.length - 1)
  const a = forecast[i]
  const b = forecast[Math.min(i + 1, forecast.length - 1)]
  const t = Math.min(Math.max(hours - i, 0), 1)
  const lerp = (x: number, y: number) => x + (y - x) * t
  // Richting via de kortste weg interpoleren (bv. 350° → 10°)
  const turn = ((b.directionDeg - a.directionDeg + 540) % 360) - 180
  return {
    ...a,
    speed10: lerp(a.speed10, b.speed10),
    speed100: lerp(a.speed100, b.speed100),
    directionDeg: (a.directionDeg + turn * t + 360) % 360,
    cloudCover: lerp(a.cloudCover, b.cloudCover),
    precipitation: lerp(a.precipitation, b.precipitation),
  }
}

/** Tijdstip dat bij een afspeelpositie hoort */
export function playbackDate(forecast: ForecastPoint[], hours: number): Date | null {
  if (!forecast.length) return null
  return new Date(forecast[0].unix + hours * 3600_000)
}

const wind = computed<WindData>(() => {
  const base: WindData = {
    speed10: FALLBACK_SPEED,
    speed100: FALLBACK_SPEED * 1.35,
    gusts: FALLBACK_SPEED * 1.5,
    directionDeg: 225,
    temperature: 12,
    isDay: true,
    cloudCover: 30,
    precipitation: 0,
    observedAt: null,
    forecast: [],
    utcOffsetSeconds: 0,
    ...live.value,
  }
  const sim = simulation.value
  if (!sim) {
    const at = playbackHours.value === null ? null : forecastAt(base.forecast, playbackHours.value)
    if (!at) return base
    const date = playbackDate(base.forecast, playbackHours.value!)!
    return {
      ...base,
      speed10: at.speed10,
      speed100: at.speed100,
      gusts: at.speed10 * 1.4,
      directionDeg: at.directionDeg,
      cloudCover: at.cloudCover,
      precipitation: at.precipitation,
      observedAt: date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', timeZone: place.value.timezone }),
    }
  }
  return {
    ...base,
    speed10: sim.speed10,
    speed100: sim.speed10 * 1.35,
    gusts: sim.speed10 * 1.45,
    directionDeg: sim.directionDeg,
    cloudCover: sim.cloudCover,
    precipitation: sim.precipitation,
  }
})

export type WindStatus = 'loading' | 'live' | 'stale' | 'offline' | 'sim' | 'replay'

const status = computed<WindStatus>(() => {
  if (simulation.value) return 'sim'
  if (playbackHours.value !== null && live.value) return 'replay'
  if (error.value) return live.value ? 'stale' : 'offline'
  if (!live.value) return 'loading'
  return 'live'
})

/** Simulatie starten vanaf de huidige (live) waarden. */
function startSimulation() {
  const w = wind.value
  playbackHours.value = null
  // Uur van de dag in de gekozen stad, niet in de tijdzone van de browser
  const local = (Date.now() + w.utcOffsetSeconds * 1000) % 86400_000
  simulation.value = {
    speed10: Math.round(w.speed10 * 10) / 10,
    directionDeg: Math.round(w.directionDeg),
    cloudCover: Math.round(w.cloudCover),
    precipitation: w.precipitation,
    hour: Math.round((local / 3600_000) * 4) / 4,
  }
}

export const PRESETS = [
  { label: 'Windstil', values: { speed10: 1.5, precipitation: 0, cloudCover: 10 } },
  { label: 'Fris', values: { speed10: 7, precipitation: 0, cloudCover: 35 } },
  { label: 'Storm', values: { speed10: 21, precipitation: 1.6, cloudCover: 100 } },
] as const

/** Instellingen van de simulatie aanpassen; start de simulatie als die nog niet loopt. */
function updateSimulation(values: Partial<Simulation>) {
  if (!simulation.value) startSimulation()
  simulation.value = { ...simulation.value!, ...values }
}

function applyPreset(values: (typeof PRESETS)[number]['values']) {
  updateSimulation(values)
}

function stopSimulation() {
  simulation.value = null
  if (window.location.search) history.replaceState(null, '', window.location.pathname)
}

export function useWindData() {
  if (users++ === 0) {
    refresh()
    timer = setInterval(refresh, REFRESH_MS)
  }
  onScopeDispose(() => {
    if (--users === 0) clearInterval(timer)
  })
  return { wind, status, error, loading, refresh, simulation, startSimulation, stopSimulation, updateSimulation, applyPreset, playbackHours }
}
