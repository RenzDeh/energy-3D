import { ref, watch } from 'vue'

export type ViewMode = 'simple' | 'expert'

const KEY = 'energy-3d:view-mode'

function readStored(): ViewMode {
  try {
    return localStorage.getItem(KEY) === 'expert' ? 'expert' : 'simple'
  }
  catch {
    return 'simple'
  }
}

/** Eenvoudig = enkel de kern in gewone taal, expert = alle cijfers. Wordt per browser onthouden. */
const mode = ref<ViewMode>(readStored())
watch(mode, (m) => {
  try {
    localStorage.setItem(KEY, m)
  }
  catch {}
})

export function useViewMode() {
  return { mode }
}
