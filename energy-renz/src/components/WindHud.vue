<script setup lang="ts">
import { computed, ref } from 'vue'
import EnergyPanel from './EnergyPanel.vue'
import InfoTip from './InfoTip.vue'
import MarketPanel from './MarketPanel.vue'
import { useEnvironment } from '../composables/useEnvironment'
import { useViewMode } from '../composables/useViewMode'
import { LOCATION, PRESETS, useWindData } from '../composables/useWindData'
import type { WindStatus } from '../composables/useWindData'
import {
  RATED_POWER_KW,
  STATE_LABEL,
  beaufort,
  compassLabel,
  msToKmh,
  powerKw,
  rotorRpm,
  turbineState,
} from '../lib/turbine'

const { wind, status, simulation, startSimulation, stopSimulation, applyPreset } = useWindData()
const { elevationDeg, sun } = useEnvironment()
const { mode } = useViewMode()

const hub = computed(() => wind.value.speed100)
const bft = computed(() => beaufort(wind.value.speed10))
const state = computed(() => turbineState(hub.value))
const rpm = computed(() => rotorRpm(hub.value))
const power = computed(() => powerKw(hub.value))
const powerPct = computed(() => Math.round((power.value / RATED_POWER_KW) * 100))

// De pijl wijst naar waar de wind naartoe waait
const arrowRotation = computed(() => `rotate(${wind.value.directionDeg + 180}deg)`)

const statusText: Record<WindStatus, string> = {
  loading: 'Laden…',
  live: 'Live',
  stale: 'Verbinding weg · laatste meting',
  offline: 'Geen data · schatting',
  sim: 'Simulatie',
  replay: 'Dag afspelen',
}

const fmt = (v: number, digits = 1) => v.toLocaleString('nl-BE', { minimumFractionDigits: digits, maximumFractionDigits: digits })

// Zonnestand: azimut van SunCalc (vanaf zuid) omzetten naar kompasgraden (vanaf noord)
const sunText = computed(() => {
  const azimuth = ((sun.value.azimuth * 180) / Math.PI + 180 + 360) % 360
  const elevation = Math.round(elevationDeg.value)
  return elevation < 0 ? `onder (${elevation}°)` : `${elevation}° · ${compassLabel(azimuth)}`
})

const weatherText = computed(() => {
  const { cloudCover, precipitation } = wind.value
  const sky = cloudCover < 20 ? 'Helder' : cloudCover < 60 ? 'Half bewolkt' : cloudCover < 90 ? 'Bewolkt' : 'Betrokken'
  return precipitation > 0 ? `${sky} · regen ${fmt(precipitation)} mm` : `${sky} · ${Math.round(cloudCover)}%`
})

function updateSim(key: 'speed10' | 'directionDeg' | 'cloudCover' | 'precipitation' | 'hour', event: Event) {
  if (!simulation.value) return
  simulation.value = { ...simulation.value, [key]: Number((event.target as HTMLInputElement).value) }
}

