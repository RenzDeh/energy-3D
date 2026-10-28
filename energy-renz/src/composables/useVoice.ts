import { ref, shallowRef } from 'vue'
import { MAX_TURBINES, useEnergy } from './useEnergy'
import { searchPlaces, useLocation } from './useLocation'
import { CAR_CHARGE_KWH, useMarket } from './useMarket'
import { PRESETS, useWindData } from './useWindData'

// Minimale typen voor de Web Speech API (zit nog niet in de standaard DOM-typen)
interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean, length: number, [index: number]: RecognitionAlternative }
interface RecognitionEvent { resultIndex: number, results: { length: number, [index: number]: RecognitionResult } }
interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

const Ctor: RecognitionCtor | undefined
  = (window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition

export const voiceSupported = !!Ctor

/** Voorbeeldzinnen; dienen ook als knoppen wanneer spraak niet werkt */
export const EXAMPLES = [
  'Hoeveel energie produceren we?',
  'Wat kost stroom nu?',
  'Wanneer is stroom goedkoop?',
  'Ga naar Gent',
  'Meer wind',
  'Zet de zon op 15 uur',
  'Speel de dag af',
  'Storm',
  'Zet 3 molens',
  'Terug naar live',
]

const NUMBER_WORDS: Record<string, number> = {
  nul: 0, een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
  elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15, zestien: 16, zeventien: 17, achttien: 18,
  negentien: 19, twintig: 20, eenentwintig: 21, tweeëntwintig: 22, drieëntwintig: 23, vierentwintig: 24,
  vijfentwintig: 25, dertig: 30,
}

/** Getallen in woorden ("vijftien") omzetten naar cijfers, zodat de patronen eenvoudig blijven. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?!.,]/g, ' ')
    .split(/\s+/)
    .map(w => (w in NUMBER_WORDS ? String(NUMBER_WORDS[w]) : w))
    .join(' ')
    .trim()
}

/** Woorden die na "naar" geen stad zijn ("terug naar live", "wind naar 10") */
const NOT_A_CITY = /^(live|nu|het begin|de echte data|\d+.*)$/

/** Stadsnaam uit een zin halen, of null als de zin niet over een andere stad gaat. */
function cityQuery(t: string): string | null {
  const patterns = [
    // "ga naar Gent", "wissel naar Brugge", "verander de stad naar Leuven", "naar Antwerpen"
    /^(?:ga|ga eens|wissel|verander|spring|zet|breng me|neem me mee)?(?: de stad| de locatie)? ?naar (.+)$/,
    // "stad Gent", "kies de stad Brugge", "zet de stad op Leuven", "andere stad Mechelen"
    /(?:^|\s)(?:stad|gemeente|locatie) (?:op |naar |in )?(.+)$/,
    // "toon Gent", "zoek Brugge", "open Leuven"
    /^(?:toon|zoek|kies|open|bekijk) (?:de stad |het weer in |het weer van )?(.+)$/,
    // "hoe is het weer in Gent", "hoe waait het in Oostende", "wat is het weer in Brugge"
    /^(?:hoe is het weer|wat is het weer|hoe waait het|hoe hard waait het|hoe is het) (?:in|te|aan) (.+)$/,
  ]
  for (const pattern of patterns) {
    const m = t.match(pattern)
    if (!m) continue
    const name = m[1].replace(/\s+(alsjeblieft|alstublieft|aub|eens|zien)$/, '').trim()
    if (name.length >= 2 && !NOT_A_CITY.test(name)) return name
  }
  return null
}

export interface VoiceLog {
  heard: string
  result: string
  ok: boolean
}

const listening = ref(false)
const interim = ref('')
const last = shallowRef<VoiceLog | null>(null)
const error = ref<string | null>(null)
let recognition: Recognition | null = null

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'nl-BE'
  utterance.rate = 1.05
  speechSynthesis.speak(utterance)
}

