import { seededRandom } from './random'
import { CITY, RIVER, riverCoords, terrainHeight } from './terrain'

// Een gewoon, fictief stadje ten westen van de molen: een rivier met een stenen brug,
// een marktplein met stadhuis en kerk, en een kantoorgebouw in een park aan het water.

const perp = { x: -RIVER.dir.z, z: RIVER.dir.x }
/** Hoek (rond Y) zodat lokale +X dwars over de rivier ligt */
export const RIVER_ANGLE = Math.atan2(-perp.z, perp.x)

const at = (x: number, z: number) => ({ x, y: terrainHeight(x, z), z })

/** Stenen boogbrug over de rivier */
export const BRIDGE = {
  ...at(RIVER.origin.x, RIVER.origin.z),
  y: 0,
  angle: RIVER_ANGLE,
  /** Halve lengte van de brug, tot net voorbij de oevers */
  offset: RIVER.width / 2 + 3,
}

export const TOWN_HALL = { ...at(-153, -26), angle: RIVER_ANGLE }
export const CHURCH = { ...at(-161, -48), angle: RIVER_ANGLE }
/** Modern kantoorgebouw in een park aan de rivier (krijgt ook stroom van het park) */
export const OFFICE = { ...at(-104, -14), radius: 11, angle: 0.3 }

/** Plaats van het naambordje van de stad, boven het stadhuis */
export const TOWN_LABEL = { x: TOWN_HALL.x, y: 22, z: TOWN_HALL.z }

export interface House { x: number, y: number, z: number, angle: number, w: number, d: number, h: number, color: number, roof: number }

/** Rijhuizen in straten evenwijdig aan de rivier. */
export function houses(): House[] {
  const rand = seededRandom(1302)
  const list: House[] = []
  const keepClear = [
    { x: TOWN_HALL.x, z: TOWN_HALL.z, r: 11 },
    { x: CHURCH.x, z: CHURCH.z, r: 11 },
    { x: BRIDGE.x, z: BRIDGE.z, r: 9 },
    { x: OFFICE.x, z: OFFICE.z, r: 24 },
  ]
  const dir = RIVER.dir
  for (let street = -6; street <= 6; street++) {
    for (let s = -60; s < 60;) {
      const w = 2.2 + rand() * 1.6
      // Huizen staan met hun gevel naar de straat; er zijn ook af en toe pleintjes en zijstraten
      const x = CITY.x + dir.x * s + perp.x * street * 7
      const z = CITY.z + dir.z * s + perp.z * street * 7
      s += w + (rand() < 0.12 ? 5 : 0.05)
      if (Math.hypot(x - CITY.x, z - CITY.z) > CITY.radius * (0.75 + rand() * 0.25)) continue
      if (Math.abs(riverCoords(x, z).across) < RIVER.width / 2 + 4) continue
      if (keepClear.some(c => Math.hypot(x - c.x, z - c.z) < c.r)) continue
      list.push({
        x,
        y: terrainHeight(x, z),
        z,
        angle: RIVER_ANGLE + Math.PI / 2,
        w,
        d: 4.5 + rand() * 1.5,
        h: 3.2 + rand() * 3.5,
        color: Math.floor(rand() * 5),
        roof: rand() < 0.65 ? 0 : 1,
      })
    }
  }
  return list
}
