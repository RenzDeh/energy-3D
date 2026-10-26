import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  LatheGeometry,
  MeshStandardMaterial,
  SphereGeometry,
  Vector2,
} from 'three'
import { createBladeGeometry } from './bladeGeometry'

// Afmetingen van de windmolen in scène-eenheden (ongeveer 1 = 4 m)
export const TOWER_HEIGHT = 24
export const BLADE_LENGTH = 12
/** Hoogte van het rotormiddelpunt boven de voet van de toren */
export const HUB_HEIGHT = TOWER_HEIGHT + 0.5 + 1.05
/** Afstand van de torenas tot het rotorvlak */
export const HUB_Z = 2.6

// Mastprofiel (straal per hoogte), taps naar boven
const TOWER_PROFILE: [number, number][] = [
  [1.08, 0],
  [1.02, 3],
  [0.93, 9],
  [0.83, 15],
  [0.72, 20.5],
  [0.62, TOWER_HEIGHT],
]

export function towerRadius(y: number): number {
  for (let i = 1; i < TOWER_PROFILE.length; i++) {
    const [r1, y1] = TOWER_PROFILE[i]
    const [r0, y0] = TOWER_PROFILE[i - 1]
    if (y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0)
  }
  return TOWER_PROFILE.at(-1)![0]
}

/** Lathe rond de Y-as, daarna gedraaid zodat de as langs +Z ligt. */
function latheAlongZ(profile: [number, number][], segments = 48) {
  const geometry = new LatheGeometry(profile.map(([r, z]) => new Vector2(r, z)), segments)
  geometry.rotateX(Math.PI / 2)
  return geometry
}

export const geometries = {
  foundation: new CylinderGeometry(2.4, 2.9, 0.5, 48),
  plinth: new CylinderGeometry(1.35, 1.45, 0.35, 48),
  tower: new LatheGeometry(
    [new Vector2(0.001, 0), ...TOWER_PROFILE.map(([r, y]) => new Vector2(r, y)), new Vector2(0.001, TOWER_HEIGHT)],
    64,
  ),
  flange: new CylinderGeometry(1, 1, 0.14, 64),
  door: new BoxGeometry(0.7, 1.5, 0.12),
  doorFrame: new BoxGeometry(0.86, 1.66, 0.08),
  step: new BoxGeometry(1.1, 0.12, 0.6),
  railing: new BoxGeometry(0.04, 0.5, 0.04),
  yawBearing: new CylinderGeometry(0.7, 0.72, 0.32, 40),
  // Gondel: afgerond aan voor- en achterkant, iets hoger dan breed
  nacelle: (() => {
    const g = latheAlongZ([
      [0.001, -3.9],
      [0.55, -3.86],
      [0.92, -3.6],
      [1.08, -3.1],
      [1.12, -1.2],
      [1.08, 0.6],
      [1.0, 1.4],
      // Neus loopt door tot tegen de naaf, zodat er geen kier is tussen gondel en rotor
      [0.93, HUB_Z - 0.45],
      [0.001, HUB_Z - 0.4],
    ])
    g.scale(1, 1.12, 1)
    return g
  })(),
  cooler: new BoxGeometry(1.5, 0.32, 1.6),
  coolerFin: new BoxGeometry(1.5, 0.28, 0.05),
  mast: new CylinderGeometry(0.035, 0.035, 0.9, 8),
  arm: new BoxGeometry(0.9, 0.04, 0.04),
  cup: new SphereGeometry(0.09, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  vane: new BoxGeometry(0.02, 0.18, 0.4),
  light: new SphereGeometry(0.11, 12, 12),
  // Spinner (neuskegel) met een ogiefvorm
  spinner: latheAlongZ([
    [1.02, 0],
    [0.98, 0.5],
    [0.82, 1.15],
    [0.55, 1.7],
    [0.22, 2.05],
    [0.001, 2.14],
  ]),
  hubRing: (() => {
    const g = new CylinderGeometry(1.04, 1.04, 0.5, 48)
    g.rotateX(Math.PI / 2)
    return g
  })(),
  bladeRoot: new CylinderGeometry(0.4, 0.44, 1.2, 28),
  pitchBearing: new CylinderGeometry(0.5, 0.5, 0.14, 28),
  blade: createBladeGeometry(BLADE_LENGTH),
}

export const materials = {
  concrete: new MeshStandardMaterial({ color: '#a3a19b', roughness: 0.95 }),
  tower: new MeshStandardMaterial({ color: '#eef0f1', roughness: 0.45, metalness: 0.05 }),
  flange: new MeshStandardMaterial({ color: '#d4d8db', roughness: 0.5, metalness: 0.2 }),
  band: new MeshStandardMaterial({ color: '#5e8f58', roughness: 0.55 }),
  door: new MeshStandardMaterial({ color: '#7d878f', roughness: 0.5, metalness: 0.4 }),
  shell: new MeshStandardMaterial({ color: '#f5f6f7', roughness: 0.32, metalness: 0.05 }),
  metal: new MeshStandardMaterial({ color: '#8f989f', roughness: 0.35, metalness: 0.7 }),
  dark: new MeshStandardMaterial({ color: '#3b4248', roughness: 0.5, metalness: 0.4 }),
  light: new MeshStandardMaterial({ color: '#ff2a1f', emissive: new Color('#ff2a1f'), emissiveIntensity: 0.6 }),
}

/**
 * Bladmateriaal per molen: de bladen buigen in de vertex shader mee met de stuwkracht van de wind.
 * `flex` is de uitbuiging van de tip in scène-eenheden.
 */
export function createBladeMaterial() {
  const uniforms = { uFlex: { value: 0 } }
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05 })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uFlex;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float span = clamp(position.y / ${BLADE_LENGTH.toFixed(1)}, 0.0, 1.0);
        // Benedenwinds = -Z in het rotorvlak
        transformed.z -= uFlex * span * span;`)
  }
  return { material, uniforms }
}
