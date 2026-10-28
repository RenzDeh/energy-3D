<script setup lang="ts">
import { ref } from 'vue'
import NowPanel from './NowPanel.vue'
import TryPanel from './TryPanel.vue'
import UsagePlanner from './UsagePlanner.vue'

/** Eén kaart aan de rechterkant met drie tabbladen; "terug naar live" staat in de bovenbalk. */
const TABS = [
  { id: 'now', label: 'Nu' },
  { id: 'plan', label: 'Slim plannen' },
  { id: 'try', label: 'Zelf proberen' },
] as const
const tab = ref<(typeof TABS)[number]['id']>('now')
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
  margin: 14px 14px 0;
  padding: 4px;
  gap: 4px;
  background: var(--ui-surface-soft);
  border-radius: 14px;
}
.tabs button {
  flex: 1;
  padding: 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-muted);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
}
.tabs button:hover {
  color: var(--ui-text);
}
.tabs button[aria-selected='true'] {
  color: var(--ui-text);
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
}
/* Op desktop past alles zonder scrollen; enkel op zeer lage schermen mag het als noodoplossing scrollen */
.content {
  flex: 1;
  overflow: visible;
  padding: var(--ui-pad) 20px;
}
@media (max-height: 600px) {
  .content {
    overflow-y: auto;
  }
}
footer {
  padding: 8px 20px 10px;
  font-size: 11px;
  color: var(--ui-muted);
  border-top: 1px solid var(--ui-line);
}
footer a {
  color: inherit;
}

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
  .tabs {
    margin: 10px 10px 0;
  }
  .content {
    padding: 16px;
    overflow-y: auto;
  }
}
</style>
