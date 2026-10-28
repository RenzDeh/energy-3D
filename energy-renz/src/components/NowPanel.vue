<script setup lang="ts">
import { computed } from 'vue'
import { useEnergy } from '../composables/useEnergy'
import { useLocation } from '../composables/useLocation'
import { useMarket } from '../composables/useMarket'
import { useWindData } from '../composables/useWindData'
import { centsPerKwh, fmt, power, priceTone } from '../lib/format'
import { beaufort, compassLabel, msToKmh } from '../lib/turbine'
import Icon from './Icon.vue'

/** Overzicht "Nu": is stroom goedkoop, wat doet het windpark en wat voor weer is het. */
const emit = defineEmits<{ plan: [] }>()

const { wind } = useWindData()
const { kw, ratedKw, households, cityShare, position } = useEnergy()
const { hours, priceNow, retailNow, priceLevel, cheapest, co2DayGas, priceSource } = useMarket()
const { place } = useLocation()

const tone = computed(() => priceTone(priceLevel.value))
const load = computed(() => (ratedKw.value ? kw.value / ratedKw.value : 0))

const COMPASS_FULL: Record<string, string> = {
  N: 'het noorden',
  NO: 'het noordoosten',
  O: 'het oosten',
  ZO: 'het zuidoosten',
  Z: 'het zuiden',
  ZW: 'het zuidwesten',
  W: 'het westen',
  NW: 'het noordwesten',
}

const parkText = computed(() => {
  const v = wind.value.speed100
  if (v > 25) { return 'Te veel wind: de molens staan veilig stil.' }
  if (kw.value <= 0) { return 'Te weinig wind: de molens staan stil.' }
  if (cityShare.value >= 1) { return `Genoeg stroom voor heel ${place.value.name}.` }
  return `Genoeg stroom voor ${fmt(households.value)} gezinnen.`
})

const sky = computed(() => {
  const { cloudCover, precipitation, isDay } = wind.value
  if (precipitation > 0.05) { return { icon: 'rain' as const, text: 'Regen' } }
  if (cloudCover < 25) { return { icon: isDay ? 'sun' as const : 'moon' as const, text: 'Helder' } }
  if (cloudCover < 70) { return { icon: 'cloud' as const, text: 'Wat wolken' } }
  return { icon: 'cloud' as const, text: 'Bewolkt' }
})

/** Kleine staafgrafiek van de prijs voor de komende 24 uur */
const bars = computed(() => {
  const h = hours.value.slice(0, 24)
  if (h.length < 2) { return null }
  const prices = h.map(x => x.price)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const floor = Math.min(lo, 0)
  return {
    items: h.map((x) => {
      const level = (x.price - lo) / (hi - lo || 1)
      return {
        height: 18 + ((x.price - floor) / (hi - floor || 1)) * 82,
        tone: priceTone(level).tone,
      }
    }),
    now: Math.min(Math.floor(position.value), h.length - 1),
    start: h[0].time,
    end: h.at(-1)!.time,
  }
})
</script>

