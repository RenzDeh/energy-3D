<script setup lang="ts">
/** Eenvoudige lijn-iconen (24×24), in de huidige tekstkleur. */
defineProps<{ name: keyof typeof ICONS, size?: number }>()
</script>

<script lang="ts">
const ICONS = {
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  temp: '<path d="M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0Z"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 6.5 4.25 4.25 0 0 0 7 15Z"/><path d="m8 19-1 2M12 19l-1 2M16 19l-1 2"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  car: '<path d="M5 16h14v-4l-2-5H7l-2 5v4Z"/><path d="M5 12h14M7 16v2.5M17 16v2.5"/><circle cx="8.5" cy="13.8" r=".6"/><circle cx="15.5" cy="13.8" r=".6"/>',
  wash: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><circle cx="12" cy="13" r="4.5"/><path d="M8 6.5h.01M11 6.5h.01"/>',
  dish: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 8h16M8 5.5h.01M9 14h6"/>',
  dryer: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><circle cx="12" cy="13" r="4.5"/><path d="M10.5 13a1.5 1.5 0 1 1 1.5 1.5"/><path d="M8 6.5h.01"/>',
  boiler: '<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M12 9c-1.5 2-2.2 3.1-2.2 4a2.2 2.2 0 0 0 4.4 0c0-.9-.7-2-2.2-4Z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  home: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  leaf: '<path d="M5 20c0-9 5-15 15-15 0 10-6 15-14 15"/><path d="M5 20c3-4 6-7 9.5-9"/>',
  play: '<path d="M7 4.5v15l12-7.5-12-7.5Z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  arrow: '<path d="M12 20V4M6 10l6-6 6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  turbine: '<path d="M12 11v10M9 21h6"/><circle cx="12" cy="9" r="1.3"/><path d="M12 7.7V2M13.1 9.6l4.9 2.9M10.9 9.6 6 12.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
} as const
</script>

<template>
  <svg
    class="icon"
    :width="size ?? 18"
    :height="size ?? 18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="ICONS[name]"
  />
</template>

<style scoped>
.icon { flex: none; display: block; }
</style>
