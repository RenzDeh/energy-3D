<script setup lang="ts">
import { computed } from 'vue'
import { useEnergy } from '../composables/useEnergy'
import { CAR_CHARGE_KWH, GAS_PLANT_KG_PER_MWH, useMarket } from '../composables/useMarket'
import type { Window } from '../composables/useMarket'
import { useViewMode } from '../composables/useViewMode'
import { useWindData } from '../composables/useWindData'
import InfoTip from './InfoTip.vue'

const {
  hours,
  priceNow,
  priceLevel,
  revenueRate,
  revenue,
  revenueDay,
  simRevenueDay,
  co2,
  co2Mix,
  cheapest,
  priciest,
  greenest,
  carTip,
  negativeHours,
  priceSource,
  co2Source,
} = useMarket()
const { position, playbackHours } = useEnergy()
const { simulation } = useWindData()
const { mode } = useViewMode()

/** Gemiddelde Belgische auto: ±15.000 km per jaar × 120 g CO₂/km ≈ 1,8 ton per jaar */
const CAR_TONNES_YEAR = 1.8
const cars = computed(() => co2.value.gas / CAR_TONNES_YEAR)
const levelText = computed(() => (priceLevel.value < 0.33 ? 'goedkoop' : priceLevel.value > 0.66 ? 'duur' : 'gemiddeld'))
const when = (w: Window) => `${w.tomorrow ? 'morgen ' : ''}${w.start}–${w.end}`
const priceLabel = (p: number) => (mode.value === 'expert' ? `${fmt(p)} €/MWh` : `${fmt(p / 10, 1)} c/kWh`)

const headline = computed(() => {
  const c = cheapest.value
  const now = `Stroom is nu ${levelText.value}: ${fmt(priceNow.value / 10, 1)} cent per kWh op de stroombeurs.`
  return c ? `${now} Het goedkoopst wordt het ${c.tomorrow ? 'morgen ' : ''}tussen ${c.start} en ${c.end}.` : now
})

const INFO = {
  price: 'Day-ahead prijs: de stroombeurs (EPEX) legt elke dag per uur de prijs voor morgen vast. 100 €/MWh = 10 cent per kWh. Op je factuur betaal je meer, door nettarieven en taksen.',
  revenueRate: 'Wat het park op dit moment verdient door zijn stroom aan de beursprijs te verkopen: vermogen (MW) × prijs (€/MWh).',
  chart: 'De prijs per uur voor de komende 24 uur. Duur is het meestal \'s ochtends en \'s avonds, als iedereen stroom nodig heeft. Goedkoop als het hard waait of de zon schijnt.',
  revenue: 'Wat het park de komende 24 uur verdient: voor elk uur de geproduceerde stroom maal de prijs van dat uur.',
  co2: `Hoeveel CO₂ we vermijden omdat deze stroom niet uit een gascentrale komt (${GAS_PLANT_KG_PER_MWH} kg per MWh). Een gemiddelde auto stoot ±1,8 ton per jaar uit. Tegenover de gemiddelde Belgische stroommix (veel kernenergie) is de besparing kleiner.`,
  moments: 'Met een dynamisch energiecontract betaal je per uur de beursprijs. Verbruik je op de groene momenten (auto laden, wasmachine, warmtepomp), dan bespaar je geld en gebruik je meer windstroom.',
  car: 'Een volle laadbeurt van een elektrische auto (40 kWh) aan de beursprijs van dat uur. Nettarieven en taksen komen er nog bij, maar die zijn op elk uur gelijk: het verschil blijft.',
  negative: 'Soms is er zoveel wind- en zonnestroom dat de prijs onder nul zakt: producenten betalen dan om te leveren. Windparken worden dan meestal tijdelijk stilgezet.',
}

