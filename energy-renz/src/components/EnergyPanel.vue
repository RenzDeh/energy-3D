<script setup lang="ts">
import { computed } from 'vue'
import { KORTRIJK_HOUSEHOLDS, MAX_TURBINES, useEnergy } from '../composables/useEnergy'
import { useViewMode } from '../composables/useViewMode'
import { useWindData } from '../composables/useWindData'
import InfoTip from './InfoTip.vue'

const {
  kw,
  ratedKw,
  households,
  cityShare,
  curve,
  hours,
  position,
  energyKwh,
  dayKwh,
  simDayKwh,
  turbineCount,
  rotorScale,
  playbackRate,
  playing,
  playbackHours,
  play,
  pause,
  reset,
  seek,
} = useEnergy()
const { simulation, wind } = useWindData()
const { mode } = useViewMode()

const headline = computed(() => {
  if (kw.value <= 0) return 'De molens staan stil: het park levert nu geen stroom.'
  const homes = cityShare.value >= 1
    ? `meer dan alle ${fmt(KORTRIJK_HOUSEHOLDS)} gezinnen van Kortrijk`
    : `${fmt(households.value)} gezinnen, ${fmt(cityShare.value * 100)}% van Kortrijk`
  return `Het windpark levert nu ${power(kw.value)}: genoeg stroom voor ${homes}.`
})

const INFO = {
  power: 'Wat alle molens van het park samen nu leveren. 1 MW (megawatt) = 1000 kW. Het maximum is 3 MW per molen.',
  homes: 'Een Vlaams gezin verbruikt gemiddeld 3500 kWh per jaar, dus gemiddeld 0,4 kW. Vermogen gedeeld door 0,4 kW = aantal gezinnen dat je van stroom voorziet.',
  chart: 'Verwachte productie voor de komende 24 uur, berekend uit de windverwachting van Open-Meteo. De stippellijn bovenaan is het maximum van het park.',
  energy: 'MWh (megawattuur) is een hoeveelheid energie: 1 MW een uur lang. 1 MWh is ongeveer het dagverbruik van 100 gezinnen.',
  play: 'Speelt de verwachting van de komende 24 uur versneld af: wind, zon, wolken en stroomproductie bewegen mee in de scène.',
  turbines: 'Hoeveel molens er in het park staan. Elke molen levert maximaal 3 MW.',
  rotor: 'Langere wieken vangen meer wind. Het vermogen stijgt met de oppervlakte van de rotor: 10% langere wieken geven ongeveer 21% meer stroom.',
  model: 'Model: onder 3 m/s geen stroom; tussen 3 en 12 m/s stijgt het vermogen met de derde macht van de windsnelheid (2× zoveel wind = 8× zoveel vermogen); vanaf 12 m/s het maximum; boven 25 m/s stormstop.',
}

