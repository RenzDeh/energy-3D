import { computed, ref, shallowRef } from 'vue'
import { useEnergy } from './useEnergy'
import { useWindData } from './useWindData'

/** Uitstoot van een moderne STEG-gascentrale: de centrale die windstroom in de praktijk vervangt (kg CO₂/MWh) */
export const GAS_PLANT_KG_PER_MWH = 370
/** Verbruik van één laadbeurt van een elektrische auto (kWh), voor de laadtip */
export const CAR_CHARGE_KWH = 40
const FALLBACK_CO2 = 130 // g/kWh, typisch voor de Belgische mix
const REFRESH_MS = 30 * 60 * 1000

// Day-ahead prijs voor de Belgische biedzone (EPEX Spot) via Energy-Charts, CC BY 4.0
const PRICE_API = '/api/energy-charts/price'
// CO₂-intensiteit van het Belgische stroomverbruik volgens Elia Open Data (ods192)
const CO2_API = 'https://opendata.elia.be/api/explore/v2.1/catalog/datasets/ods192/records?limit=24&order_by=-datetime'

const hourFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Brussels',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})
/** Sleutel per uur in Belgische tijd, bv. "2026-10-26T16" (zelfde vorm als het begin van de Open-Meteo-tijden) */
const hourKey = (d: Date) => hourFormat.format(d).replace(' ', 'T')
const dayString = (d: Date) => hourKey(d).slice(0, 10)

export type MarketSource = 'loading' | 'live' | 'estimate'

const prices = shallowRef(new Map<string, number>())
const priceSource = ref<MarketSource>('loading')
const co2Mix = ref(FALLBACK_CO2)
const co2Source = ref<MarketSource>('loading')
let started = false

