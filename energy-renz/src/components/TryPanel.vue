<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_TURBINES, useEnergy } from '../composables/useEnergy'
import { PRESETS, useWindData } from '../composables/useWindData'
import type { Simulation } from '../composables/useWindData'
import { fmt, power } from '../lib/format'
import { msToKmh } from '../lib/turbine'
import Icon from './Icon.vue'

/** "Zelf proberen": de dag afspelen, ander weer kiezen en het windpark aanpassen. */
const { wind, simulation, applyPreset, updateSimulation } = useWindData()
const { kw, hours, position, playing, playbackHours, play, pause, reset, seek, turbineCount, rotorScale } = useEnergy()

const clock = computed(() => wind.value.observedAt ?? '--:--')
const moreWeather = ref(false)

function onSeek(event: Event) {
  pause()
  seek(Number((event.target as HTMLInputElement).value))
}
function set(key: keyof Simulation, event: Event) {
  updateSimulation({ [key]: Number((event.target as HTMLInputElement).value) })
}
const hourLabel = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
const activePreset = computed(() => PRESETS.find(p => simulation.value && p.values.speed10 === simulation.value.speed10)?.label)
</script>

<template>
  <div class="try">
    <!-- De dag afspelen -->
    <section class="block">
      <p class="ui-label">De komende 24 uur</p>
      <div class="player">
        <button type="button" class="play" :aria-label="playing ? 'Pauze' : 'Speel af'" :disabled="!hours" @click="playing ? pause() : play()">
          <Icon :name="playing ? 'pause' : 'play'" :size="20" />
        </button>
        <div class="track">
          <div class="time">
            <b>{{ playbackHours === null ? 'Nu' : clock }}</b>
            <button v-if="playbackHours !== null" type="button" class="link" @click="reset">Terug naar nu</button>
          </div>
          <input
            type="range"
            class="ui-range"
            min="0"
            :max="hours"
            step="0.05"
            :value="position"
            aria-label="Tijdstip"
            @input="onSeek"
          />
        </div>
      </div>
      <p class="help ui-optional">Bekijk hoe wind, zon en stroomprijs veranderen in de loop van de dag.</p>
    </section>

    <!-- Weer kiezen -->
    <section class="block">
      <p class="ui-label">Kies het weer</p>
      <div class="segments">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          :aria-pressed="activePreset === p.label"
          @click="applyPreset(p.values)"
        >
          {{ p.label }}
        </button>
      </div>
      <template v-if="simulation">
        <!-- Twee schuifjes naast elkaar, zodat de kaart zonder scrollen op het scherm past -->
        <div class="grid">
          <label class="field">
            <span>Wind <b>{{ fmt(msToKmh(simulation.speed10)) }} km/u</b></span>
            <input class="ui-range" type="range" min="0" max="30" step="0.5" :value="simulation.speed10" @input="set('speed10', $event)" />
          </label>
          <label class="field">
            <span>Uur <b>{{ hourLabel(simulation.hour) }}</b></span>
            <input class="ui-range" type="range" min="0" max="23.75" step="0.25" :value="simulation.hour" @input="set('hour', $event)" />
          </label>
          <template v-if="moreWeather">
            <label class="field">
              <span>Wolken <b>{{ simulation.cloudCover }}%</b></span>
              <input class="ui-range" type="range" min="0" max="100" step="1" :value="simulation.cloudCover" @input="set('cloudCover', $event)" />
            </label>
            <label class="field">
              <span>Regen <b>{{ fmt(simulation.precipitation, 1) }} mm</b></span>
              <input class="ui-range" type="range" min="0" max="3" step="0.1" :value="simulation.precipitation" @input="set('precipitation', $event)" />
            </label>
            <label class="field">
              <span>Richting <b>{{ simulation.directionDeg }}°</b></span>
              <input class="ui-range" type="range" min="0" max="359" step="1" :value="simulation.directionDeg" @input="set('directionDeg', $event)" />
            </label>
          </template>
        </div>
        <button type="button" class="link" :aria-expanded="moreWeather" @click="moreWeather = !moreWeather">
          {{ moreWeather ? 'Minder opties' : 'Meer opties' }}
        </button>
      </template>
    </section>

    <!-- Windpark -->
    <section class="block">
      <p class="ui-label">Bouw je windpark</p>
      <div class="grid">
        <label class="field">
          <span>Molens <b>{{ turbineCount }}</b></span>
          <input v-model.number="turbineCount" class="ui-range" type="range" min="1" :max="MAX_TURBINES" step="1" />
        </label>
        <label class="field">
          <span>Wieken <b>{{ fmt(rotorScale * 100) }}%</b></span>
          <input v-model.number="rotorScale" class="ui-range" type="range" min="0.7" max="1.3" step="0.05" />
        </label>
      </div>
      <p class="result"><Icon name="bolt" :size="16" /> Het park levert nu <b>{{ power(kw) }}</b></p>
    </section>
  </div>
</template>

<style scoped>
.try {
  display: flex;
  flex-direction: column;
  gap: var(--ui-section-gap);
}
.block {
  display: flex;
  flex-direction: column;
  gap: var(--ui-block-gap);
}
.help {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-muted);
}

.player {
  display: flex;
  align-items: center;
  gap: 12px;
}
.play {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex: none;
  color: #fff;
  background: var(--ui-accent);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 4px 14px rgb(15 157 88 / 0.35);
}
.play:disabled {
  opacity: 0.4;
  cursor: default;
}
.track {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.time {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 15px;
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
  font-size: 14px;
  font-weight: 550;
  color: var(--ui-muted);
  background: none;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
}
.segments button[aria-pressed='true'] {
  color: var(--ui-text);
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ui-block-gap) 18px;
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

.link {
  align-self: flex-start;
  padding: 0;
  font-size: 13px;
  font-weight: 550;
  color: var(--ui-blue);
  background: none;
  border: 0;
  cursor: pointer;
}
.result {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 14px;
  color: var(--ui-muted);
}
.result b {
  color: var(--ui-text);
}
.result .icon {
  color: var(--ui-accent);
}
</style>
