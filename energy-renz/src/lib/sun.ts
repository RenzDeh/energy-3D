// Zonnestand volgens het algoritme van SunCalc (Vladimir Agafonkin, BSD-licentie)
// https://github.com/mourner/suncalc
const RAD = Math.PI / 180
const DAY_MS = 86400000
const J1970 = 2440588
const J2000 = 2451545
const OBLIQUITY = RAD * 23.4397

const toDays = (date: Date) => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000

export interface SunPosition {
  /** Hoogte boven de horizon in radialen */
  altitude: number
  /** Azimut in radialen, gemeten vanaf het zuiden, positief naar het westen */
  azimuth: number
}

export function sunPosition(date: Date, latitude: number, longitude: number): SunPosition {
  const lw = RAD * -longitude
  const phi = RAD * latitude
  const d = toDays(date)

  const M = RAD * (357.5291 + 0.98560028 * d)
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const L = M + C + RAD * 102.9372 + Math.PI

  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(L))
  const ra = Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L))
  const H = RAD * (280.16 + 360.9856235 * d) - lw - ra

  return {
    altitude: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)),
    azimuth: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)),
  }
}

/** Richting naar de zon als eenheidsvector in de scène (noorden = -Z, oosten = +X). */
export function sunDirection({ altitude, azimuth }: SunPosition): [number, number, number] {
  const flat = Math.cos(altitude)
  return [-Math.sin(azimuth) * flat, Math.sin(altitude), Math.cos(azimuth) * flat]
}
