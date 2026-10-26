<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

/** Klein ⓘ-knopje dat bij een klik uitlegt wat een cijfer betekent. */
withDefaults(defineProps<{ text: string, align?: 'center' | 'left' | 'right' }>(), { align: 'center' })

const open = ref(false)
const root = ref<HTMLElement>()

function onDocument(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) close()
}
function close() {
  open.value = false
  document.removeEventListener('pointerdown', onDocument)
}
function toggle() {
  if (open.value) return close()
  open.value = true
  document.addEventListener('pointerdown', onDocument)
}
onBeforeUnmount(close)
</script>

<template>
  <span ref="root" class="info">
    <button type="button" :aria-expanded="open" aria-label="Uitleg" @click.stop="toggle" @keydown.esc="close">i</button>
    <span v-if="open" class="bubble" :class="align" role="tooltip">{{ text }}</span>
  </span>
</template>

<style scoped>
.info {
  position: relative;
  display: inline-flex;
  vertical-align: middle;
  margin-left: 4px;
}
button {
  width: 15px;
  height: 15px;
  padding: 0;
  display: grid;
  place-items: center;
  font: italic 600 10px/1 Georgia, serif;
  color: rgb(238 244 247 / 0.8);
  border: 1px solid rgb(238 244 247 / 0.35);
  border-radius: 50%;
  background: none;
  cursor: pointer;
}
button:hover,
button[aria-expanded='true'] {
  color: #0e1821;
  background: #7dd3fc;
  border-color: #7dd3fc;
}
button:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 2px; }
.bubble {
  position: absolute;
  z-index: 20;
  top: 20px;
  left: 50%;
  width: 230px;
  transform: translateX(-50%);
  padding: 8px 10px;
  font: 400 12px/1.45 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-style: normal;
  text-align: left;
  letter-spacing: 0;
  white-space: normal;
  color: #0e1821;
  background: #eef7fb;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
}
.bubble.left { left: -8px; transform: none; }
.bubble.right { left: auto; right: -8px; transform: none; }
</style>