const fmt = (v: number, digits = 0) => v.toLocaleString('nl-BE', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export function useVoice() {
  const { wind, simulation, updateSimulation, applyPreset, stopSimulation } = useWindData()
  const energy = useEnergy()
  const { place, setPlace } = useLocation()
  const market = useMarket()

  const simSpeed = () => simulation.value?.speed10 ?? wind.value.speed10
  const power = (kw: number) => (kw >= 1000 ? `${fmt(kw / 1000, 1)} megawatt` : `${fmt(kw)} kilowatt`)

  /** Commando uitvoeren; geeft een omschrijving van het gevolg terug, of null als het niet herkend werd. */
  function run(raw: string): { result: string, say?: string } | null {
    const t = normalize(raw)
    let m: RegExpMatchArray | null

    // Andere stad: "ga naar Gent", "verander de stad naar Brugge", "hoe is het weer in Leuven"
    const city = cityQuery(t)
    if (city) {
      const heard = raw
      searchPlaces(city)
        .then(([first]) => {
          const ok = !!first
          if (first) setPlace(first)
          const result = first ? `Je bekijkt nu ${first.name}${first.country ? ` (${first.country})` : ''}` : `Geen stad gevonden met de naam “${city}”`
          if (last.value?.heard === heard) last.value = { heard, result, ok }
          speak(first ? `We tonen nu ${first.name}.` : `Ik vond geen stad met de naam ${city}.`)
        })
        .catch(() => {
          if (last.value?.heard === heard) last.value = { heard, result: 'Zoeken lukt nu niet', ok: false }
          speak('Zoeken lukt nu niet.')
        })
      return { result: `Zoeken naar ${city}…` }
    }
    // Markt eerst: "hoeveel verdienen we" mag niet als energievraag gelezen worden
    if (/wanneer|beste moment|goedkoop|auto|laden|wasmachine/.test(t)) {
      const c = market.cheapest.value
      const g = market.greenest.value
      if (!c) return { result: 'Nog geen prijsdata beschikbaar' }
      const car = market.carTip.value
      const say = `Stroom is het goedkoopst tussen ${c.start} en ${c.end}, gemiddeld ${fmt(c.price)} euro per megawattuur.`
        + (g ? ` De meeste wind is er tussen ${g.start} en ${g.end}.` : '')
        + (car ? ` Je auto laden kost dan ongeveer ${fmt(car.cheap, 2)} euro in plaats van ${fmt(car.expensive, 2)} euro.` : '')
      return { result: `Goedkoopst ${c.start}–${c.end} (${fmt(c.price)} €/MWh)` + (car ? ` · auto laden (${CAR_CHARGE_KWH} kWh) € ${fmt(car.cheap, 2)}` : ''), say }
    }
    if (/prijs|kost|duur/.test(t) && !/verdien/.test(t)) {
      const p = market.priceNow.value
      const level = market.priceLevel.value < 0.33 ? 'goedkoop' : market.priceLevel.value > 0.66 ? 'duur' : 'gemiddeld'
      return { result: `Stroomprijs nu ${fmt(p)} €/MWh (${fmt(p / 10, 1)} c/kWh), ${level}`, say: `Stroom kost nu ${fmt(p)} euro per megawattuur, dat is ${level} voor vandaag.` }
    }
    if (/verdien|opbrengst|omzet|euro|geld/.test(t)) {
      const day = simulation.value ? market.simRevenueDay.value : market.revenueDay.value
      const co2 = market.co2DayGas.value
      return {
        result: `Nu € ${fmt(market.revenueRate.value)} per uur · 24 u: € ${fmt(day)} · ${fmt(co2, 1)} t CO₂ vermeden`,
        say: `Het park brengt nu ${fmt(market.revenueRate.value)} euro per uur op. Over 24 uur is dat ongeveer ${fmt(day)} euro, en we vermijden ${fmt(co2, 1)} ton CO2 tegenover een gascentrale.`,
      }
    }
    if (/hoeveel|wat (produceren|leveren|wekken)|energie|vermogen/.test(t)) {
      const kw = energy.kw.value
      const homes = Math.round(energy.households.value)
      const day = simulation.value ? energy.simDayKwh.value : energy.dayKwh.value
      const say = kw > 0
        ? `We produceren nu ${power(kw)} met ${energy.turbineCount.value} molens. Genoeg voor ongeveer ${fmt(homes)} gezinnen, ${fmt(energy.cityShare.value * 100)} procent van ${place.value.name}. Over 24 uur is dat ${fmt(day / 1000, 1)} megawattuur.`
        : 'De molens staan nu stil, we produceren geen stroom.'
      return { result: `Nu ${fmt(kw)} kW · ${fmt(homes)} gezinnen · ${fmt(day / 1000, 1)} MWh per dag`, say }
    }
    if (/storm/.test(t)) {
      applyPreset(PRESETS[2].values)
      return { result: 'Storm gesimuleerd: 21 m/s, de molens gaan in stormstop' }
    }
    if (/windstil|geen wind/.test(t)) {
      applyPreset(PRESETS[0].values)
      return { result: 'Windstil: de molens staan stil' }
    }
    if (/live|echte (data|wind)|terug/.test(t)) {
      stopSimulation()
      energy.reset()
      return { result: 'Terug naar de live data van Open-Meteo' }
    }
    if (/pauze|pauzeer|stop/.test(t) && !/regen/.test(t)) {
      energy.pause()
      return { result: 'Afspelen gepauzeerd' }
    }
    if (/speel|afspelen|versneld|dag af/.test(t)) {
      energy.play()
      return { result: 'De verwachting van 24 uur wordt versneld afgespeeld' }
    }
    if ((m = t.match(/(\d{1,2}) molens?|molens? (?:op|naar) (\d{1,2})/))) {
      const n = Math.min(MAX_TURBINES, Math.max(1, Number(m[1] ?? m[2])))
      energy.turbineCount.value = n
      return { result: `Windpark ingesteld op ${n} ${n === 1 ? 'molen' : 'molens'}` }
    }
    if (/(grote|langere|grotere) (wieken|bladen|rotor)/.test(t)) {
      energy.rotorScale.value = Math.min(1.3, Math.round((energy.rotorScale.value + 0.1) * 100) / 100)
      return { result: `Rotordiameter ${fmt(energy.rotorScale.value * 100)}%` }
    }
    if (/(kleine|kortere|kleinere) (wieken|bladen|rotor)/.test(t)) {
      energy.rotorScale.value = Math.max(0.7, Math.round((energy.rotorScale.value - 0.1) * 100) / 100)
      return { result: `Rotordiameter ${fmt(energy.rotorScale.value * 100)}%` }
    }
    if ((m = t.match(/(?:zon|tijd|klok|uur|het is).*?(\d{1,2})(?:[:u ](\d{2}))?/))) {
      const hour = Math.min(23.75, Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0))
      updateSimulation({ hour })
      return { result: `Zon gezet op ${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}` }
    }
    if ((m = t.match(/wind (?:op|naar) (\d{1,2}(?:[.,]\d)?)|(\d{1,2}(?:[.,]\d)?) meter per seconde/))) {
      const v = Math.min(30, Number((m[1] ?? m[2]).replace(',', '.')))
      updateSimulation({ speed10: v })
      return { result: `Wind op ${fmt(v, 1)} m/s gezet` }
    }
    if (/meer wind|harder|meer/.test(t)) {
      const v = Math.min(30, simSpeed() + 3)
      updateSimulation({ speed10: v })
      return { result: `Meer wind: ${fmt(v, 1)} m/s` }
    }
    if (/minder wind|zachter|minder/.test(t)) {
      const v = Math.max(0, simSpeed() - 3)
      updateSimulation({ speed10: v })
      return { result: `Minder wind: ${fmt(v, 1)} m/s` }
    }
    if (/regen/.test(t) && !/stop|geen/.test(t)) {
      updateSimulation({ precipitation: 1.2, cloudCover: 95 })
      return { result: 'Het regent: 1,2 mm per kwartier' }
    }
    if (/droog|geen regen|helder|zon/.test(t)) {
      updateSimulation({ precipitation: 0, cloudCover: 10 })
      return { result: 'Droog en helder weer' }
    }
    return null
  }

  /** Tekst (van spraak of een knop) verwerken en tonen wat er gebeurde. */
  function handle(alternatives: string[]) {
    for (const heard of alternatives) {
      const outcome = run(heard)
      if (outcome) {
        last.value = { heard, result: outcome.result, ok: true }
        if (outcome.say) speak(outcome.say)
        return
      }
    }
    last.value = { heard: alternatives[0] ?? '', result: 'Niet begrepen. Probeer een van de voorbeelden hieronder.', ok: false }
  }

  function listen() {
    if (!Ctor) {
      error.value = 'Spraakherkenning werkt niet in deze browser (probeer Chrome of Edge). Gebruik de knoppen.'
      return
    }
    if (listening.value) {
      recognition?.stop()
      return
    }
    error.value = null
    interim.value = ''
    recognition = new Ctor()
    recognition.lang = 'nl-BE'
    recognition.interimResults = true
    recognition.maxAlternatives = 3
    recognition.continuous = false
    recognition.onresult = (e) => {
      const result = e.results[e.results.length - 1]
      if (!result.isFinal) {
        interim.value = result[0].transcript
        return
      }
      interim.value = ''
      handle(Array.from({ length: result.length }, (_, i) => result[i].transcript))
    }
    recognition.onerror = (e) => {
      error.value = e.error === 'not-allowed'
        ? 'Geen toegang tot de microfoon. Gebruik de knoppen.'
        : e.error === 'no-speech'
          ? 'Niets gehoord. Probeer opnieuw.'
          : `Spraakfout: ${e.error}`
    }
    recognition.onend = () => {
      listening.value = false
    }
    listening.value = true
    recognition.start()
  }

  return { listening, interim, last, error, listen, handle }
}
