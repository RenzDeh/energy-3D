import { computed, ref, shallowRef, watch } from 'vue'
import { useEnergy } from './useEnergy'
import { useLocation } from './useLocation'
import type { Place } from './useLocation'
import { useWindData } from './useWindData'

/** Uitstoot van een moderne STEG-gascentrale: de centrale die windstroom in de praktijk vervangt (kg CO₂/MWh) */
export const GAS_PLANT_KG_PER_MWH = 370
/** Verbruik van één laadbeurt van een elektrische auto (kWh), voor de laadtip */
export const CAR_CHARGE_KWH = 40
/** Gemiddeld verbruik van een elektrische auto, inclusief laadverliezen: ±18 kWh per 100 km */
export const CAR_KWH_PER_KM = 0.18
const REFRESH_MS = 30 * 60 * 1000

// Day-ahead prijs per biedzone (EPEX Spot / Nord Pool) via Energy-Charts, CC BY 4.0
const PRICE_API = '/api/energy-charts/price'
/** Biedzone van Energy-Charts per landcode; landen die er niet in staan krijgen een geschatte prijs */
const BIDDING_ZONES: Record<string, string> = {
  BE: 'BE',
  NL: 'NL',
  FR: 'FR',
  DE: 'DE-LU',
  LU: 'DE-LU',
  AT: 'AT',
  CH: 'CH',
  PL: 'PL',
  CZ: 'CZ',
  HU: 'HU',
  SI: 'SI',
  DK: 'DK1',
  IT: 'IT-North',
  NO: 'NO2',
  SE: 'SE4',
}
/**
 * Wat een gezin bovenop de beursprijs betaalt, per landcode: netkosten, heffingen, marge van de leverancier
 * (`extra`, €/kWh) en btw (`vat`). Ruwe gemiddelden voor een dynamisch contract; de vaste maandkosten tellen niet mee.
 */
const TARIFFS: Record<string, { extra: number, vat: number }> = {
  BE: { extra: 0.13, vat: 0.06 },
  NL: { extra: 0.14, vat: 0.21 },
  FR: { extra: 0.10, vat: 0.20 },
  DE: { extra: 0.20, vat: 0.19 },
  LU: { extra: 0.10, vat: 0.08 },
  AT: { extra: 0.12, vat: 0.20 },
  DK: { extra: 0.15, vat: 0.25 },
}
const DEFAULT_TARIFF = { extra: 0.13, vat: 0.21 }
// CO₂-intensiteit van het Belgische stroomverbruik volgens Elia Open Data (ods192)
const CO2_API = 'https://opendata.elia.be/api/explore/v2.1/catalog/datasets/ods192/records?limit=24&order_by=-datetime'
/** Gemiddelde CO₂-intensiteit van de stroommix per land (g/kWh, afgerond) als er geen live data is */
const CO2_BY_COUNTRY: Record<string, number> = {
  BE: 130,
  NL: 270,
  FR: 35,
  DE: 350,
  LU: 350,
  AT: 90,
  CH: 30,
  PL: 650,
  CZ: 420,
  DK: 110,
  NO: 25,
  SE: 30,
  ES: 120,
  PT: 120,
  IT: 280,
  GB: 210,
  IE: 280,
  HU: 190,
  SI: 220,
}
const FALLBACK_CO2 = 300

const formats = new Map<string, Intl.DateTimeFormat>()
/** Sleutel per uur in de tijdzone van de stad, bv. "2026-10-26T16" (zelfde vorm als het begin van de Open-Meteo-tijden) */
function hourKey(d: Date, timeZone: string) {
  let format = formats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    formats.set(timeZone, format)
  }
  return format.format(d).replace(' ', 'T')
}
const dayString = (d: Date, timeZone: string) => hourKey(d, timeZone).slice(0, 10)

export type MarketSource = 'loading' | 'live' | 'estimate'