<template>
  <div class="now">
    <!-- Stroomprijs -->
    <section class="block">
      <p class="ui-label">Stroom nu</p>
      <div class="price" :data-tone="tone.tone">
        <span class="badge">{{ tone.word }}</span>
        <span class="value">±{{ fmt(retailNow * 100) }} <small>cent per kWh</small></span>
      </div>
      <p class="note">Alles inbegrepen, met een dynamisch contract · beursprijs {{ fmt(centsPerKwh(priceNow), 1) }} cent</p>

      <div v-if="bars" class="bars" role="img" :aria-label="`Prijs per uur van ${bars.start} tot ${bars.end}`">
        <span
          v-for="(b, i) in bars.items"
          :key="i"
          :data-tone="b.tone"
          :class="{ current: i === bars.now }"
          :style="{ height: `${b.height}%` }"
        ></span>
      </div>
      <div v-if="bars" class="axis"><span>nu</span><span>{{ bars.end }}</span></div>

      <button v-if="cheapest" type="button" class="tip" @click="emit('plan')">
        <Icon name="clock" />
        <span>Goedkoopst {{ cheapest.tomorrow ? 'morgen ' : '' }}tussen <b>{{ cheapest.start }}</b> en <b>{{ cheapest.end }}</b></span>
        <Icon name="chevron" :size="16" />
      </button>
      <p v-if="priceSource === 'estimate'" class="note">Geschatte prijs: geen beursdata voor dit land.</p>
    </section>

    <!-- Windpark -->
    <section class="block">
      <p class="ui-label">Windpark</p>
      <div class="park">
        <span class="park-icon"><Icon name="home" :size="20" /></span>
        <div>
          <b>{{ parkText }}</b>
          <small>{{ power(kw) }} · {{ fmt(load * 100) }}% van het maximum</small>
        </div>
      </div>
      <div class="meter" role="meter" :aria-valuenow="Math.round(load * 100)" aria-valuemin="0" aria-valuemax="100" aria-label="Hoe hard het park werkt">
        <div :style="{ width: `${Math.min(100, load * 100)}%` }"></div>
      </div>
      <p v-if="co2DayGas > 0.05" class="co2 ui-optional">
        <Icon name="leaf" :size="16" /> Vandaag ±{{ fmt(co2DayGas, co2DayGas < 10 ? 1 : 0) }} ton CO₂ bespaard
      </p>
    </section>

    <!-- Weer -->
    <section class="block">
      <p class="ui-label">Weer</p>
      <div class="tiles">
        <div class="tile">
          <Icon name="wind" />
          <b>{{ fmt(msToKmh(wind.speed10)) }} <small>km/u</small></b>
          <small>{{ beaufort(wind.speed10).name }}, uit {{ COMPASS_FULL[compassLabel(wind.directionDeg)] }}</small>
        </div>
        <div class="tile">
          <Icon name="temp" />
          <b>{{ fmt(wind.temperature) }}°</b>
          <small>Temperatuur</small>
        </div>
        <div class="tile">
          <Icon :name="sky.icon" />
          <b>{{ sky.text }}</b>
          <small>{{ fmt(wind.cloudCover) }}% wolken</small>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.now {
  display: flex;
  flex-direction: column;
  gap: var(--ui-section-gap);
}
.block {
  display: flex;
  flex-direction: column;
  gap: var(--ui-block-gap);
}

.price {
  display: flex;
  align-items: center;
  gap: 12px;
}
.badge {
  padding: 6px 14px;
  font-size: 15px;
  font-weight: 650;
  text-transform: capitalize;
  border-radius: 999px;
}
.price[data-tone='good'] .badge {
  color: var(--ui-accent);
  background: var(--ui-accent-soft);
}
.price[data-tone='mid'] .badge {
  color: #a06f00;
  background: var(--ui-mid-soft);
}
.price[data-tone='bad'] .badge {
  color: var(--ui-bad);
  background: var(--ui-bad-soft);
}
.value {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.value small {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
  letter-spacing: 0;
}

.bars {
  height: 44px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
}
.bars span {
  flex: 1;
  border-radius: 3px;
  opacity: 0.85;
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
.bars span.current {
  opacity: 1;
  outline: 2px solid var(--ui-text);
  outline-offset: 1px;
}
.axis {
  display: flex;
  justify-content: space-between;
  margin-top: -4px;
  font-size: 11px;
  color: var(--ui-muted);
}

.tip {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 12px;
  font-size: 14px;
  text-align: left;
  color: var(--ui-text);
  background: var(--ui-accent-soft);
  border: 0;
  border-radius: 14px;
  cursor: pointer;
  transition: filter 0.15s;
}
.tip:hover {
  filter: brightness(0.97);
}
.tip span {
  flex: 1;
}
.tip .icon {
  color: var(--ui-accent);
}
.note {
  margin: 0;
  font-size: 12px;
  color: var(--ui-muted);
}

.park {
  display: flex;
  align-items: center;
  gap: 12px;
}
.park-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: none;
  color: var(--ui-accent);
  background: var(--ui-accent-soft);
  border-radius: 12px;
}
.park b {
  display: block;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.3;
}
.park small {
  font-size: 13px;
  color: var(--ui-muted);
}
.meter {
  height: 8px;
  overflow: hidden;
  background: var(--ui-surface-soft);
  border-radius: 999px;
}
.meter div {
  height: 100%;
  background: var(--ui-accent);
  border-radius: 999px;
  transition: width 0.8s ease;
}
.co2 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}
.co2 .icon {
  color: var(--ui-accent);
}

.tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--ui-surface-soft);
  border-radius: 14px;
}
.tile .icon {
  color: var(--ui-blue);
}
.tile b {
  font-size: 17px;
  font-weight: 650;
}
.tile b small {
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-muted);
}
.tile > small {
  font-size: 12px;
  line-height: 1.3;
  color: var(--ui-muted);
}

@media (prefers-reduced-motion: reduce) {
  .meter div {
    transition: none;
  }
}
</style>
