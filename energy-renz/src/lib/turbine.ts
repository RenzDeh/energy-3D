// Referentieturbine van 3 MW (typisch voor een onshore windmolen in Vlaanderen)
export const CUT_IN = 3 // m/s, vanaf hier begint de rotor te draaien
export const RATED_SPEED = 12 // m/s, vanaf hier levert de turbine vol vermogen
export const CUT_OUT = 25 // m/s, stormstop: de bladen gaan in vaanstand
export const RATED_POWER_KW = 3000
export const MIN_RPM = 6
export const MAX_RPM = 15

export type TurbineState = 'idle' | 'running' | 'rated' | 'storm'

export function turbineState(v: number): TurbineState {
  if (v < CUT_IN) return 'idle'
  if (v > CUT_OUT) return 'storm'
  if (v >= RATED_SPEED) return 'rated'
  return 'running'
}

export const STATE_LABEL: Record<TurbineState, string> = {
  idle: 'Stilstand · te weinig wind',
  running: 'In bedrijf',
  rated: 'Vol vermogen',
  storm: 'Stormstop · vaanstand',
}

/** Geschat vermogen in kW: kubisch tussen cut-in en nominaal, daarna vlak. */
export function powerKw(v: number): number {
  const state = turbineState(v)
  if (state === 'idle' || state === 'storm') return 0
  if (state === 'rated') return RATED_POWER_KW
  const t = (v ** 3 - CUT_IN ** 3) / (RATED_SPEED ** 3 - CUT_IN ** 3)
  return RATED_POWER_KW * t
}

/** Rotortoerental: lineair van MIN_RPM bij cut-in tot MAX_RPM bij nominale wind. */
export function rotorRpm(v: number): number {
  const state = turbineState(v)
  if (state === 'idle' || state === 'storm') return 0
  if (state === 'rated') return MAX_RPM
  return MIN_RPM + ((v - CUT_IN) / (RATED_SPEED - CUT_IN)) * (MAX_RPM - MIN_RPM)
}

const BEAUFORT_LIMITS = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7]
const BEAUFORT_NAMES = [
  'Windstil',
  'Zwak',
  'Zwak',
  'Matig',
  'Matig',
  'Vrij krachtig',
  'Krachtig',
  'Hard',
  'Stormachtig',
  'Storm',
  'Zware storm',
  'Zeer zware storm',
  'Orkaan',
]

export function beaufort(v: number): { force: number, name: string } {
  let force = BEAUFORT_LIMITS.findIndex(limit => v < limit)
  if (force === -1) force = 12
  return { force, name: BEAUFORT_NAMES[force] }
}

const COMPASS = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW']

export function compassLabel(deg: number): string {
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

/**
 * Meteorologische windrichting (graden, waar de wind vandaan komt, met de klok mee vanaf noord)
 * omzetten naar een eenheidsvector in de scène, in de richting waarin de wind waait.
 * Noorden = -Z, oosten = +X.
 */
export function windVector(deg: number): { x: number, z: number } {
  const rad = (deg * Math.PI) / 180
  return { x: -Math.sin(rad), z: Math.cos(rad) }
}

export const msToKmh = (v: number) => v * 3.6
