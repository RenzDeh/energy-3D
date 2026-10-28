import { computed, ref, watch } from 'vue'

export interface Place {
  name: string
  /** Provincie of regio, bv. "Oost-Vlaanderen" */
  region?: string
  country: string
  /** ISO-landcode, bv. "BE" */
  countryCode: string
  latitude: number
  longitude: number
  /** IANA-tijdzone, bv. "Europe/Brussels" */
  timezone: string
  population?: number
}

const DEFAULT_PLACE: Place = {
  name: 'Kortrijk',
  region: 'West-Vlaanderen',
  country: 'België',
  countryCode: 'BE',
  latitude: 50.82,
  longitude: 3.27,
  timezone: 'Europe/Brussels',
  population: 77000,
}
/** Gemiddeld aantal personen per huishouden */
const PEOPLE_PER_HOUSEHOLD = 2.3
const FALLBACK_HOUSEHOLDS = 20000
const STORAGE_KEY = 'energy-3d:place'

// Steden opzoeken via de geocoding van Open-Meteo (zelfde bron als het weer, geen sleutel nodig)
const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search'

interface GeocodingResult {
  name: string
  latitude: number
  longitude: number
  country?: string
  country_code?: string
  admin1?: string
  admin2?: string
  timezone?: string
  population?: number
}

function load(): Place {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...DEFAULT_PLACE, ...JSON.parse(saved) }
  }
  catch {}
  return DEFAULT_PLACE
}

// Eén gedeelde locatie voor het weer, de zon, de stroomprijs en de HUD
const place = ref<Place>(load())
watch(place, (p) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  }
  catch {}
})

/** Steden zoeken op naam (minstens 2 letters). */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const name = query.trim()
  if (name.length < 2) return []
  const params = new URLSearchParams({ name, count: '6', language: 'nl', format: 'json' })
  const res = await fetch(`${GEOCODING_API}?${params}`, { signal })
  if (!res.ok) throw new Error(`Zoeken mislukt (${res.status})`)
  const json: { results?: GeocodingResult[] } = await res.json()
  return (json.results ?? []).map(r => ({
    name: r.name,
    region: r.admin2 ?? r.admin1,
    country: r.country ?? '',
    countryCode: r.country_code ?? '',
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? 'UTC',
    population: r.population,
  }))
}

export function useLocation() {
  /** Geschat aantal huishoudens in de gekozen stad */
  const households = computed(() => {
    const pop = place.value.population
    return pop ? Math.max(100, Math.round(pop / PEOPLE_PER_HOUSEHOLD)) : FALLBACK_HOUSEHOLDS
  })
  function setPlace(p: Place) {
    place.value = p
  }
  return { place, households, setPlace }
}
