<script setup lang="ts">
import { ref } from 'vue'
import { EXAMPLES, useVoice, voiceSupported } from '../composables/useVoice'
import Icon from './Icon.vue'

/** Microfoonknop voor in de bovenbalk; antwoorden en voorbeeldvragen verschijnen eronder. */
const { listening, interim, last, error, listen, handle } = useVoice()
const showExamples = ref(false)

function run(command: string) {
  handle([command])
  showExamples.value = false
}
function onMic() {
  if (voiceSupported) {
    listen()
  }
  else { showExamples.value = !showExamples.value }
}
</script>

<template>
  <div class="voice">
    <button
      type="button"
      class="mic"
      :class="{ on: listening }"
      :aria-pressed="listening"
      :title="voiceSupported ? 'Stel een vraag met je stem' : 'Voorbeeldvragen'"
      @click="onMic"
    >
      <Icon name="mic" :size="20" />
    </button>
    <button type="button" class="ask" :aria-expanded="showExamples" @click="showExamples = !showExamples">
      Vraag iets
    </button>

    <div v-if="listening || error || last || showExamples" class="popover ui-card" aria-live="polite">
      <template v-if="listening">
        <b>Ik luister…</b>
        <span>{{ interim || 'Bijvoorbeeld: “Wanneer is stroom goedkoop?”' }}</span>
      </template>
      <template v-else-if="showExamples">
        <b>Probeer bijvoorbeeld</b>
        <div class="chips">
          <button v-for="e in EXAMPLES" :key="e" type="button" @click="run(e)">{{ e }}</button>
        </div>
      </template>
      <template v-else-if="error">
        <b class="bad">{{ error }}</b>
      </template>
      <template v-else-if="last">
        <span>“{{ last.heard }}”</span>
        <b :class="{ bad: !last.ok }">{{ last.result }}</b>
        <button type="button" class="close" aria-label="Sluiten" @click="last = null">
          <Icon name="close" :size="16" />
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.voice {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}
.mic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: var(--ui-text);
  background: var(--ui-surface-soft);
  border: 0;
  border-radius: 12px;
  cursor: pointer;
}
.mic:hover {
  filter: brightness(0.96);
}
.mic.on {
  color: #fff;
  background: var(--ui-bad);
  animation: ring 1.4s infinite;
}
@keyframes ring {
  0% {
    box-shadow: 0 0 0 0 rgb(220 74 61 / 0.5);
  }
  100% {
    box-shadow: 0 0 0 10px rgb(220 74 61 / 0);
  }
}
.ask {
  padding: 8px 10px;
  font-size: 14px;
  font-weight: 550;
  color: var(--ui-text);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}
.ask:hover {
  background: var(--ui-surface-soft);
}
.popover {
  position: absolute;
  z-index: 10;
  top: calc(100% + 14px);
  right: -8px;
  width: 300px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  line-height: 1.4;
  background: #fff;
  border-radius: 16px;
}
.popover span {
  color: var(--ui-muted);
}
.popover b {
  font-weight: 600;
}
.popover b.bad {
  color: var(--ui-bad);
}
.close {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 2px;
  color: var(--ui-muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.chips button {
  padding: 6px 10px;
  font-size: 13px;
  color: var(--ui-text);
  background: var(--ui-surface-soft);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}
.chips button:hover {
  background: var(--ui-accent-soft);
}

@media (max-width: 720px) {
  .ask {
    display: none;
  }
  .popover {
    width: calc(100vw - 32px);
    right: -8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .mic.on {
    animation: none;
  }
}
</style>
