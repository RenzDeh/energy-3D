import { seededRandom } from './random'
import { PENTA } from './kortrijk'
import { CITY, RIVER, riverCoords, terrainHeight } from './terrain'

/** De andere molens van het windpark, verder in het landschap. */
export const PARK_TURBINES = [
  { x: -78, z: -58, scale: 0.95, phase: 0.6 },
  { x: -24, z: -104, scale: 1, phase: 2.1 },
  { x: 58, z: -88, scale: 0.9, phase: 4.0 },
  { x: 104, z: -28, scale: 1, phase: 1.3 },
  { x: 72, z: 96, scale: 0.85, phase: 3.2 },
].map(t => ({ ...t, y: terrainHeight(t.x, t.z) }))

export interface TreeSpot { x: number, y: number, z: number, scale: number, rotation: number, hue: number }

/** Bomenrijen en bosjes, zoals houtkanten tussen Vlaamse akkers. */
export function treeSpots(): TreeSpot[] {
  const rand = seededRandom(42)
  const spots: TreeSpot[] = []
  const free = (x: number, z: number, park: boolean) =>
    Math.hypot(x, z) > 34 && PARK_TURBINES.every(t => Math.hypot(x - t.x, z - t.z) > 9)
    && Math.abs(riverCoords(x, z).across) > RIVER.width / 2 + 3
    && (park || Math.hypot(x - CITY.x, z - CITY.z) > CITY.radius * 0.9)
    && Math.hypot(x - PENTA.x, z - PENTA.z) > PENTA.radius + 4

  const add = (x: number, z: number, park = false) => {
    if (!free(x, z, park)) return
    spots.push({ x, y: terrainHeight(x, z), z, scale: 2.2 + rand() * 1.8, rotation: rand() * Math.PI * 2, hue: rand() })
  }

  // Houtkanten: rechte rijen bomen
  for (let row = 0; row < 7; row++) {
    const angle = rand() * Math.PI
    const cx = (rand() - 0.5) * 220
    const cz = (rand() - 0.5) * 220
    const length = 30 + rand() * 50
    for (let s = -length / 2; s < length / 2; s += 3.5 + rand() * 2) {
      add(cx + Math.cos(angle) * s + (rand() - 0.5), cz + Math.sin(angle) * s + (rand() - 0.5))
    }
  }
  // Park rond The Penta op Kortrijk Weide
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2 + rand() * 0.2
    const r = PENTA.radius + 7 + rand() * 9
    add(PENTA.x + Math.cos(a) * r, PENTA.z + Math.sin(a) * r, true)
  }
  // Bosjes
  for (let c = 0; c < 9; c++) {
    const a = rand() * Math.PI * 2
    const r = 45 + rand() * 90
    const cx = Math.cos(a) * r
    const cz = Math.sin(a) * r
    const n = 4 + Math.floor(rand() * 8)
    for (let k = 0; k < n; k++) add(cx + (rand() - 0.5) * 12, cz + (rand() - 0.5) * 12)
  }
  return spots
}
