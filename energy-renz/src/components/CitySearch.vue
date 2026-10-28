<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { searchPlaces, useLocation } from '../composables/useLocation'
import type { Place } from '../composables/useLocation'
import Icon from './Icon.vue'

/** Stadsnaam als knop; een klik opent een zoekveld om een andere stad te kiezen. */
const { place, setPlace } = useLocation()

const open = ref(false)
const query = ref('')
const results = ref<Place[]>([])
const active = ref(0)
const busy = ref(false)
const message = ref<string | null>(null)
const root = ref<HTMLElement>()
const input = ref<HTMLInputElement>()

let controller: AbortController | undefined
let debounce: ReturnType<typeof setTimeout> | undefined

watch(query, (q) => {
  clearTimeout(debounce)
  controller?.abort()
  message.value = null
  if (q.trim().length < 2) {
    results.value = []
    busy.value = false
    return
  }
  busy.value = true
  debounce = setTimeout(async () => {
    controller = new AbortController()
    try {
      results.value = await searchPlaces(q, controller.signal)
      active.value = 0
      if (!results.value.length) { message.value = 'Geen stad gevonden' }
    }
    catch (e) {
      if ((e as Error).name === 'AbortError') { return }
      results.value = []
      message.value = 'Zoeken lukt nu niet'
    }
    busy.value = false
  }, 250)
})

function onDocument(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) { close() }
}

async function show() {
  open.value = true
  query.value = ''
  results.value = []
  document.addEventListener('pointerdown', onDocument)
  await nextTick()
  input.value?.focus()
}

function close() {
  open.value = false
  controller?.abort()
  clearTimeout(debounce)
  document.removeEventListener('pointerdown', onDocument)
}

function choose(p: Place) {
  setPlace(p)
  close()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  }
  else if (e.key === 'ArrowDown') {
    active.value = Math.min(active.value + 1, results.value.length - 1)
  }
  else if (e.key === 'ArrowUp') {
    active.value = Math.max(active.value - 1, 0)
  }
  else if (e.key === 'Enter' && results.value[active.value]) {
    choose(results.value[active.value])
  }
  else { return }
  e.preventDefault()
}

const detail = (p: Place) => [p.region, p.country].filter(Boolean).join(', ')

onBeforeUnmount(close)
</script>

<template>
  <div ref="root" class="city">
    <button v-if="!open" type="button" class="current" title="Andere stad kiezen" @click="show">
      <Icon name="pin" :size="20" />
      <span class="name">
        <h1>{{ place.name }}</h1>
        <small>{{ place.country }}</small>
      </span>
      <Icon name="search" :size="16" class="hint" />
    </button>
    <div v-else class="search">
      <Icon name="search" :size="18" />
      <input
        ref="input"
        v-model="query"
        type="search"
        placeholder="Zoek je stad of gemeente…"
        aria-label="Zoek een stad"
        role="combobox"
        :aria-expanded="results.length > 0"
        aria-controls="city-results"
        autocomplete="off"
        @keydown="onKey"
      />
    </div>
    <ul v-if="open && (results.length || message || busy)" id="city-results" class="ui-card" role="listbox">
      <li v-if="busy && !results.length" class="note">Zoeken…</li>
      <li v-else-if="message" class="note">{{ message }}</li>
      <li
        v-for="(r, i) in results"
        :key="`${r.latitude},${r.longitude}`"
        role="option"
        :aria-selected="i === active"
        @pointerenter="active = i"
        @click="choose(r)"
      >
        <b>{{ r.name }}</b>
        <small>{{ detail(r) }}</small>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.city {
  position: relative;
  min-width: 0;
}
.current {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  padding: 6px 12px 6px 8px;
  color: var(--ui-text);
  text-align: left;
  background: none;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
}
.current:hover {
  background: var(--ui-surface-soft);
}
.current > .icon:first-child {
  color: var(--ui-accent);
}
.name {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
h1 {
  margin: 0;
  overflow: hidden;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.name small {
  font-size: 12px;
  color: var(--ui-muted);
}
.hint {
  color: var(--ui-muted);
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 260px;
  padding: 0 12px;
  color: var(--ui-muted);
  background: var(--ui-surface-soft);
  border-radius: 12px;
}
.search input {
  flex: 1;
  min-width: 0;
  padding: 11px 0;
  font-size: 15px;
  color: var(--ui-text);
  background: none;
  border: 0;
  outline: none;
}
ul {
  position: absolute;
  z-index: 10;
  top: calc(100% + 10px);
  left: 0;
  width: 300px;
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: 16px;
  background: #fff;
}
li {
  display: flex;
  flex-direction: column;
  padding: 9px 12px;
  border-radius: 10px;
  cursor: pointer;
}
li[aria-selected='true'] {
  background: var(--ui-surface-soft);
}
li b {
  font-size: 14px;
  font-weight: 600;
}
li small {
  font-size: 12px;
  color: var(--ui-muted);
}
li.note {
  cursor: default;
  font-size: 13px;
  color: var(--ui-muted);
}

@media (max-width: 720px) {
  .search {
    width: 100%;
    box-sizing: border-box;
  }
  ul {
    width: calc(100vw - 16px - 16px);
  }
}
</style>
