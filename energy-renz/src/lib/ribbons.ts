import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, NormalBlending, ShaderMaterial } from 'three'
import type { Blending, Vector3 } from 'three'

const vertexShader = /* glsl */ `
  attribute float aT;
  attribute float aSide;
  attribute float aAlpha;
  uniform float uFogNear;
  uniform float uFogFar;
  varying float vT;
  varying float vSide;
  varying float vAlpha;
  void main() {
    vT = aT;
    vSide = aSide;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vAlpha = aAlpha * (1.0 - smoothstep(uFogNear, uFogFar, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vT;
  varying float vSide;
  varying float vAlpha;
  void main() {
    // Zachte randen over de breedte, vervagende staart en een zachte kop
    float edge = 1.0 - vSide * vSide;
    float tail = pow(1.0 - vT, 1.6);
    float head = smoothstep(0.0, 0.08, vT);
    float a = edge * tail * head * vAlpha * uOpacity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export interface RibbonOptions {
  color?: string
  opacity?: number
  fogNear?: number
  fogFar?: number
  blending?: Blending
}

/**
 * Een bundel linten die altijd naar de camera gedraaid staan.
 * Elk lint is een reeks punten (kop op index 0); breedte en zichtbaarheid zijn per lint instelbaar.
 */
export class Ribbons {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>
  /** Punten per lint, (lint * n + j) * 3 */
  readonly points: Float32Array
  /** Zichtbaarheid per lint, 0..1 */
  readonly alpha: Float32Array
  /** Breedte per lint */
  readonly width: Float32Array

  private readonly positions: Float32Array
  private readonly alphaAttr: Float32Array

  constructor(readonly count: number, readonly n: number, options: RibbonOptions = {}) {
    this.points = new Float32Array(count * n * 3)
    this.alpha = new Float32Array(count)
    this.width = new Float32Array(count).fill(0.2)

    const verts = count * n * 2
    this.positions = new Float32Array(verts * 3)
    this.alphaAttr = new Float32Array(verts)
    const t = new Float32Array(verts)
    const side = new Float32Array(verts)
    const indices: number[] = []
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < n; j++) {
        const v = (i * n + j) * 2
        t[v] = t[v + 1] = j / (n - 1)
        side[v] = -1
        side[v + 1] = 1
        if (j < n - 1) indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
      }
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    geometry.setAttribute('aAlpha', new BufferAttribute(this.alphaAttr, 1))
    geometry.setAttribute('aT', new BufferAttribute(t, 1))
    geometry.setAttribute('aSide', new BufferAttribute(side, 1))
    geometry.setIndex(indices)

    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: options.blending ?? NormalBlending,
      uniforms: {
        uColor: { value: new Color(options.color ?? '#ffffff') },
        uOpacity: { value: options.opacity ?? 0.5 },
        uFogNear: { value: options.fogNear ?? 70 },
        uFogFar: { value: options.fogFar ?? 200 },
      },
    })

    this.mesh = new Mesh(geometry, material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
  }

  get uniforms() {
    return this.mesh.material.uniforms
  }

  /** Alle punten van een lint op één plek zetten (bv. bij het opnieuw laten starten). */
  reset(i: number, x: number, y: number, z: number) {
    const base = i * this.n * 3
    for (let j = 0; j < this.n; j++) {
      this.points[base + j * 3] = x
      this.points[base + j * 3 + 1] = y
      this.points[base + j * 3 + 2] = z
    }
  }

  /** Vertices herberekenen; `cam` is de camerapositie in de lokale ruimte van het mesh. */
  update(cam: Vector3) {
    const { points: P, positions: out, n } = this
    for (let i = 0; i < this.count; i++) {
      const a = this.alpha[i]
      const base = i * n
      for (let j = 0; j < n; j++) this.alphaAttr[(base + j) * 2] = this.alphaAttr[(base + j) * 2 + 1] = a
      if (a <= 0) continue

      const halfWidth = this.width[i] * 0.5
      for (let j = 0; j < n; j++) {
        const p = (base + j) * 3
        const prev = (base + Math.max(j - 1, 0)) * 3
        const next = (base + Math.min(j + 1, n - 1)) * 3
        const tx = P[prev] - P[next]
        const ty = P[prev + 1] - P[next + 1]
        const tz = P[prev + 2] - P[next + 2]
        const cx = cam.x - P[p]
        const cy = cam.y - P[p + 1]
        const cz = cam.z - P[p + 2]
        // Zijvector loodrecht op de looprichting en de kijkrichting
        let sx = ty * cz - tz * cy
        let sy = tz * cx - tx * cz
        let sz = tx * cy - ty * cx
        const len = Math.hypot(sx, sy, sz)
        const w = halfWidth * (0.45 + 0.55 * (1 - j / (n - 1)))
        if (len > 1e-6) {
          sx *= w / len
          sy *= w / len
          sz *= w / len
        }
        else {
          sx = 0
          sy = w
          sz = 0
        }
        const o = (base + j) * 6
        out[o] = P[p] - sx
        out[o + 1] = P[p + 1] - sy
        out[o + 2] = P[p + 2] - sz
        out[o + 3] = P[p] + sx
        out[o + 4] = P[p + 1] + sy
        out[o + 5] = P[p + 2] + sz
      }
    }
    const geometry = this.mesh.geometry
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aAlpha.needsUpdate = true
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
