<script setup lang="ts">
import { computed, ref } from 'vue'
import { CAR_KWH_PER_KM, useMarket } from '../composables/useMarket'
import { euro, fmt, priceTone } from '../lib/format'
import Icon from './Icon.vue'

/** Planner: wanneer start je een toestel het goedkoopst? Kijkt tot 48 uur vooruit. */
const { plan, planBattery, planHours, dayOffset, priceSource } = useMarket()

const DAY_NAMES = ['', 'morgen ', 'overmorgen ']
const dayName = (day: number) => DAY_NAMES[day] ?? ''

interface Appliance {
  id: string
  label: string
  icon: 'car' | 'battery' | 'heatpump' | 'boiler' | 'sauna'
  kwh: number
  duration: number
  /** Hoe vaak een gemiddeld gezin dit per jaar doet (voor de auto berekend uit de kilometers) */
  perYear: number
  /** Korte uitleg onder de tegels */
  hint: string
}

// Enkel grote verbruikers: bij kleine toestellen (wasmachine, vaatwasser) scheelt het maar enkele centen
const APPLIANCES: Appliance[] = [
  { id: 'car', label: 'Auto', icon: 'car', kwh: 40, duration: 0, perYear: 0, hint: '' },
  { id: 'battery', label: 'Batterij', icon: 'battery', kwh: 10, duration: 2, perYear: 365, hint: 'Thuisbatterij van 10 kWh: goedkoop opladen, op het dure uur zelf gebruiken.' },
  { id: 'heatpump', label: 'Warmtepomp', icon: 'heatpump', kwh: 10, duration: 4, perYear: 150, hint: 'Je huis een paar uur vooraf opwarmen (±10 kWh), op winterdagen.' },
  { id: 'boiler', label: 'Boiler', icon: 'boiler', kwh: 5, duration: 2.5, perYear: 365, hint: 'Elektrische boiler of warmtepompboiler: een volle tank warm water (±5 kWh).' },
  { id: 'sauna', label: 'Sauna', icon: 'sauna', kwh: 12, duration: 2, perYear: 50, hint: 'Sauna of jacuzzi opwarmen (±12 kWh per keer).' },
]
/** Laad- en ontlaadvermogen van een gewone thuisbatterij (kW) */
const BATTERY_KW = 5
/** Gemiddeld aantal gereden kilometers per jaar met een auto in België */
const KM_PER_YEAR = 15000
/** Laadpunten thuis: stopcontact, gewone laadpaal, snelle laadpaal (kW) */
const CHARGERS = [
  { kw: 3.7, label: 'Stopcontact' },
  { kw: 7.4, label: 'Laadpaal' },
  { kw: 11, label: 'Snelle paal' },
]

const selected = ref('car')
/** Hoeveel kilometer rijbereik je wil bijladen; omgerekend naar kWh met het gemiddelde verbruik */
const carKm = ref(220)
const carKwh = computed(() => carKm.value * CAR_KWH_PER_KM)
const chargerKw = ref(7.4)
/** Uur waarop het toestel klaar moet zijn ("" = maakt niet uit) */
const readyBy = ref('')

const appliance = computed(() => APPLIANCES.find(a => a.id === selected.value)!)
const kwh = computed(() => (selected.value === 'car' ? carKwh.value : appliance.value.kwh))
const duration = computed(() => (selected.value === 'car' ? carKwh.value / chargerKw.value : appliance.value.duration))

/** Keuzes voor "klaar tegen": de volle uren van de komende 48 uur, vanaf het eerste uur waarop het toestel klaar kan zijn */
const readyOptions = computed(() => {
  const first = Math.ceil(duration.value)
  return planHours.value.slice(first).map((h, i) => ({ value: String(first + i), label: `${dayName(dayOffset(h.iso))}${h.time}` }))
})
/** Uur (vanaf nu) waarop het klaar moet zijn, of undefined voor "maakt niet uit" */
const deadline = computed(() => {
  const n = Number(readyBy.value)
  return readyBy.value && n >= Math.ceil(duration.value) ? n : undefined
})

const isBattery = computed(() => selected.value === 'battery')
const result = computed(() => (isBattery.value ? null : plan(kwh.value, duration.value, deadline.value)))
const battery = computed(() => (isBattery.value ? planBattery(appliance.value.kwh, BATTERY_KW) : null))
const batteryYearly = computed(() => Math.max(0, battery.value?.gain ?? 0) * appliance.value.perYear)
const when = (p: { day: number, start: string, end: string }) => `${dayName(p.day)}${p.start} – ${p.end}`
const saving = computed(() => (result.value ? result.value.costNow - result.value.cost : 0))

