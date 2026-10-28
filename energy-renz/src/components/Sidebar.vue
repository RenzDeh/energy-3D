<script setup lang="ts">
import { ref } from 'vue'
import { useEnergy } from '../composables/useEnergy'
import { useWindData } from '../composables/useWindData'
import NowPanel from './NowPanel.vue'
import TryPanel from './TryPanel.vue'
import UsagePlanner from './UsagePlanner.vue'

/** Eén kaart aan de rechterkant met drie tabbladen. */
const { simulation, stopSimulation, wind } = useWindData()
const { playbackHours, reset } = useEnergy()

const TABS = [
  { id: 'now', label: 'Nu' },
  { id: 'plan', label: 'Slim plannen' },
  { id: 'try', label: 'Zelf proberen' },
] as const
const tab = ref<(typeof TABS)[number]['id']>('now')

function backToLive() {
  stopSimulation()
  reset()
}
</script>

<template>
  <aside class="sidebar ui-card" aria-label="Informatie">
    <nav class="tabs" role="tablist">
      <button
        v-for="t in TABS"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </nav>

    <div v-if="simulation || playbackHours !== null" class="banner">
      <span>{{ simulation ? 'Je bekijkt zelfgekozen weer' : `Je bekijkt ${wind.observedAt ?? 'later'}` }}</span>
      <button type="button" @click="backToLive">Terug naar live</button>
    </div>

    <div class="content">
      <NowPanel v-if="tab === 'now'" @plan="tab = 'plan'" />
      <UsagePlanner v-else-if="tab === 'plan'" />
      <TryPanel v-else />
    </div>

    <footer>
      Bronnen: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> ·
      <a href="https://energy-charts.info/" target="_blank" rel="noreferrer">Energy-Charts</a>
    </footer>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  z-index: 100;
  top: 16px;
  right: 16px;
  width: 380px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tabs {
  display: flex;
  margin: 16px 16px 0;
  padding: 4px;
  gap: 4px;
  background: var(--ui-surface-soft);
  border-radius: 14px;
}
.tabs button {
  flex: 1;
  padding: 9px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-muted);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.tabs button:hover { color: var(--ui-text); }
.tabs button[aria-selected='true'] {
  color: var(--ui-text);
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
}
.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 12px 16px 0;
  padding: 10px 12px;
  font-size: 13px;
  color: #7a5400;
  background: var(--ui-mid-soft);
  border-radius: 12px;
}
.banner button {
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: var(--ui-text);
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 20px 16px;
}
footer {
  padding: 10px 20px 14px;
  font-size: 11px;
  color: var(--ui-muted);
  border-top: 1px solid var(--ui-line);
}
footer a { color: inherit; }

/* Op een gsm wordt de kaart een paneel onderaan */
@media (max-width: 720px) {
  .sidebar {
    top: auto;
    left: 8px;
    right: 8px;
    bottom: 8px;
    width: auto;
    max-height: 58vh;
  }
  .tabs { margin: 10px 10px 0; }
  .content { padding: 16px; }
}
</style>
