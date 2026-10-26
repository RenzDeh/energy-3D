import { BufferAttribute, BufferGeometry, Color } from 'three'

const STATIONS = 24
const POINTS_PER_SIDE = 14
const TIP_COLOR = new Color('#d8362f')
const BLADE_COLOR = new Color('#f2f4f5')

/** Dikte van een symmetrisch NACA 00xx-profiel op positie x (0..1 over de koorde). */
function nacaThickness(x: number, tc: number): number {
  return 5 * tc * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4)
}

/**
 * Rotorblad langs +Y, koorde langs X, dikte langs Z.
 * Dik en breed bij de wortel, taps en slank naar de tip, met twist en een rode tipmarkering.
 */
export function createBladeGeometry(length: number, rootChord = 1.5): BufferGeometry {
  const ring = POINTS_PER_SIDE * 2
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  for (let s = 0; s < STATIONS; s++) {
    const t = s / (STATIONS - 1)
    // Cosinus-verdeling zodat de tip fijner wordt opgedeeld
    const y = length * (0.07 + 0.93 * t)
    const chord = rootChord * (t < 0.12 ? 0.75 + (t / 0.12) * 0.25 : Math.max(0.16, (1 - t) ** 0.85 * 0.95 + 0.1 * (1 - t)))
    const thicknessRatio = 0.34 - 0.22 * Math.min(1, t * 1.4) // cilindrisch bij de wortel, slank aan de tip
    const twist = (1 - t) ** 1.6 * 0.55
    const cos = Math.cos(twist)
    const sin = Math.sin(twist)
    const color = t > 0.94 ? TIP_COLOR : BLADE_COLOR

    for (let i = 0; i < ring; i++) {
      // 0..N-1 bovenzijde van voorrand naar achterrand, daarna onderzijde terug
      const upper = i < POINTS_PER_SIDE
      const k = upper ? i : ring - i
      const u = k / POINTS_PER_SIDE
      const x = (1 - Math.cos(u * Math.PI)) / 2
      const half = nacaThickness(x, thicknessRatio) * chord
      // Draaipunt op een kwart van de koorde, zo staat het blad mooi om de naaf
      const px = (x - 0.25) * chord
      const pz = upper ? half : -half
      positions.push(px * cos - pz * sin, y, px * sin + pz * cos)
      colors.push(color.r, color.g, color.b)
    }
  }

  for (let s = 0; s < STATIONS - 1; s++) {
    for (let i = 0; i < ring; i++) {
      const a = s * ring + i
      const b = s * ring + ((i + 1) % ring)
      const c = a + ring
      const d = b + ring
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