const fmt = (v: number, digits = 0) => v.toLocaleString('nl-BE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const euro = (v: number) => `€ ${fmt(v, Math.abs(v) < 10 ? 2 : 0)}`
const power = (kw: number) => (kw >= 1000 ? `${fmt(kw / 1000, 1)} MW` : `${fmt(kw)} kW`)

/** Groen (goedkoop) → geel → rood (duur) */
function priceColor(level: number) {
  const hue = 130 - Math.min(Math.max(level, 0), 1) * 125
  return `hsl(${hue} 75% 55%)`
}

const W = 280
const H = 42
const chart = computed(() => {
  const h = hours.value.slice(0, 25)
  if (h.length < 2) return null
  const prices = h.map(x => x.price)
  const max = Math.max(...prices, 1)
  const min = Math.min(...prices, 0)
  const range = max - min || 1
  const step = W / h.length
  const zero = H - ((0 - min) / range) * H
  const bars = h.map((x, i) => {
    const y = H - ((x.price - min) / range) * H
    return {
      x: i * step + 1,
      y: Math.min(y, zero),
      w: step - 2,
      h: Math.max(1, Math.abs(zero - y)),
      color: priceColor((x.price - Math.min(...prices)) / (Math.max(...prices) - Math.min(...prices) || 1)),
    }
  })
  return { bars, zero, cursorX: (position.value / (h.length - 1)) * (W - step) + step / 2, start: h[0].time, mid: h[Math.floor(h.length / 2)].time, end: h.at(-1)!.time }
})
</script>

<template>
  <section class="market" aria-label="Stroomprijs en opbrengst">
    <p class="headline">{{ headline }}</p>
    <div class="live">
      <div>
        <strong :style="{ color: priceColor(priceLevel) }">
          <template v-if="mode === 'expert'">{{ fmt(priceNow) }} <small>€/MWh</small></template>
          <template v-else>{{ fmt(priceNow / 10, 1) }} <small>cent/kWh</small></template>
          <InfoTip :text="INFO.price" align="left" />
        </strong>
        <small>
          <template v-if="mode === 'expert'">{{ fmt(priceNow / 10, 1) }} c/kWh · </template>stroom is nu {{ levelText }}
        </small>
      </div>
      <div class="right">
        <strong>{{ euro(revenueRate) }} <small>/uur</small> <InfoTip :text="INFO.revenueRate" align="right" /></strong>
        <small>wat het park nu verdient</small>
      </div>
    </div>

    <div v-if="chart" class="chart">
      <p class="label">Stroomprijs per uur: <span class="g">groen = goedkoop</span>, <span class="r">rood = duur</span> <InfoTip :text="INFO.chart" align="left" /></p>
      <svg :viewBox="`0 -2 ${W} ${H + 4}`" preserveAspectRatio="none" role="img" aria-label="Day-ahead stroomprijs per uur">
        <rect v-for="(b, i) in chart.bars" :key="i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :fill="b.color" rx="1" />
        <line class="zero" x1="0" :x2="W" :y1="chart.zero" :y2="chart.zero" />
        <line v-if="playbackHours !== null" class="cursor" :x1="chart.cursorX" :x2="chart.cursorX" y1="-2" :y2="H + 2" />
      </svg>
      <div class="axis"><span>{{ chart.start }}</span><span>{{ chart.mid }}</span><span>{{ chart.end }}</span></div>
    </div>

    <dl>
      <div>
        <dt>Opbrengst <InfoTip :text="INFO.revenue" align="left" /></dt>
        <dd v-if="simulation">{{ euro(simRevenueDay) }} <small>/ 24 u</small></dd>
        <dd v-else-if="playbackHours !== null">{{ euro(revenue) }} <small>van {{ euro(revenueDay) }}</small></dd>
        <dd v-else>{{ euro(revenueDay) }} <small>/ 24 u</small></dd>
      </div>
      <div>
        <dt>CO₂ vermeden <InfoTip :text="INFO.co2" align="right" /></dt>
        <dd v-if="mode === 'expert'">{{ fmt(co2.gas, 1) }} t <small>vs. gas · {{ fmt(co2.mix, 1) }} t vs. mix</small></dd>
        <dd v-else>{{ fmt(co2.gas, 0) }} ton <small>≈ {{ fmt(cars) }} auto's/jaar</small></dd>
      </div>
    </dl>

    <ul class="moments" aria-label="Beste momenten om stroom te verbruiken">
      <li class="title">Wanneer stroom gebruiken? <InfoTip :text="INFO.moments" align="left" /></li>
      <li v-if="cheapest"><i class="cheap" /><span>Goedkoopst</span><b>{{ when(cheapest) }}</b><em>{{ priceLabel(cheapest.price) }}</em></li>
      <li v-if="greenest"><i class="green" /><span>Meeste wind</span><b>{{ when(greenest) }}</b><em>{{ power(greenest.kw) }}</em></li>
      <li v-if="priciest"><i class="dear" /><span>Vermijd</span><b>{{ when(priciest) }}</b><em>{{ priceLabel(priciest.price) }}</em></li>
    </ul>
    <p v-if="carTip && cheapest && priciest" class="tip">
      Auto laden ({{ CAR_CHARGE_KWH }} kWh): <b>{{ euro(carTip.cheap) }}</b> om {{ cheapest.start }} in plaats van {{ euro(carTip.expensive) }} om {{ priciest.start }}
      <InfoTip :text="INFO.car" align="right" />
    </p>
    <p v-if="negativeHours" class="tip warn">
      {{ negativeHours }} uur met negatieve prijs <InfoTip :text="INFO.negative" align="right" />
    </p>

    <p class="source">
      <template v-if="mode === 'expert'">
        Prijs: {{ priceSource === 'live' ? 'EPEX day-ahead België via Energy-Charts (CC BY 4.0)' : priceSource === 'loading' ? 'laden…' : 'schatting (geen marktdata)' }}
        · CO₂: {{ co2Source === 'live' ? `Elia Open Data (${fmt(co2Mix)} g/kWh)` : 'schatting' }}, gascentrale {{ GAS_PLANT_KG_PER_MWH }} kg/MWh
      </template>
      <template v-else>
        Bron: {{ priceSource === 'live' ? 'stroombeurs EPEX (via Energy-Charts)' : priceSource === 'loading' ? 'laden…' : 'schatting' }} en Elia
      </template>
    </p>
  </section>
</template>

<style scoped>
.market { display: flex; flex-direction: column; gap: 7px; }
.headline {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: #eef4f7;
}
.label {
  margin: 0 0 2px;
  font-size: 11px;
  color: rgb(238 244 247 / 0.6);
}
.label .g { color: #4ade80; }
.label .r { color: #f87171; }
.moments li.title {
  display: block;
  font-size: 11px;
  color: rgb(238 244 247 / 0.6);
}
.live {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
}
.live strong {
  display: block;
  font-size: 24px;
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: -0.02em;
}
.live strong small { font-size: 12px; font-weight: 500; color: rgb(238 244 247 / 0.6); }
.live .right { text-align: right; }
.live .right strong { color: #fcd34d; }
.live > div > small {
  font-size: 11px;
  color: rgb(238 244 247 / 0.6);
}
.chart svg {
  width: 100%;
  height: 42px;
  overflow: visible;
}
.zero {
  stroke: rgb(238 244 247 / 0.3);
  vector-effect: non-scaling-stroke;
}
.cursor {
  stroke: #eef4f7;
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}
.axis {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: rgb(238 244 247 / 0.5);
}
dl {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 10px;
}
dt { font-size: 11px; color: rgb(238 244 247 / 0.6); }
dd { margin: 0; font-size: 14px; font-weight: 600; }
dd small { font-size: 11px; font-weight: 450; color: rgb(238 244 247 / 0.6); }
dd.sub { font-size: 10.5px; font-weight: 450; color: rgb(238 244 247 / 0.55); }
.moments {
  margin: 0;
  padding: 8px 0 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border-top: 1px solid rgb(255 255 255 / 0.1);
  font-size: 12px;
}
.moments li {
  display: grid;
  grid-template-columns: 10px 82px 1fr auto;
  align-items: center;
  gap: 6px;
}
.moments i { width: 8px; height: 8px; border-radius: 50%; }
.moments i.cheap { background: #4ade80; }
.moments i.green { background: #38bdf8; }
.moments i.dear { background: #f87171; }
.moments span { color: rgb(238 244 247 / 0.65); }
.moments b { font-weight: 600; }
.moments em { font-style: normal; color: rgb(238 244 247 / 0.65); }
.tip {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.4;
  color: rgb(238 244 247 / 0.8);
}
.tip b { color: #4ade80; }
.tip span { color: rgb(238 244 247 / 0.45); }
.tip.warn { color: #fca5a5; }
.source {
  margin: 0;
  font-size: 10px;
  line-height: 1.35;
  color: rgb(238 244 247 / 0.45);
}
</style>
