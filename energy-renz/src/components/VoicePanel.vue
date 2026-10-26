<script setup lang="ts">
import { ref } from 'vue'
import { EXAMPLES, useVoice, voiceSupported } from '../composables/useVoice'

const { listening, interim, last, error, listen, handle } = useVoice()
// Zonder werkende spraak staan de knoppen meteen open als terugval
const showCommands = ref(!voiceSupported)

function run(command: string) {
  handle([command])
  showCommands.value = false
}
</script>

<template>
  <aside class="voice" aria-label="Spraakbesturing">
    <div class="top">
      <button
        type="button"
        class="mic"
        :class="{ on: listening }"
        :aria-pressed="listening"
        :title="voiceSupported ? 'Spreek een commando in' : 'Spraak niet ondersteund in deze browser'"
        @click="listen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" />
        </svg>
      </button>
      <div class="text" aria-live="polite">
        <template v-if="listening">
          <b>Ik luister…</b>
          <span>{{ interim || 'Zeg bv. “meer wind” of “hoeveel energie produceren we?”' }}</span>
        </template>
        <template v-else-if="error">
          <b class="bad">{{ error }}</b>
        </template>
        <template v-else-if="last">
          <span>Verstaan: “{{ last.heard }}”</span>
          <b :class="{ bad: !last.ok }">→ {{ last.result }}</b>
        </template>
        <template v-else>
          <b>Spraakbesturing</b>
          <span>{{ voiceSupported ? 'Klik op de microfoon en spreek een commando in.' : 'Niet ondersteund in deze browser: gebruik de knoppen.' }}</span>
        </template>
      </div>
    </div>
    <button type="button" class="more" :aria-expanded="showCommands" @click="showCommands = !showCommands">
      {{ showCommands ? 'Verberg de commando’s' : 'Alle commando’s als knoppen' }}
    </button>
    <div v-if="showCommands" class="chips">
      <button v-for="e in EXAMPLES" :key="e" type="button" @click="run(e)">{{ e }}</button>
    </div>
  </aside>
</template>

<style scoped>
.voice {
  position: fixed;
  /* Boven de andere panelen, zodat de opengeklapte commando's erover vallen */
  z-index: 110;
  top: 16px;
  left: 16px;
  width: 330px;
  box-sizing: border-box;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #eef4f7;
  background: rgb(14 24 33 / 0.62);
  border: 1px solid rgb(255 255 255 / 0.14);
  border-radius: 16px;
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  box-shadow: 0 10px 40px rgb(0 0 0 / 0.25);
  user-select: none;
}
.top { display: flex; align-items: center; gap: 10px; }
.mic {
  flex: none;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 0.2);
  border-radius: 50%;
  background: rgb(255 255 255 / 0.08);
  cursor: pointer;
}
.mic svg { width: 20px; height: 20px; fill: #eef4f7; }
.mic:hover { background: rgb(255 255 255 / 0.16); }
.mic.on {
  border-color: #f87171;
  background: #ef4444;
  animation: ring 1.4s infinite;
}
@keyframes ring {
  0% { box-shadow: 0 0 0 0 rgb(239 68 68 / 0.55); }
  100% { box-shadow: 0 0 0 12px rgb(239 68 68 / 0); }
}
.text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  line-height: 1.35;
}
.text span { color: rgb(238 244 247 / 0.65); }
.text b { font-weight: 600; color: #4ade80; }
.text b.bad { color: #fca5a5; }
.more {
  align-self: flex-start;
  padding: 0;
  font: inherit;
  font-size: 11.5px;
  color: #7dd3fc;
  border: 0;
  background: none;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.chips button {
  padding: 3px 8px;
  font: inherit;
  font-size: 11px;
  color: #eef4f7;
  border: 1px solid rgb(255 255 255 / 0.15);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.06);
  cursor: pointer;
}
.chips button:hover { background: rgb(255 255 255 / 0.14); }
button:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 2px; }

@media (max-width: 640px) {
  .voice { top: 8px; left: 8px; right: 8px; width: auto; }
  .chips { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .mic.on { animation: none; }
}
</style>