const prices = shallowRef(new Map<string, number>())
const priceSource = ref<MarketSource>('loading')
/** Biedzone waarvan de prijzen komen, of null als het land niet gedekt is */
const priceZone = ref<string | null>(null)
const co2Mix = ref(FALLBACK_CO2)
const co2Source = ref<MarketSource>('loading')
let started = false
const { place } = useLocation()

async function loadPrices(p: Place) {
  const zone = BIDDING_ZONES[p.countryCode] ?? null
  if (zone !== priceZone.value) { prices.value = new Map() }
  priceZone.value = zone
  if (!zone) {
    priceSource.value = 'estimate'
    return
  }
  const today = new Date()
  const end = new Date(today.getTime() + 2 * 86400_000)
  try {
    const res = await fetch(`${PRICE_API}?bzn=${zone}&start=${dayString(today, p.timezone)}&end=${dayString(end, p.timezone)}`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) { throw new Error(String(res.status)) }
    const json: { unix_seconds: number[], price: (number | null)[] } = await res.json()
    // Kwartierprijzen uitmiddelen per uur
    const sums = new Map<string, { sum: number, n: number }>()
    json.unix_seconds.forEach((s, i) => {
      const price = json.price[i]
      if (price == null) { return }
      const key = hourKey(new Date(s * 1000), p.timezone)
      const entry = sums.get(key) ?? { sum: 0, n: 0 }
      entry.sum += price
      entry.n++
      sums.set(key, entry)
    })
    // Intussen een andere stad gekozen: dit antwoord is niet meer nodig
    if (p !== place.value) { return }
    prices.value = new Map([...sums].map(([k, { sum, n }]) => [k, sum / n]))
    priceSource.value = prices.value.size ? 'live' : 'estimate'
  }
  catch {
    if (p === place.value) { priceSource.value = 'estimate' }
  }
}

async function loadCo2(p: Place) {
  // Live CO₂-cijfers hebben we enkel voor België (Elia); elders een jaargemiddelde
  if (p.countryCode !== 'BE') {
    co2Mix.value = CO2_BY_COUNTRY[p.countryCode] ?? FALLBACK_CO2
    co2Source.value = 'estimate'
    return
  }
  try {
    const res = await fetch(CO2_API, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) { throw new Error(String(res.status)) }
    const json: { results: { consumption: number | null }[] } = await res.json()
    const values = json.results.map(r => r.consumption).filter((v): v is number => v != null)
    if (!values.length) { throw new Error('leeg') }
    if (p !== place.value) { return }
    co2Mix.value = values.reduce((a, b) => a + b, 0) / values.length
    co2Source.value = 'live'
  }
  catch {
    if (p !== place.value) { return }
    co2Mix.value = CO2_BY_COUNTRY.BE
    co2Source.value = 'estimate'
  }
}