const fmt = (v: number, digits = 0) => v.toLocaleString('nl-BE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
/** kW of MW, afhankelijk van de grootte */
const power = (v: number) => (v >= 1000 ? `${fmt(v / 1000, 1)} MW` : `${fmt(v)} kW`)
const energy = (v: number) => (v >= 1000 ? `${fmt(v / 1000, 1)} MWh` : `${fmt(v)} kWh`)

const W = 280
const H = 64
const chart = computed(() => {
  const c = curve.value
  if (c.length < 2) return null
  const max = Math.max(ratedKw.value, 1)
  const x = (i: number) => (i / (c.length - 1)) * W
  const y = (v: number) => H - (v / max) * H
  const line = c.map((p, i) => `${x(i).toFixed(1)},${y(p.kw).toFixed(1)}`).join(' ')
  // Gevulde oppervlakte tot de huidige afspeelpositie = opgewekte energie
  const until = position.value
  const filled = c.filter((_, i) => i <= until).map((p, i) => `${x(i).toFixed(1)},${y(p.kw).toFixed(1)}`)
  const i = Math.min(Math.floor(until), c.length - 2)
  const t = until - i
  const cursorKw = c[i].kw + (c[i + 1].kw - c[i].kw) * t
  const cursorX = (until / (c.length - 1)) * W
  filled.push(`${cursorX.toFixed(1)},${y(cursorKw).toFixed(1)}`)
  return {
    line,
    area: `0,${H} ${filled.join(' ')} ${cursorX.toFixed(1)},${H}`,
    cursorX,
    cursorY: y(cursorKw),
    start: c[0].time,
    mid: c[Math.floor(c.length / 2)].time,
    end: c.at(-1)!.time,
  }
})

const clock = computed(() => wind.value.observedAt ?? '--:--')
const rates = [
  { label: '1 dag/min', value: 0.4 },
  { label: '1 dag/20 s', value: 1.2 },
  { label: '1 dag/8 s', value: 3 },
]

function onSeek(event: Event) {
  pause()
  seek(Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <section class="energy" aria-label="Energieproductie windpark">
    <p class="headline">{{ headline }}</p>
    <div class="live">
      <div>
        <strong>{{ power(kw) }} <InfoTip :text="INFO.power" align="left" /></strong>
        <small>{{ turbineCount }} {{ turbineCount === 1 ? 'molen' : 'molens' }} · max {{ power(ratedKw) }}</small>
      </div>
      <div class="homes">
        <strong>{{ fmt(households) }} <InfoTip :text="INFO.homes" align="right" /></strong>
        <small>gezinnen · {{ fmt(cityShare * 100) }}% van Kortrijk</small>
      </div>
    </div>

    <div v-if="chart" class="chart">
      <p class="label">Stroomproductie komende 24 uur <InfoTip :text="INFO.chart" align="left" /></p>
      <svg :viewBox="`0 -4 ${W} ${H + 8}`" preserveAspectRatio="none" role="img" :aria-label="`Vermogen komende 24 uur, verwacht ${energy(dayKwh)}`">
        <defs>
          <linearGradient id="en-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#4ade80" stop-opacity="0.55" />
            <stop offset="1" stop-color="#4ade80" stop-opacity="0.05" />
          </linearGradient>
        </defs>
        <line class="rated" x1="0" :x2="W" y1="0" y2="0" />
        <polygon :points="chart.area" fill="url(#en-fill)" />
        <polyline class="power" :points="chart.line" />
        <line v-if="playbackHours !== null" class="cursor" :x1="chart.cursorX" :x2="chart.cursorX" y1="-4" :y2="H" />
        <circle v-if="playbackHours !== null" class="dot" :cx="chart.cursorX" :cy="chart.cursorY" r="3" />
      </svg>
      <div class="axis"><span>{{ chart.start }}</span><span>{{ chart.mid }}</span><span>{{ chart.end }}</span></div>
    </div>

    <p class="total">
      <template v-if="simulation">Simulatie: constant {{ power(kw) }} ≈ <b>{{ energy(simDayKwh) }}</b> per dag</template>
      <template v-else-if="playbackHours !== null">{{ clock }} · opgewekt: <b>{{ energy(energyKwh) }}</b> van {{ energy(dayKwh) }}</template>
      <template v-else>Verwacht komende 24 uur: <b>{{ energy(dayKwh) }}</b></template>
      <InfoTip :text="INFO.energy" align="left" />
    </p>

    <div class="controls">
      <button type="button" class="play" :aria-pressed="playing" :disabled="!hours" @click="playing ? pause() : play()">
        {{ playing ? '❚❚ Pauze' : '▶ Speel de dag af' }}
      </button>
      <InfoTip :text="INFO.play" />
      <button v-if="playbackHours !== null" type="button" class="link" @click="reset">Nu</button>
      <select v-if="mode === 'expert'" v-model.number="playbackRate" aria-label="Afspeelsnelheid">
        <option v-for="r in rates" :key="r.value" :value="r.value">{{ r.label }}</option>
      </select>
    </div>
    <input
      type="range"
      class="timeline"
      min="0"
      :max="hours"
      step="0.05"
      :value="position"
      aria-label="Tijdstip in de verwachting"
      @input="onSeek"
    >

    <div class="sliders">
      <label>
        <span><span>Molens <InfoTip :text="INFO.turbines" align="left" /></span><b>{{ turbineCount }}</b></span>
        <input v-model.number="turbineCount" type="range" min="1" :max="MAX_TURBINES" step="1">
      </label>
      <label>
        <span><span>Wieklengte <InfoTip :text="INFO.rotor" align="right" /></span><b>{{ fmt(rotorScale * 100) }}%</b></span>
        <input v-model.number="rotorScale" type="range" min="0.7" max="1.3" step="0.05">
      </label>
    </div>
    <p v-if="mode === 'expert'" class="hint">
      Vermogen ≈ v³ tussen 3 en 12 m/s, daarna 3 MW per molen, stormstop boven 25 m/s. 1 gezin ≈ 3500 kWh/jaar; Kortrijk ≈ {{ fmt(KORTRIJK_HOUSEHOLDS) }} gezinnen.
      <InfoTip :text="INFO.model" align="right" />
    </p>
  </section>
</template>

<style scoped>
.energy { display: flex; flex-direction: column; gap: 8px; }
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
.live {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
}
.live strong {
  display: block;
  font-size: 26px;
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #4ade80;
}
.live .homes { text-align: right; }
.live .homes strong { color: #fcd34d; }
.live small {
  font-size: 11px;
  color: rgb(238 244 247 / 0.6);
}
.chart svg {
  width: 100%;
  height: 64px;
  overflow: visible;
}
.power {
  fill: none;
  stroke: #4ade80;
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.rated {
  stroke: rgb(238 244 247 / 0.35);
  stroke-dasharray: 3 4;
  vector-effect: non-scaling-stroke;
}
.cursor {
  stroke: #fcd34d;
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}
.dot { fill: #fcd34d; }
.axis {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: rgb(238 244 247 / 0.5);
}
.total {
  margin: 0;
  font-size: 12px;
  color: rgb(238 244 247 / 0.7);
}
.total b { color: #eef4f7; font-weight: 600; }
.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.controls button,
.controls select {
  font: inherit;
  font-size: 12px;
  color: inherit;
  cursor: pointer;
}
.play {
  flex: 1;
  padding: 6px 10px;
  font-weight: 600;
  border: 1px solid rgb(74 222 128 / 0.5);
  border-radius: 8px;
  background: rgb(74 222 128 / 0.15);
}
.play:hover { background: rgb(74 222 128 / 0.25); }
.play:disabled { opacity: 0.5; cursor: default; }
.link {
  padding: 0;
  border: 0;
  background: none;
  color: #7dd3fc;
  text-decoration: underline;
  text-underline-offset: 2px;
}
select {
  padding: 5px 6px;
  border: 1px solid rgb(255 255 255 / 0.15);
  border-radius: 8px;
  background: rgb(14 24 33 / 0.8);
}
.timeline { width: 100%; margin: 0; accent-color: #fcd34d; }
.sliders {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 14px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: rgb(238 244 247 / 0.65);
}
label span { display: flex; justify-content: space-between; }
label b { font-weight: 550; color: #eef4f7; }
label input { width: 100%; margin: 2px 0; accent-color: #38bdf8; }
.hint {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.4;
  color: rgb(238 244 247 / 0.45);
}
button:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 2px solid #7dd3fc;
  outline-offset: 2px;
}
</style>
