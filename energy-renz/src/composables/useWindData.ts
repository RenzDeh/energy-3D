import { computed, onScopeDispose, ref, shallowRef } from 'vue'

export const LOCATION = { name: 'Kortrijk', latitude: 50.82, longitude: 3.27 }

const REFRESH_MS = 10 * 60 * 1000
const TIMEOUT_MS = 10 * 1000
const FALLBACK_SPEED = 6

export interface ForecastPoint {
  /** Lokale tijd, bv. "14:00" */
  time: string
  speed10: number
  speed100: number
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
}

interface OpenMeteoResponse {
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
  }
}

const API_URL = `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
  latitude: String(LOCATION.latitude),
  longitude: String(LOCATION.longitude),
  current: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,is_day,cloud_cover,precipitation',
  hourly: 'wind_speed_10m,wind_speed_100m',
  wind_speed_unit: 'ms',
  timezone: 'Europe/Brussels',
  forecast_days: '2',
})}`

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

function forecastFrom(time: string, hourly: OpenMeteoResponse['hourly']): ForecastPoint[] {
  const start = Math.max(0, hourly.time.findLastIndex(t => t <= time))
  const points: ForecastPoint[] = []
  for (let i = start; i < Math.min(start + 25, hourly.time.length); i++) {
    const speed10 = hourly.wind_speed_10m[i]
    if (speed10 == null) continue
    points.push({
      time: hourly.time[i].slice(11, 16),
      speed10,
      speed100: hourly.wind_speed_100m[i] ?? speed10 * 1.35,
    })
  }
  return points
}

async function fetchWind(): Promise<WindData> {
  const res = await fetch(API_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) })
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
    forecast: forecastFrom(c.time, json.hourly),
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
let users = 0
let timer: ReturnType<typeof setInterval> | undefined

async function refresh() {
  loading.value = true
  try {
    live.value = await fetchWind()
    error.value = null
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Onbekende fout'
  }
  finally {
    loading.value = false
  }
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
    ...live.value,
  }
  const sim = simulation.value
  if (!sim) return base
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

export type WindStatus = 'loading' | 'live' | 'stale' | 'offline' | 'sim'

const status = computed<WindStatus>(() => {
  if (simulation.value) return 'sim'
  if (error.value) return live.value ? 'stale' : 'offline'
  if (!live.value) return 'loading'
  return 'live'
})

/** Simulatie starten vanaf de huidige (live) waarden. */
function startSimulation() {
  const w = wind.value
  const now = new Date()
  simulation.value = {
    speed10: Math.round(w.speed10 * 10) / 10,
    directionDeg: Math.round(w.directionDeg),
    cloudCover: Math.round(w.cloudCover),
    precipitation: w.precipitation,
    hour: Math.round((now.getHours() + now.getMinutes() / 60) * 4) / 4,
  }
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
  return { wind, status, error, loading, refresh, simulation, startSimulation, stopSimulation }
}