/** Hoe vaak per jaar: voor de auto zoveel laadbeurten als nodig voor de jaarlijkse kilometers */
const timesPerYear = computed(() => (selected.value === 'car' ? Math.round(KM_PER_YEAR / carKm.value) : appliance.value.perYear))
/**
 * Besparing per jaar als je altijd op het goedkoopste moment start, tegenover "gewoon ergens" starten
 * (de gemiddelde kost over alle startmomenten). Zo hangt het niet af van hoe goedkoop het toevallig nu is.
 */
const yearly = computed(() => (result.value ? Math.max(0, result.value.costAverage - result.value.cost) * timesPerYear.value : 0))

const durationText = (h: number) => {
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return hh ? `${hh} u${mm ? ` ${mm}` : ''}` : `${mm} min`
}
/** Tijdstip waarop het toestel klaar is, met de dag erbij als dat later is dan vandaag */
const doneAt = computed(() => {
  const r = result.value
  if (!r) { return '' }
  const [h, m] = r.start.split(':').map(Number)
  const total = h * 60 + m + Math.round(duration.value * 60)
  const day = r.day + Math.floor(total / 1440)
  const time = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  return day ? `${dayName(day)}${time}` : `om ${time}`
})

/** Tijdlijn met het beste blok gemarkeerd (bij de batterij: laden in groen, gebruiken in blauw) */
const bars = computed(() => {
  const t = result.value?.timeline.map(x => ({ price: x.price, chosen: x.chosen, use: false }))
    ?? battery.value?.timeline.map(x => ({ price: x.price, chosen: x.charge, use: x.use }))
  if (!t || t.length < 2) { return null }
  const prices = t.map(x => x.price)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const floor = Math.min(lo, 0)
  return t.map(x => ({
    height: 18 + ((x.price - floor) / (hi - floor || 1)) * 82,
    tone: priceTone((x.price - lo) / (hi - lo || 1)).tone,
    chosen: x.chosen,
    use: x.use,
  }))
})
</script>

<template>
  <div class="planner">
    <section class="block">
      <p class="ui-label">Wat wil je doen?</p>
      <div class="appliances" role="radiogroup" aria-label="Toestel">
        <button
          v-for="a in APPLIANCES"
          :key="a.id"
          type="button"
          role="radio"
          :aria-checked="selected === a.id"
          @click="selected = a.id"
        >
          <Icon :name="a.icon" :size="22" />
          <span>{{ a.label }}</span>
        </button>
      </div>

      <template v-if="selected === 'car'">
        <label class="field">
          <span>Hoeveel km bijladen? <b>{{ carKm }} km <small class="hint">· ±{{ fmt(carKwh) }} kWh</small></b></span>
          <input v-model.number="carKm" class="ui-range" type="range" min="20" max="500" step="10" />
        </label>
        <div class="segments" role="radiogroup" aria-label="Laadpunt">
          <button
            v-for="c in CHARGERS"
            :key="c.kw"
            type="button"
            role="radio"
            :aria-checked="chargerKw === c.kw"
            @click="chargerKw = c.kw"
          >
            {{ c.label }}
          </button>
        </div>
      </template>
      <p v-else class="hint-line">{{ appliance.hint }}</p>

      <label v-if="!isBattery" class="field row">
        <span>Klaar tegen</span>
        <select v-model="readyBy">
          <option value="">Maakt niet uit</option>
          <option v-for="o in readyOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
    </section>

    <section v-if="result" class="answer">
      <p class="ui-label">Ons advies</p>
      <p class="big">
        <template v-if="result.wait === 0">Start <b>nu</b></template>
        <template v-else>Start {{ dayName(result.day) }}om <b>{{ result.start }}</b></template>
      </p>
      <p class="sub">Klaar {{ doneAt }} · {{ durationText(duration) }} · ±{{ euro(result.cost) }}</p>

      <div v-if="bars" class="bars" aria-hidden="true">
        <span v-for="(b, i) in bars" :key="i" :data-tone="b.tone" :class="{ chosen: b.chosen }" :style="{ height: `${b.height}%` }"></span>
      </div>

      <p v-if="saving > 0.005" class="saving">
        <Icon name="leaf" :size="18" />
        <span>Je bespaart <b>{{ euro(saving) }}</b> tegenover nu starten</span>
      </p>
      <p v-else class="saving">
        <Icon name="leaf" :size="18" />
        <span>Nu is het goedkoopste moment</span>
      </p>
      <p v-if="yearly >= 1" class="year">
        Altijd zo plannen: ±<b>{{ euro(yearly) }} per jaar</b> ({{ timesPerYear }}×)
      </p>
    </section>
    <section v-else-if="battery" class="answer">
      <p class="ui-label">Ons advies</p>
      <template v-if="battery.gain > 0.05">
        <p class="big">Laad {{ battery.charge.wait === 0 ? '' : dayName(battery.charge.day) }}<b>{{ battery.charge.wait === 0 ? 'nu' : `om ${battery.charge.start}` }}</b></p>
        <p class="sub">Gebruik je batterij {{ when(battery.use) }} · laden kost ±{{ euro(battery.chargeCost) }}</p>
      </template>
      <template v-else>
        <p class="big">Vandaag <b>niet</b> de moeite</p>
        <p class="sub">Het prijsverschil is te klein voor het verlies bij het opslaan (±10%).</p>
      </template>

      <div v-if="bars" class="bars" aria-hidden="true">
        <span
          v-for="(b, i) in bars"
          :key="i"
          :data-tone="b.tone"
          :class="{ chosen: b.chosen,
                    use: b.use }"
          :style="{ height: `${b.height}%` }"
        ></span>
      </div>

      <p v-if="battery.gain > 0.05" class="saving">
        <Icon name="leaf" :size="18" />
        <span>Winst per dag: <b>{{ euro(battery.gain) }}</b></span>
      </p>
      <p v-if="batteryYearly >= 1" class="year">
        Elke dag zo'n verschil: ±<b>{{ euro(batteryYearly) }} per jaar</b>
      </p>
    </section>
    <p v-else class="help">Er zijn nog geen prijzen, of het lukt niet meer vóór dat uur.</p>

    <p class="help">
      Schatting voor een dynamisch contract, alles inbegrepen<template v-if="priceSource !== 'live'"> (geen beursdata)</template><template v-else-if="result?.estimated || battery?.estimated"> (na morgen geschat)</template>.
    </p>
  </div>
