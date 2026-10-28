<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMarket } from '../composables/useMarket'
import { euro, fmt, priceTone } from '../lib/format'
import Icon from './Icon.vue'

/** Planner: wanneer start je een toestel het goedkoopst, binnen de day-ahead prijzen van de komende 24 uur? */
const { plan, hours, priceSource } = useMarket()

interface Appliance { id: string, label: string, icon: 'car' | 'wash' | 'dish' | 'dryer' | 'boiler', kwh: number, duration: number }

const APPLIANCES: Appliance[] = [
  { id: 'car', label: 'Auto', icon: 'car', kwh: 40, duration: 0 },
  { id: 'wash', label: 'Was', icon: 'wash', kwh: 1, duration: 2 },
  { id: 'dish', label: 'Vaat', icon: 'dish', kwh: 1.2, duration: 2.5 },
  { id: 'dryer', label: 'Droger', icon: 'dryer', kwh: 2.5, duration: 2 },
  { id: 'boiler', label: 'Boiler', icon: 'boiler', kwh: 3, duration: 3 },
]
/** Laadpunten thuis: stopcontact, gewone laadpaal, snelle laadpaal (kW) */
const CHARGERS = [
  { kw: 3.7, label: 'Stopcontact' },
  { kw: 7.4, label: 'Laadpaal' },
  { kw: 11, label: 'Snelle paal' },
]

const selected = ref('car')
const carKwh = ref(40)
const chargerKw = ref(7.4)
/** Uur waarop het toestel klaar moet zijn ("" = maakt niet uit) */
const readyBy = ref('')

const appliance = computed(() => APPLIANCES.find(a => a.id === selected.value)!)
const kwh = computed(() => (selected.value === 'car' ? carKwh.value : appliance.value.kwh))
const duration = computed(() => (selected.value === 'car' ? carKwh.value / chargerKw.value : appliance.value.duration))

/** Keuzes voor "klaar tegen": de volle uren van de verwachting, vanaf het eerste uur waarop het toestel klaar kan zijn */
const readyOptions = computed(() => {
  const first = Math.ceil(duration.value)
  return hours.value.slice(first, 25).map((h, i) => ({ value: String(first + i), label: h.time }))
})
const deadline = computed(() => {
  const n = Number(readyBy.value)
  return readyBy.value && n >= Math.ceil(duration.value) ? n : 24
})

const result = computed(() => plan(kwh.value, duration.value, deadline.value))
const saving = computed(() => (result.value ? result.value.costNow - result.value.cost : 0))

const durationText = (h: number) => {
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return hh ? `${hh} u${mm ? ` ${mm}` : ''}` : `${mm} min`
}
/** Tijdstip waarop het toestel klaar is */
const doneAt = computed(() => {
  const r = result.value
  if (!r) return ''
  const [h, m] = r.start.split(':').map(Number)
  const total = h * 60 + m + Math.round(duration.value * 60)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
})

/** Tijdlijn met het beste blok gemarkeerd */
const bars = computed(() => {
  const t = result.value?.timeline
  if (!t || t.length < 2) return null
  const prices = t.map(x => x.price)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const floor = Math.min(lo, 0)
  return t.map(x => ({
    height: 18 + ((x.price - floor) / (hi - floor || 1)) * 82,
    tone: priceTone((x.price - lo) / (hi - lo || 1)).tone,
    chosen: x.chosen,
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
          <span>Hoeveel laden? <b>{{ carKwh }} kWh</b></span>
          <input v-model.number="carKwh" class="ui-range" type="range" min="5" max="80" step="5">
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

      <label class="field row">
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
        <template v-else>Start {{ result.tomorrow ? 'morgen ' : '' }}om <b>{{ result.start }}</b></template>
      </p>
      <p class="sub">Klaar om {{ doneAt }} · duurt {{ durationText(duration) }} · kost ±{{ euro(result.cost) }}</p>

      <div v-if="bars" class="bars" aria-hidden="true">
        <span v-for="(b, i) in bars" :key="i" :data-tone="b.tone" :class="{ chosen: b.chosen }" :style="{ height: `${b.height}%` }" />
      </div>

      <p v-if="saving > 0.005" class="saving">
        <Icon name="leaf" :size="18" />
        <span>Je bespaart <b>{{ euro(saving) }}</b> tegenover nu starten</span>
      </p>
      <p v-else class="saving">
        <Icon name="leaf" :size="18" />
        <span>Nu is het goedkoopste moment</span>
      </p>
    </section>
    <p v-else class="help">Er zijn nog geen prijzen, of het lukt niet meer vóór dat uur.</p>

    <p class="help">
      Prijzen van de stroombeurs<template v-if="priceSource !== 'live'"> (geschat)</template>.
      Werkt als je een dynamisch energiecontract hebt. Netkosten en taksen komen er nog bij.
    </p>
  </div>
</template>

<style scoped>
.planner { display: flex; flex-direction: column; gap: 22px; }
.block { display: flex; flex-direction: column; gap: 12px; }

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
  font-size: 12px;
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

.field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--ui-muted); }
.field span { display: flex; justify-content: space-between; }
.field b { font-weight: 650; color: var(--ui-text); }
.field.row { flex-direction: row; align-items: center; justify-content: space-between; }
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
  padding: 16px;
  background: var(--ui-surface-soft);
  border-radius: 16px;
}
.big { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
.big b { color: var(--ui-accent); }
.sub { margin: 0; font-size: 13px; color: var(--ui-muted); }
.bars {
  height: 36px;
  margin-top: 4px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
}
.bars span { flex: 1; border-radius: 3px; opacity: 0.35; }
.bars span[data-tone='good'] { background: #6cc995; }
.bars span[data-tone='mid'] { background: #f0c454; }
.bars span[data-tone='bad'] { background: #ec8a7f; }
.bars span.chosen { opacity: 1; background: var(--ui-accent); }
.saving {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 0;
  font-size: 14px;
}
.saving .icon { color: var(--ui-accent); }
.saving b { color: var(--ui-accent); }
.help { margin: 0; font-size: 12px; line-height: 1.45; color: var(--ui-muted); }
</style>
