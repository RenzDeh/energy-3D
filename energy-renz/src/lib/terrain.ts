const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

// De rivier: een zacht kronkelende lijn door het centrum van het stadje, ten westen van de molen
export const RIVER = {
  /** Punt op de rivier, aan de brug */
  origin: { x: -128, z: -40 },
  /** Looprichting (eenheidsvector) */
  dir: { x: 0.34, z: -0.94 },
  width: 9,
}

/** Afstand tot de middellijn van de rivier, en de positie langs de rivier. */
export function riverCoords(x: number, z: number): { across: number, along: number } {
  const dx = x - RIVER.origin.x
  const dz = z - RIVER.origin.z
  const along = dx * RIVER.dir.x + dz * RIVER.dir.z
  // Loodrecht op de looprichting, met een lichte meander
  const across = dx * -RIVER.dir.z + dz * RIVER.dir.x - Math.sin(along * 0.018) * 10
  return { across, along }
}

/** Vlak rond de stad, zodat huizen en torens niet op een helling staan */
export const CITY = { x: -135, z: -35, radius: 48 }

/** Hoogte van het terrein: vlak rond de windmolen en de stad, zacht glooiend verderop, met een bedding voor de rivier. */
export function terrainHeight(x: number, z: number): number {
  const hills
    = Math.sin(x * 0.06) * Math.cos(z * 0.05) * 1.6
      + Math.sin(x * 0.13 + 1.3) * Math.sin(z * 0.11 + 0.4) * 0.6
  const flat = smoothstep(6, 24, Math.hypot(x, z)) * smoothstep(CITY.radius * 0.7, CITY.radius * 1.3, Math.hypot(x - CITY.x, z - CITY.z))
  const { across } = riverCoords(x, z)
  const bed = 1 - smoothstep(RIVER.width * 0.5, RIVER.width * 0.5 + 4, Math.abs(across))
  return hills * flat - bed * 1.6
}

/** Waterniveau van de rivier (iets onder het maaiveld) */
export const WATER_LEVEL = -0.7
