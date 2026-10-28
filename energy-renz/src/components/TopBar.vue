<script setup lang="ts">
import { computed } from 'vue'
import { useWindData } from '../composables/useWindData'
import CitySearch from './CitySearch.vue'
import VoicePanel from './VoicePanel.vue'

/** Bovenbalk: gekozen stad, of de gegevens live zijn, en de spraakknop. */
const { status } = useWindData()

const statusText = computed(() => ({
  loading: 'Laden…',
  live: 'Live',
  stale: 'Even geen verbinding',
  offline: 'Geen gegevens',
  sim: 'Zelf gekozen',
  replay: 'Afspelen',
}[status.value]))
</script>

<template>
  <header class="topbar ui-card">
    <CitySearch />
    <span class="status" :data-status="status"><i />{{ statusText }}</span>
    <span class="divider" />
    <VoicePanel />
  </header>
</template>

<style scoped>
.topbar {
  position: fixed;
  z-index: 110;
  top: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 18px;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-muted);
  background: var(--ui-surface-soft);
  border-radius: 999px;
  white-space: nowrap;
}
.status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9aa5a1;
}
.status[data-status='live'] { color: var(--ui-accent); background: var(--ui-accent-soft); }
.status[data-status='live'] i { background: var(--ui-accent); animation: pulse 2s infinite; }
.status[data-status='sim'] i,
.status[data-status='replay'] i,
.status[data-status='loading'] i { background: var(--ui-mid); }
.status[data-status='stale'] i,
.status[data-status='offline'] i { background: var(--ui-bad); }
@keyframes pulse {
  70% { box-shadow: 0 0 0 6px rgb(15 157 88 / 0); }
  0% { box-shadow: 0 0 0 0 rgb(15 157 88 / 0.5); }
}
.divider { width: 1px; height: 26px; margin: 0 2px; background: var(--ui-line); }

@media (max-width: 720px) {
  .topbar { top: 8px; left: 8px; right: 8px; }
  .status { margin-left: auto; }
  .divider { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .status i { animation: none !important; }
}
</style>