function loadAll() {
  priceSource.value = 'loading'
  co2Source.value = 'loading'
  loadPrices(place.value)
  loadCo2(place.value)
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

/** Beste startmoment voor een toestel dat een aantal uur draait */
export interface Plan extends Window {
  /** Aantal uur vanaf nu tot de start */
  wait: number
  /** Dag van de start: 0 = vandaag, 1 = morgen, 2 = overmorgen */
  day: number
  /** Valt (een deel van) het blok na de bekende beursprijzen, zodat we de prijs schatten? */
  estimated: boolean
  /** Kost (€, wat je echt betaalt) op het beste moment, als je nu start, en op het duurste moment */
  cost: number
  costNow: number
  costWorst: number
  /** Gemiddelde kost over alle mogelijke startmomenten: wat het "gewoon ergens" starten kost */
  costAverage: number
  /** Prijs per uur over het hele bereik, met het gekozen blok gemarkeerd (voor de tijdlijn) */
  timeline: { time: string, price: number, kw: number, chosen: boolean }[]
}

/** Thuisbatterij: opladen op het goedkoopste moment, de stroom gebruiken op het duurste moment daarna */
export interface BatteryPlan {
  charge: { start: string, end: string, day: number, wait: number }
  use: { start: string, end: string, day: number }
  /** Wat het opladen kost en wat je uitspaart door later uit de batterij te verbruiken (€) */
  chargeCost: number
  avoidedCost: number
  /** Netto winst van één cyclus (€); kan negatief zijn als het prijsverschil te klein is */
  gain: number
  estimated: boolean
  timeline: { price: number, charge: boolean, use: boolean }[]
}
/** Rendement van opslaan en terug afgeven: ±10% gaat verloren */
const BATTERY_EFFICIENCY = 0.9

export function useMarket() {
  const { wind, simulation } = useWindData()
  const energy = useEnergy()

  if (!started) {
    started = true
    loadAll()
    setInterval(loadAll, REFRESH_MS)
    watch(place, loadAll)
  }

  const hours = computed<MarketHour[]>(() => {
    const forecast = wind.value.forecast
    return energy.curve.value.map((p, i) => {
      const price = prices.value.get(p.iso.slice(0, 13)) ?? estimatePrice(p.iso, forecast[i]?.speed100 ?? 0)
      return { ...p, price, revenue: (p.kw / 1000) * price }
    })
  })

  /**
   * 48 uur vooruit voor de planner (een auto aan het stopcontact laadt soms langer dan een dag).
   * De beursprijzen zijn gekend tot het einde van morgen; daarna schatten we ze.
   */
  const planHours = computed(() => {
    const outlook = wind.value.outlook
    return energy.outlookCurve.value.map((p, i) => {
      const known = prices.value.get(p.iso.slice(0, 13))
      return { ...p, price: known ?? estimatePrice(p.iso, outlook[i]?.speed100 ?? 0), estimated: known === undefined }
    })
  })

  const tariff = computed(() => TARIFFS[place.value.countryCode] ?? DEFAULT_TARIFF)
  /** Beursprijs (€/MWh) omzetten naar wat een gezin echt betaalt (€/kWh, alles inbegrepen) */
  const retail = (eurPerMwh: number) => (eurPerMwh / 1000 + tariff.value.extra) * (1 + tariff.value.vat)

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

  const isTomorrow = (h: MarketHour) => h.iso.slice(0, 10) !== dayString(new Date(), place.value.timezone)
  /** Aantal dagen na vandaag (in de tijdzone van de stad) */
  const dayOffset = (iso: string) => Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(dayString(new Date(), place.value.timezone))) / 86400_000)
  const endOf = (h: { time: string }, slots: number) => `${String((Number(h.time.slice(0, 2)) + slots) % 24).padStart(2, '0')}:00`

  /** Blok van `size` uur met de laagste (of hoogste) gemiddelde score */
  function bestWindow(score: (h: MarketHour) => number, size = 3, highest = false): Window | null {
    const h = hours.value.slice(0, 24)
    if (h.length < size) { return null }
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
    return {
      start: block[0].time,
      end: endOf(block.at(-1)!, 1),
      price: block.reduce((a, x) => a + x.price, 0) / size,
      kw: block.reduce((a, x) => a + x.kw, 0) / size,
      tomorrow: isTomorrow(block[0]),
    }
  }

  /**
   * Goedkoopste aaneengesloten blok voor een toestel dat `duration` uur draait en `kwh` verbruikt,
   * klaar vóór `deadline` uur vanaf nu. Zonder deadline mag het toestel ergens in de komende 24 uur starten,
   * ook als het daarna nog lang draait. Een gedeeltelijk laatste uur telt naar verhouding mee.
   */
  function plan(kwh: number, duration: number, deadline?: number): Plan | null {
    const h = planHours.value
    const slots = Math.ceil(duration)
    const last = Math.min(h.length, Math.floor(deadline ?? slots + 24))
    if (last < slots) { return null }
    const weights = Array.from({ length: slots }, (_, k) => Math.min(1, duration - k) / duration)
    const costAt = (i: number) => weights.reduce((a, w, k) => a + w * kwh * retail(h[i + k].price), 0)
    const costs = Array.from({ length: last - slots + 1 }, (_, i) => costAt(i))
    const best = costs.indexOf(Math.min(...costs))
    const block = h.slice(best, best + slots)
    return {
      start: block[0].time,
      end: endOf(block[0], slots),
      price: block.reduce((a, x) => a + x.price, 0) / slots,
      kw: block.reduce((a, x) => a + x.kw, 0) / slots,
      tomorrow: dayOffset(block[0].iso) > 0,
      wait: best,
      day: dayOffset(block[0].iso),
      estimated: block.some(x => x.estimated),
      cost: costs[best],
      costNow: costs[0],
      costWorst: Math.max(...costs),
      costAverage: costs.reduce((a, c) => a + c, 0) / costs.length,
      timeline: h.slice(0, last).map((x, i) => ({ time: x.time, price: x.price, kw: x.kw, chosen: i >= best && i < best + slots })),
    }
  }

  /**
   * Thuisbatterij van `kwh` die aan `powerKw` laadt en ontlaadt: kies het goedkoopste laadblok in de komende 24 uur
   * en het duurste blok binnen 24 uur daarna om de opgeslagen stroom te gebruiken (in plaats van van het net).
   */
  function planBattery(kwh: number, powerKw: number): BatteryPlan | null {
    const h = planHours.value
    const duration = kwh / powerKw
    const slots = Math.ceil(duration)
    if (h.length < slots * 2) { return null }
    const weights = Array.from({ length: slots }, (_, k) => Math.min(1, duration - k) / duration)
    /** Gemiddelde prijs per kWh (wat je echt betaalt) over een blok dat op uur `i` start */
    const blockPrice = (i: number) => weights.reduce((a, w, k) => a + w * retail(h[i + k].price), 0)
    let best: { i: number, j: number, gain: number } | null = null
    for (let i = 0; i < 24 && i + slots * 2 <= h.length; i++) {
      const chargeCost = kwh * blockPrice(i)
      for (let j = i + slots; j <= Math.min(h.length - slots, i + slots + 24); j++) {
        const gain = kwh * BATTERY_EFFICIENCY * blockPrice(j) - chargeCost
        if (!best || gain > best.gain) { best = { i, j, gain } }
      }
    }
    if (!best) { return null }
    const { i, j } = best
    const end = Math.min(h.length, Math.max(24, j + slots + 1))
    return {
      charge: { start: h[i].time, end: endOf(h[i], slots), day: dayOffset(h[i].iso), wait: i },
      use: { start: h[j].time, end: endOf(h[j], slots), day: dayOffset(h[j].iso) },
      chargeCost: kwh * blockPrice(i),
      avoidedCost: kwh * BATTERY_EFFICIENCY * blockPrice(j),
      gain: best.gain,
      estimated: h.slice(i, j + slots).some(x => x.estimated),
      timeline: h.slice(0, end).map((x, k) => ({ price: x.price, charge: k >= i && k < i + slots, use: k >= j && k < j + slots })),
    }
  }

  const cheapest = computed(() => bestWindow(h => h.price))
  const priciest = computed(() => bestWindow(h => h.price, 3, true))
  const greenest = computed(() => bestWindow(h => h.kw, 3, true))

  /** Prijsniveau nu ten opzichte van de komende 24 uur (0 = goedkoopst, 1 = duurst) */
  const priceLevel = computed(() => {
    const p = hours.value.slice(0, 24).map(h => h.price)
    if (!p.length) { return 0.5 }
    const min = Math.min(...p)
    const max = Math.max(...p)
    return max > min ? (priceNow.value - min) / (max - min) : 0.5
  })

  /** Wat een kWh nu echt kost (€/kWh, met netkosten, heffingen en btw) */
  const retailNow = computed(() => retail(priceNow.value))

  /** Kostprijs van een laadbeurt, met netkosten, heffingen en btw */
  const carTip = computed(() => {
    if (!cheapest.value || !priciest.value) { return null }
    return {
      cheap: CAR_CHARGE_KWH * retail(cheapest.value.price),
      expensive: CAR_CHARGE_KWH * retail(priciest.value.price),
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
    plan,
    planBattery,
    planHours,
    dayOffset,
    retail,
    retailNow,
    priceZone,
    priceSource,
    co2Source,
  }
}