</template>

<style scoped>
.planner {
  display: flex;
  flex-direction: column;
  gap: var(--ui-section-gap);
}
.block {
  display: flex;
  flex-direction: column;
  gap: var(--ui-block-gap);
}

.appliances {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.appliances button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 0 8px;
  font-size: 11px;
  letter-spacing: -0.01em;
  font-weight: 550;
  color: var(--ui-muted);
  background: var(--ui-surface-soft);
  border: 2px solid transparent;
  border-radius: 14px;
  cursor: pointer;
}
.appliances button[aria-checked='true'] {
  color: var(--ui-accent);
  background: var(--ui-accent-soft);
  border-color: var(--ui-accent);
}

.segments {
  display: flex;
  padding: 4px;
  gap: 4px;
  background: var(--ui-surface-soft);
  border-radius: 12px;
}
.segments button {
  flex: 1;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 550;
  color: var(--ui-muted);
  background: none;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
}
.segments button[aria-checked='true'] {
  color: var(--ui-text);
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: var(--ui-muted);
}
.field span {
  display: flex;
  justify-content: space-between;
}
.field b {
  font-weight: 650;
  color: var(--ui-text);
}
.field .hint {
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-muted);
}
.field.row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
select {
  padding: 8px 10px;
  font-size: 14px;
  color: var(--ui-text);
  background: var(--ui-surface-soft);
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.answer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--ui-surface-soft);
  border-radius: 16px;
}
.big {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.big b {
  color: var(--ui-accent);
}
.sub {
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}
.bars {
  height: 36px;
  margin-top: 4px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
}
.bars span {
  flex: 1;
  border-radius: 3px;
  opacity: 0.35;
}
.bars span[data-tone='good'] {
  background: #6cc995;
}
.bars span[data-tone='mid'] {
  background: #f0c454;
}
.bars span[data-tone='bad'] {
  background: #ec8a7f;
}
.bars span.chosen {
  opacity: 1;
  background: var(--ui-accent);
}
.bars span.use {
  opacity: 1;
  background: var(--ui-blue);
}
.hint-line {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--ui-muted);
}
.year {
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}
.year b {
  color: var(--ui-text);
}
.saving {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 0;
  font-size: 14px;
}
.saving .icon {
  color: var(--ui-accent);
}
.saving b {
  color: var(--ui-accent);
}
.help {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ui-muted);
}
</style>
