/** Getallen in Belgische notatie, bv. 1.234,5 */
export const fmt = (v: number, digits = 0) => v.toLocaleString('nl-BE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
export const euro = (v: number) => `€ ${fmt(v, 2)}`
/** kW of MW, afhankelijk van de grootte */
export const power = (kw: number) => (kw >= 1000 ? `${fmt(kw / 1000, 1)} MW` : `${fmt(kw)} kW`)
export const energy = (kwh: number) => (kwh >= 1000 ? `${fmt(kwh / 1000, 1)} MWh` : `${fmt(kwh)} kWh`)
/** €/MWh omzetten naar cent per kWh, wat mensen op hun factuur zien */
export const centsPerKwh = (eurPerMwh: number) => eurPerMwh / 10

/** Prijsniveau (0 = goedkoopst, 1 = duurst) in gewone woorden, met de bijhorende kleurtoon */
export function priceTone(level: number): { word: string, tone: 'good' | 'mid' | 'bad' } {
  if (level < 0.33) return { word: 'goedkoop', tone: 'good' }
  if (level > 0.66) return { word: 'duur', tone: 'bad' }
  return { word: 'gemiddeld', tone: 'mid' }
}