const hourLabel = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`

const tab = ref<'energy' | 'market' | 'weather'>('energy')

const COMPASS_FULL: Record<string, string> = {
  N: 'noorden', NO: 'noordoosten', O: 'oosten', ZO: 'zuidoosten', Z: 'zuiden', ZW: 'zuidwesten', W: 'westen', NW: 'noordwesten',
}

/** De situatie in één zin, zodat iedereen meteen snapt wat er gebeurt */
const headline = computed(() => {
  const from = COMPASS_FULL[compassLabel(wind.value.directionDeg)]
  const blowing = wind.value.speed10 < 0.3 ? 'Het is windstil.' : `Het waait ${bft.value.name.toLowerCase()} uit het ${from}.`
  const turbine = {
    idle: 'Te weinig wind: de molens staan stil.',
    running: `De molen draait op ${powerPct.value}% van zijn maximale kracht.`,
    rated: 'Genoeg wind: de molen draait op volle kracht.',
    storm: 'Te veel wind: de molens zijn uit veiligheid stilgezet.',
  }[state.value]
  return `${blowing} ${turbine}`
})

const INFO = {
  speed: 'Windsnelheid op 10 meter hoogte, zoals in het weerbericht. 1 m/s = 3,6 km/u. Windmolens beginnen te draaien vanaf ongeveer 3 m/s.',
  beaufort: 'Beaufort is de windschaal uit het weerbericht: van 0 (windstil) tot 12 (orkaan).',
  direction: 'Waar de wind vandaan komt. De molen draait zijn neus automatisch naar de wind toe.',
  gusts: 'Rukwinden zijn korte, harde windstoten. Ze bepalen hoe zwaar de molen belast wordt.',
  hub: 'Hoger waait het harder. De wieken draaien rond 100 meter hoogte, dus díe wind bepaalt hoeveel stroom de molen maakt.',
  sun: 'Stand van de zon voor Kortrijk: hoe hoog ze boven de horizon staat en in welke richting. Bepaalt licht en schaduw in de scène.',
  state: 'Onder 3 m/s staat de molen stil (te weinig wind). Vanaf 12 m/s levert hij zijn maximum. Boven 25 m/s wordt hij uit veiligheid stilgezet (stormstop).',
  rpm: 'Toeren per minuut van de wieken. Grote molens draaien traag (6 à 15 keer per minuut), maar de wiektippen halen toch meer dan 250 km/u.',
  power: 'Vermogen: hoeveel stroom deze ene molen op dit moment levert. 1 MW (megawatt) = 1000 kW (kilowatt).',
  rated: 'Het maximum van deze molen is 3 MW (nominaal vermogen). Hij haalt dat vanaf ongeveer 12 m/s wind op ashoogte.',
}
</script>

<template>
  <aside class="hud main" aria-label="Live winddata">
    <header>
      <div>
        <h1>{{ LOCATION.name }}</h1>
        <p class="sub">Wind op 10 m</p>
      </div>
      <span class="status" :data-status="status"><i />{{ statusText[status] }}</span>
    </header>

    <div class="mode" role="radiogroup" aria-label="Weergave">
      <button type="button" role="radio" :aria-checked="mode === 'simple'" @click="mode = 'simple'">Eenvoudig</button>
      <button type="button" role="radio" :aria-checked="mode === 'expert'" @click="mode = 'expert'">Expert</button>
    </div>

    <p class="headline">{{ headline }}</p>

    <div class="hero">
      <div class="speed">
        <strong>{{ fmt(wind.speed10) }}</strong>
        <span>m/s</span>
        <InfoTip :text="INFO.speed" align="left" />
        <small>
          {{ fmt(msToKmh(wind.speed10), 0) }} km/u · Bft {{ bft.force }} · {{ bft.name }}
          <InfoTip v-if="mode === 'expert'" :text="INFO.beaufort" align="left" />
        </small>
      </div>
      <div class="compass" :aria-label="`Wind uit ${compassLabel(wind.directionDeg)}`">
        <span class="n">N</span>
        <svg viewBox="-50 -50 100 100" :style="{ transform: arrowRotation }">
          <path d="M0 -34 L11 14 L0 6 L-11 14 Z" />
        </svg>
        <small>uit {{ compassLabel(wind.directionDeg) }}<template v-if="mode === 'expert'"> · {{ Math.round(wind.directionDeg) }}°</template> <InfoTip :text="INFO.direction" align="right" /></small>
      </div>
    </div>

    <dl>
      <template v-if="mode === 'expert'">
        <div><dt>Rukwinden <InfoTip :text="INFO.gusts" align="left" /></dt><dd>{{ fmt(wind.gusts) }} m/s</dd></div>
        <div><dt>Wind op 100 m <InfoTip :text="INFO.hub" align="right" /></dt><dd>{{ fmt(hub) }} m/s</dd></div>
      </template>
      <div><dt>Temperatuur</dt><dd>{{ fmt(wind.temperature) }} °C</dd></div>
      <div><dt>Hemel</dt><dd>{{ weatherText }}</dd></div>
      <div v-if="mode === 'expert'"><dt>Zon <InfoTip :text="INFO.sun" align="left" /></dt><dd>{{ sunText }}</dd></div>
    </dl>

    <section class="turbine">
      <div class="row">
        <span>{{ mode === 'expert' ? 'Turbine' : 'De molen' }} <InfoTip :text="INFO.state" align="left" /></span>
        <span class="state" :data-state="state">{{ STATE_LABEL[state] }}</span>
      </div>
      <div class="row big">
        <span v-if="mode === 'expert'">{{ fmt(rpm, 1) }} <small>rpm</small> <InfoTip :text="INFO.rpm" align="left" /></span>
        <span v-else>{{ powerPct }}%</span>
        <span>{{ fmt(power, 0) }} <small>kW</small> <InfoTip :text="INFO.power" align="right" /></span>
      </div>
      <div class="bar" role="meter" :aria-valuenow="powerPct" aria-valuemin="0" aria-valuemax="100" aria-label="Vermogen">
        <div :style="{ width: powerPct + '%' }" />
      </div>
      <p class="hint">
        <template v-if="mode === 'expert'">{{ powerPct }}% van {{ RATED_POWER_KW / 1000 }} MW nominaal</template>
        <template v-else>van zijn maximum ({{ RATED_POWER_KW / 1000 }} MW)</template>
        <InfoTip :text="INFO.rated" align="left" />
      </p>
    </section>

    <footer>
      <span v-if="wind.observedAt">Gemeten om {{ wind.observedAt }}</span>
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weerdata: Open-Meteo.com (CC BY 4.0)</a>
      <span v-if="mode === 'expert'">Zonnestand: SunCalc-algoritme</span>
    </footer>
  </aside>

  <aside class="hud side" aria-label="Energie en simulatie">
    <div class="tabs" role="tablist">
      <button type="button" role="tab" :aria-selected="tab === 'energy'" @click="tab = 'energy'">Energie</button>
      <button type="button" role="tab" :aria-selected="tab === 'market'" @click="tab = 'market'">Markt</button>
      <button type="button" role="tab" :aria-selected="tab === 'weather'" @click="tab = 'weather'">Weer</button>
    </div>

    <EnergyPanel v-if="tab === 'energy'" />
    <MarketPanel v-else-if="tab === 'market'" />

    <section v-else class="sim">
      <button v-if="!simulation" type="button" class="toggle" @click="startSimulation">Simuleer ander weer</button>
      <template v-else>
        <div class="row">
          <span>Simulatie</span>
          <button type="button" class="link" @click="stopSimulation">Terug naar live</button>
        </div>
        <div class="presets">
          <button v-for="p in PRESETS" :key="p.label" type="button" @click="applyPreset(p.values)">{{ p.label }}</button>
        </div>
        <div class="sliders">
        <label>
          <span>Wind <b>{{ fmt(simulation.speed10) }} m/s</b></span>
          <input type="range" min="0" max="30" step="0.5" :value="simulation.speed10" @input="updateSim('speed10', $event)">
        </label>
        <label>
          <span>Richting <b>{{ compassLabel(simulation.directionDeg) }} · {{ simulation.directionDeg }}°</b></span>
          <input type="range" min="0" max="359" step="1" :value="simulation.directionDeg" @input="updateSim('directionDeg', $event)">
        </label>
        <label>
          <span>Bewolking <b>{{ simulation.cloudCover }}%</b></span>
          <input type="range" min="0" max="100" step="1" :value="simulation.cloudCover" @input="updateSim('cloudCover', $event)">
        </label>
        <label>
          <span>Regen <b>{{ fmt(simulation.precipitation) }} mm</b></span>
          <input type="range" min="0" max="3" step="0.1" :value="simulation.precipitation" @input="updateSim('precipitation', $event)">
        </label>
        <label>
          <span>Uur <b>{{ hourLabel(simulation.hour) }}</b></span>
          <input type="range" min="0" max="23.75" step="0.25" :value="simulation.hour" @input="updateSim('hour', $event)">
        </label>
        </div>
      </template>
    </section>
  </aside>
</template>

<style scoped>
.hud {
  position: fixed;
  z-index: 100;
  box-sizing: border-box;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #eef4f7;
  background: rgb(14 24 33 / 0.62);
  border: 1px solid rgb(255 255 255 / 0.14);
  border-radius: 16px;
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  box-shadow: 0 10px 40px rgb(0 0 0 / 0.25);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.01em;
}
.sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: rgb(238 244 247 / 0.6);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px 3px 8px;
  font-size: 11px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.08);
  white-space: nowrap;
}
.status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8a97a0;
}
.status[data-status='live'] i {
  background: #4ade80;
  box-shadow: 0 0 0 0 rgb(74 222 128 / 0.6);
  animation: pulse 2s infinite;
}
.status[data-status='loading'] i,
.status[data-status='sim'] i,
.status[data-status='replay'] i {
  background: #fbbf24;
}
.status[data-status='stale'] i,
.status[data-status='offline'] i {
  background: #f87171;
}
@keyframes pulse {
  70% { box-shadow: 0 0 0 7px rgb(74 222 128 / 0); }
  100% { box-shadow: 0 0 0 0 rgb(74 222 128 / 0); }
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.speed strong {
  font-size: 52px;
  font-weight: 650;
  line-height: 1;
  letter-spacing: -0.03em;
}
.speed span {
  margin-left: 4px;
  font-size: 16px;
  color: rgb(238 244 247 / 0.7);
}
.speed small {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: rgb(238 244 247 / 0.65);
}

.compass {
  position: relative;
  flex: none;
  width: 84px;
  height: 84px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 0.18);
  background: radial-gradient(circle, rgb(255 255 255 / 0.08), transparent 70%);
}
.compass .n {
  position: absolute;
  top: 3px;
  font-size: 10px;
  font-weight: 600;
  color: rgb(238 244 247 / 0.6);
}
.compass svg {
  width: 52px;
  height: 52px;
  fill: #7dd3fc;
  transition: transform 0.8s cubic-bezier(0.3, 0.8, 0.3, 1);
}
.compass small {
  position: absolute;
  bottom: -18px;
  font-size: 11px;
  white-space: nowrap;
  color: rgb(238 244 247 / 0.7);
}

/* Live data rechtsboven, verwachting en simulatie linksonder: samen passen ze zonder scrollen */
.hud.main {
  top: 16px;
  right: 16px;
  width: 312px;
}
.hud.side {
  bottom: 16px;
  left: 16px;
  width: 330px;
}
.hud.side .sim { padding-top: 0; border-top: 0; }

dl {
  margin: 6px 0 0;
  padding: 8px 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 14px;
  border-top: 1px solid rgb(255 255 255 / 0.1);
  border-bottom: 1px solid rgb(255 255 255 / 0.1);
}
dl div {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 12px;
}
dt { color: rgb(238 244 247 / 0.65); }
dd { margin: 0; font-weight: 550; }

.turbine { display: flex; flex-direction: column; gap: 8px; }
.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  color: rgb(238 244 247 / 0.65);
}
.row.big {
  font-size: 24px;
  font-weight: 650;
  color: #eef4f7;
}
.row.big small {
  font-size: 12px;
  font-weight: 500;
  color: rgb(238 244 247 / 0.6);
}
.state {
  font-size: 12px;
  font-weight: 550;
  color: #4ade80;
}
.state[data-state='idle'] { color: #94a3b8; }
.state[data-state='storm'] { color: #f87171; }
.bar {
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: rgb(255 255 255 / 0.12);
}
.bar div {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #38bdf8, #4ade80);
  transition: width 0.8s ease;
}
.hint {
  margin: 0;
  font-size: 11px;
  color: rgb(238 244 247 / 0.5);
}

.mode {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: rgb(255 255 255 / 0.06);
}
.mode button {
  flex: 1;
  padding: 3px 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 550;
  color: rgb(238 244 247 / 0.6);
  border: 0;
  border-radius: 6px;
  background: none;
  cursor: pointer;
}
.mode button[aria-checked='true'] {
  color: #0e1821;
  background: #7dd3fc;
}
.headline {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: #eef4f7;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: rgb(255 255 255 / 0.06);
}
.tabs button {
  flex: 1;
  padding: 5px 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 550;
  color: rgb(238 244 247 / 0.65);
  border: 0;
  border-radius: 7px;
  background: none;
  cursor: pointer;
}
.tabs button[aria-selected="true"] {
  color: #eef4f7;
  background: rgb(255 255 255 / 0.14);
}

.sim {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgb(255 255 255 / 0.1);
}
.sim button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.sim .toggle {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 550;
  border: 1px solid rgb(255 255 255 / 0.18);
  border-radius: 10px;
  background: rgb(255 255 255 / 0.06);
}
.sim .toggle:hover { background: rgb(255 255 255 / 0.12); }
.sim .link {
  padding: 0;
  font-size: 12px;
  border: 0;
  background: none;
  color: #7dd3fc;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.presets { display: flex; gap: 6px; }
.sliders {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 14px;
}
.presets button {
  flex: 1;
  padding: 5px 0;
  font-size: 12px;
  border: 1px solid rgb(255 255 255 / 0.15);
  border-radius: 8px;
  background: rgb(255 255 255 / 0.05);
}
.presets button:hover { background: rgb(255 255 255 / 0.12); }
.sim label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: rgb(238 244 247 / 0.65);
}
.sim label span { display: flex; justify-content: space-between; }
.sim label b { font-weight: 550; color: #eef4f7; }
.sim input[type='range'] {
  width: 100%;
  margin: 2px 0;
  accent-color: #38bdf8;
}
button:focus-visible,
input:focus-visible,
a:focus-visible {
  outline: 2px solid #7dd3fc;
  outline-offset: 2px;
}

footer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: rgb(238 244 247 / 0.5);
}
footer a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}
footer a:hover { color: #eef4f7; }

@media (max-width: 640px) {
  .hud { padding: 12px; gap: 8px; }
  .hud.main {
    top: auto;
    right: 8px;
    left: 8px;
    bottom: 8px;
    width: auto;
  }
  .hud.side {
    top: 8px;
    right: 8px;
    left: 8px;
    bottom: auto;
    width: auto;
  }
  footer, .hint { display: none; }
  .speed strong { font-size: 40px; }
  .compass { width: 70px; height: 70px; }
  .compass svg { width: 42px; height: 42px; }
  dl { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .status[data-status='live'] i { animation: none; }
  .compass svg, .bar div { transition: none; }
}
</style>
