<script setup lang="ts">
import { computed } from 'vue'
import { useEnvironment } from '../composables/useEnvironment'
import { LOCATION, useWindData } from '../composables/useWindData'
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

const { wind, status, simulation, startSimulation, stopSimulation } = useWindData()
const { elevationDeg, sun } = useEnvironment()

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

// Verwachting komende 24 uur als sparkline (wind op ashoogte bepaalt het vermogen)
const CHART_W = 264
const CHART_H = 54
const chart = computed(() => {
  const points = wind.value.forecast
  if (points.length < 2) return null
  const max = Math.max(8, ...points.map(p => p.speed100)) * 1.1
  const x = (i: number) => (i / (points.length - 1)) * CHART_W
  const y = (v: number) => CHART_H - (v / max) * CHART_H
  const line = (key: 'speed10' | 'speed100') => points.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')
  const peak = points.reduce((a, b) => (b.speed100 > a.speed100 ? b : a))
  return {
    hub: line('speed100'),
    ground: line('speed10'),
    area: `0,${CHART_H} ${line('speed100')} ${CHART_W},${CHART_H}`,
    ratedY: y(12),
    peak,
    end: points.at(-1)!.time,
    mid: points[Math.floor(points.length / 2)].time,
  }
})

function updateSim(key: 'speed10' | 'directionDeg' | 'cloudCover' | 'precipitation' | 'hour', event: Event) {
  if (!simulation.value) return
  simulation.value = { ...simulation.value, [key]: Number((event.target as HTMLInputElement).value) }
}

const hourLabel = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`

const presets = [
  { label: 'Windstil', values: { speed10: 1.5, precipitation: 0, cloudCover: 10 } },
  { label: 'Fris', values: { speed10: 7, precipitation: 0, cloudCover: 35 } },
  { label: 'Storm', values: { speed10: 21, precipitation: 1.6, cloudCover: 100 } },
]
function applyPreset(values: (typeof presets)[number]['values']) {
  if (simulation.value) simulation.value = { ...simulation.value, ...values }
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

    <div class="hero">
      <div class="speed">
        <strong>{{ fmt(wind.speed10) }}</strong>
        <span>m/s</span>
        <small>{{ fmt(msToKmh(wind.speed10), 0) }} km/u · Bft {{ bft.force }} · {{ bft.name }}</small>
      </div>
      <div class="compass" :aria-label="`Wind uit ${compassLabel(wind.directionDeg)}`">
        <span class="n">N</span>
        <svg viewBox="-50 -50 100 100" :style="{ transform: arrowRotation }">
          <path d="M0 -34 L11 14 L0 6 L-11 14 Z" />
        </svg>
        <small>{{ compassLabel(wind.directionDeg) }} · {{ Math.round(wind.directionDeg) }}°</small>
      </div>
    </div>

    <dl>
      <div><dt>Rukwinden</dt><dd>{{ fmt(wind.gusts) }} m/s</dd></div>
      <div><dt>Wind op 100 m</dt><dd>{{ fmt(hub) }} m/s</dd></div>
      <div><dt>Temperatuur</dt><dd>{{ fmt(wind.temperature) }} °C</dd></div>
      <div><dt>Hemel</dt><dd>{{ weatherText }}</dd></div>
      <div><dt>Zon</dt><dd>{{ sunText }}</dd></div>
    </dl>

    <section class="turbine">
      <div class="row">
        <span>Turbine</span>
        <span class="state" :data-state="state">{{ STATE_LABEL[state] }}</span>
      </div>
      <div class="row big">
        <span>{{ fmt(rpm, 1) }} <small>rpm</small></span>
        <span>{{ fmt(power, 0) }} <small>kW</small></span>
      </div>
      <div class="bar" role="meter" :aria-valuenow="powerPct" aria-valuemin="0" aria-valuemax="100" aria-label="Vermogen">
        <div :style="{ width: powerPct + '%' }" />
      </div>
      <p class="hint">{{ powerPct }}% van {{ RATED_POWER_KW / 1000 }} MW nominaal</p>
    </section>

    <footer>
      <span v-if="wind.observedAt">Gemeten om {{ wind.observedAt }}</span>
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weerdata: Open-Meteo.com (CC BY 4.0)</a>
      <span>Zonnestand: SunCalc-algoritme</span>
    </footer>
  </aside>

  <aside class="hud side" aria-label="Verwachting en simulatie">

    <section v-if="chart" class="forecast">
      <div class="row">
        <span>Komende 24 uur</span>
        <span class="legend"><i class="hub" />100 m <i class="ground" />10 m</span>
      </div>
      <svg :viewBox="`0 -4 ${CHART_W} ${CHART_H + 8}`" preserveAspectRatio="none" role="img" :aria-label="`Windverwachting, piek ${fmt(chart.peak.speed100)} m/s om ${chart.peak.time}`">
        <defs>
          <linearGradient id="fc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#38bdf8" stop-opacity="0.35" />
            <stop offset="1" stop-color="#38bdf8" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line class="rated" x1="0" :x2="CHART_W" :y1="chart.ratedY" :y2="chart.ratedY" />
        <polygon :points="chart.area" fill="url(#fc-fill)" />
        <polyline class="ground" :points="chart.ground" />
        <polyline class="hub" :points="chart.hub" />
      </svg>
      <div class="axis"><span>nu</span><span>{{ chart.mid }}</span><span>{{ chart.end }}</span></div>
      <p class="hint">Piek {{ fmt(chart.peak.speed100) }} m/s om {{ chart.peak.time }} · stippellijn = vol vermogen</p>
    </section>

    <section class="sim">
      <button v-if="!simulation" type="button" class="toggle" @click="startSimulation">Simuleer ander weer</button>
      <template v-else>
        <div class="row">
          <span>Simulatie</span>
          <button type="button" class="link" @click="stopSimulation">Terug naar live</button>
        </div>
        <div class="presets">
          <button v-for="p in presets" :key="p.label" type="button" @click="applyPreset(p.values)">{{ p.label }}</button>
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
.status[data-status='sim'] i {
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
.hud.side .sim:first-child { padding-top: 0; border-top: 0; }

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

.forecast { display: flex; flex-direction: column; gap: 6px; }
.forecast svg {
  width: 100%;
  height: 62px;
  overflow: visible;
}
.forecast polyline {
  fill: none;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.forecast polyline.hub { stroke: #38bdf8; stroke-width: 2; }
.forecast polyline.ground { stroke: rgb(238 244 247 / 0.45); stroke-width: 1.5; }
.forecast .rated {
  stroke: #4ade80;
  stroke-width: 1;
  stroke-dasharray: 3 4;
  opacity: 0.6;
  vector-effect: non-scaling-stroke;
}
.legend {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
}
.legend i {
  width: 10px;
  height: 2px;
  border-radius: 1px;
  background: #38bdf8;
}
.legend i.ground { margin-left: 6px; background: rgb(238 244 247 / 0.45); }
.axis {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: rgb(238 244 247 / 0.5);
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
  .forecast, footer, .hint { display: none; }
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