async function loadPrices() {
  const today = new Date()
  const end = new Date(today.getTime() + 2 * 86400_000)
  try {
    const res = await fetch(`${PRICE_API}?bzn=BE&start=${dayString(today)}&end=${dayString(end)}`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(String(res.status))
    const json: { unix_seconds: number[], price: (number | null)[] } = await res.json()
    // Kwartierprijzen uitmiddelen per uur
    const sums = new Map<string, { sum: number, n: number }>()
    json.unix_seconds.forEach((s, i) => {
      const p = json.price[i]
      if (p == null) return
      const key = hourKey(new Date(s * 1000))
      const entry = sums.get(key) ?? { sum: 0, n: 0 }
      entry.sum += p
      entry.n++
      sums.set(key, entry)
    })
    prices.value = new Map([...sums].map(([k, { sum, n }]) => [k, sum / n]))
    priceSource.value = prices.value.size ? 'live' : 'estimate'
  }
  catch {
    priceSource.value = 'estimate'
  }
}

async function loadCo2() {
  try {
    const res = await fetch(CO2_API, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(String(res.status))
    const json: { results: { consumption: number | null }[] } = await res.json()
    const values = json.results.map(r => r.consumption).filter((v): v is number => v != null)
    if (!values.length) throw new Error('leeg')
    co2Mix.value = values.reduce((a, b) => a + b, 0) / values.length
    co2Source.value = 'live'
  }
  catch {
    co2Source.value = 'estimate'
  }
}

/**
 * Schatting als er geen marktprijs is: duur tijdens de ochtend- en avondpiek,
 * goedkoop 's nachts, en lager naarmate het harder waait (veel windstroom drukt de prijs).
 */
function estimatePrice(iso: string, speed100: number): number {
  const hour = Number(iso.slice(11, 13))
  const evening = Math.exp(-(((hour - 19) / 2) ** 2)) * 55
  const morning = Math.exp(-(((hour - 8) / 1.5) ** 2)) * 30
  const night = hour < 6 ? -20 : 0
  return Math.round(80 + evening + morning + night - Math.min(speed100, 14) * 4)
}

export interface MarketHour {
  time: string
  iso: string
  kw: number
  /** €/MWh */
  price: number
  /** € opbrengst in dat uur */
  revenue: number
}

export interface Window { start: string, end: string, price: number, kw: number, /** Valt het blok morgen? */ tomorrow: boolean }

export function useMarket() {
  const { wind, simulation } = useWindData()
  const energy = useEnergy()

  if (!started) {
    started = true
    loadPrices()
    loadCo2()
    setInterval(() => {
      loadPrices()
      loadCo2()
    }, REFRESH_MS)
  }

  const hours = computed<MarketHour[]>(() => {
    const forecast = wind.value.forecast
    return energy.curve.value.map((p, i) => {
      const price = prices.value.get(p.iso.slice(0, 13)) ?? estimatePrice(p.iso, forecast[i]?.speed100 ?? 0)
      return { ...p, price, revenue: (p.kw / 1000) * price }
    })
  })

  /** Waarde op de huidige (afspeel)positie */
  const index = computed(() => Math.min(Math.floor(energy.position.value), Math.max(0, hours.value.length - 1)))
  const priceNow = computed(() => hours.value[index.value]?.price ?? 0)
  /** Opbrengst per uur aan het huidige vermogen (€/u) */
  const revenueRate = computed(() => (energy.kw.value / 1000) * priceNow.value)

  /** Opbrengst (€) tussen het begin van de verwachting en `t` uur later */
  function revenueUntil(t: number): number {
    const h = hours.value
    let total = 0
    for (let i = 0; i < h.length - 1 && i < t; i++) {
      const span = Math.min(1, t - i)
      total += (((h[i].kw + h[i + 1].kw) / 2) / 1000) * h[i].price * span
    }
    return total
  }
  const revenue = computed(() => revenueUntil(energy.position.value))
  const revenueDay = computed(() => revenueUntil(energy.hours.value))
  // In simulatie draait het park aan constant vermogen tegen de prijzen van de komende 24 uur
  const simRevenueDay = computed(() => hours.value.slice(0, 24).reduce((a, h) => a + (energy.kw.value / 1000) * h.price, 0))

  // CO₂: g/kWh is hetzelfde als kg/MWh
  const co2 = computed(() => {
    const mwh = (energy.playbackHours.value === null ? energy.dayKwh.value : energy.energyKwh.value) / 1000
    return { mix: (mwh * co2Mix.value) / 1000, gas: (mwh * GAS_PLANT_KG_PER_MWH) / 1000 }
  })
  /** CO₂ vermeden over de hele komende 24 uur (ton, tegenover een gascentrale) */
  const co2DayGas = computed(() => {
    const kwh = simulation.value ? energy.simDayKwh.value : energy.dayKwh.value
    return ((kwh / 1000) * GAS_PLANT_KG_PER_MWH) / 1000
  })

  /** Blok van `size` uur met de laagste (of hoogste) gemiddelde score */
  function bestWindow(score: (h: MarketHour) => number, size = 3, highest = false): Window | null {
    const h = hours.value.slice(0, 24)
    if (h.length < size) return null
    let best = -1
    let bestScore = highest ? -Infinity : Infinity
    for (let i = 0; i + size <= h.length; i++) {
      const s = h.slice(i, i + size).reduce((a, x) => a + score(x), 0) / size
      if (highest ? s > bestScore : s < bestScore) {
        bestScore = s
        best = i
      }
    }
    const block = h.slice(best, best + size)
    const endHour = (Number(block.at(-1)!.time.slice(0, 2)) + 1) % 24
    return {
      start: block[0].time,
      end: `${String(endHour).padStart(2, '0')}:00`,
      price: block.reduce((a, x) => a + x.price, 0) / size,
      kw: block.reduce((a, x) => a + x.kw, 0) / size,
      tomorrow: block[0].iso.slice(0, 10) !== dayString(new Date()),
    }
  }

  const cheapest = computed(() => bestWindow(h => h.price))
  const priciest = computed(() => bestWindow(h => h.price, 3, true))
  const greenest = computed(() => bestWindow(h => h.kw, 3, true))

  /** Prijsniveau nu ten opzichte van de komende 24 uur (0 = goedkoopst, 1 = duurst) */
  const priceLevel = computed(() => {
    const p = hours.value.slice(0, 24).map(h => h.price)
    if (!p.length) return 0.5
    const min = Math.min(...p)
    const max = Math.max(...p)
    return max > min ? (priceNow.value - min) / (max - min) : 0.5
  })

  /** Kostprijs van een laadbeurt (enkel de energieprijs, zonder nettarieven en heffingen) */
  const carTip = computed(() => {
    if (!cheapest.value || !priciest.value) return null
    return {
      cheap: (CAR_CHARGE_KWH * cheapest.value.price) / 1000,
      expensive: (CAR_CHARGE_KWH * priciest.value.price) / 1000,
    }
  })

  const negativeHours = computed(() => hours.value.slice(0, 24).filter(h => h.price < 0).length)

  return {
    hours,
    priceNow,
    priceLevel,
    revenueRate,
    revenue,
    revenueDay,
    simRevenueDay,
    co2,
    co2DayGas,
    co2Mix,
    cheapest,
    priciest,
    greenest,
    carTip,
    negativeHours,
    priceSource,
    co2Source,
  }
}
