<script setup lang="ts">
import { Html } from '@tresjs/cientos'
import { useLoop } from '@tresjs/core'
import { onUnmounted } from 'vue'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BELFORT, BROEL, CHURCH, LANDMARKS, PENTA, houses } from '../lib/kortrijk'
import { RIVER, WATER_LEVEL } from '../lib/terrain'

const props = defineProps<{ night: boolean }>()

const disposables: { dispose: () => void }[] = []
function keep<T extends { dispose: () => void }>(item: T): T {
  disposables.push(item)
  return item
}

// --- Materialen ---
const mat = {
  white: keep(new MeshStandardMaterial({ color: '#f4f4f1', roughness: 0.45 })),
  glass: keep(new MeshStandardMaterial({ color: '#2f4452', roughness: 0.12, metalness: 0.6, emissive: new Color('#f7d58a'), emissiveIntensity: 0 })),
  roofGreen: keep(new MeshStandardMaterial({ color: '#6c8f45', roughness: 1 })),
  stone: keep(new MeshStandardMaterial({ color: '#b8a888', roughness: 0.9 })),
  brick: keep(new MeshStandardMaterial({ color: '#9a5a3c', roughness: 0.95 })),
  slate: keep(new MeshStandardMaterial({ color: '#3b4048', roughness: 0.6, metalness: 0.2 })),
  gold: keep(new MeshStandardMaterial({ color: '#d4a940', roughness: 0.3, metalness: 0.9 })),
  dark: keep(new MeshStandardMaterial({ color: '#2a2c30', roughness: 0.8 })),
  water: keep(new MeshStandardMaterial({ color: '#3f6676', roughness: 0.08, metalness: 0.35 })),
}

/** Samenvoegen tot één geometrie per materiaal (minder draw calls); extrude-geometrie heeft geen index */
function merge(list: BufferGeometry[]): BufferGeometry {
  return mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g)))
}

/** Geometrie verplaatsen/draaien en teruggeven, om daarna samen te voegen. */
function place<T extends BufferGeometry>(g: T, x: number, y: number, z: number, ry = 0): T {
  if (ry) g.rotateY(ry)
  g.translate(x, y, z)
  return g
}

// --- The Penta: vijfhoek met afgeronde hoeken, witte vloerplaten en glazen gevels ---
function roundedPentagon(radius: number, corner: number): Shape {
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius }
  })
  const shape = new Shape()
  pts.forEach((p, i) => {
    const prev = pts[(i + 4) % 5]
    const next = pts[(i + 1) % 5]
    const toward = (q: { x: number, y: number }) => {
      const len = Math.hypot(q.x - p.x, q.y - p.y)
      return { x: p.x + ((q.x - p.x) / len) * corner, y: p.y + ((q.y - p.y) / len) * corner }
    }
    const a = toward(prev)
    const b = toward(next)
    if (i === 0) shape.moveTo(a.x, a.y)
    else shape.lineTo(a.x, a.y)
    shape.quadraticCurveTo(p.x, p.y, b.x, b.y)
  })
  shape.closePath()
  return shape
}

function pentaSlab(radius: number, height: number, y: number) {
  const g = new ExtrudeGeometry(roundedPentagon(radius, radius * 0.32), { depth: height, bevelEnabled: false, curveSegments: 10 })
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

const FLOORS = 5
const FLOOR_H = 2.2
const whites: BufferGeometry[] = []
const glasses: BufferGeometry[] = []
for (let f = 0; f < FLOORS; f++) {
  const y = f * FLOOR_H
  // Licht uitkragende vloerplaten, daartussen een terugliggende glazen gevel
  whites.push(pentaSlab(PENTA.radius + 0.35, 0.5, y + FLOOR_H - 0.5))
  glasses.push(pentaSlab(PENTA.radius - 0.4, FLOOR_H - 0.5, y))
}
whites.push(pentaSlab(PENTA.radius + 0.1, 0.45, 0))
// Dakopbouw met terrassen en een groen dak
const top = FLOORS * FLOOR_H
glasses.push(pentaSlab(PENTA.radius * 0.62, 1.8, top))
whites.push(pentaSlab(PENTA.radius * 0.66, 0.4, top + 1.8))
// Verticale witte lamellen rondom de gevel
for (let i = 0; i < 40; i++) {
  const a = (i / 40) * Math.PI * 2
  const r = PENTA.radius * 0.9
  whites.push(place(new BoxGeometry(0.12, top, 0.5), Math.cos(a) * r, top / 2, Math.sin(a) * r, -a))
}
const pentaWhite = keep(merge(whites))
const pentaGlass = keep(merge(glasses))
const pentaRoof = keep(pentaSlab(PENTA.radius * 0.98, 0.15, top))
;[...whites, ...glasses].forEach(g => g.dispose())

// --- Broeltorens + Broelbrug ---
function broelTower(x: number) {
  return {
    stone: [
      place(new CylinderGeometry(2.3, 2.5, 11, 28), x, 5.5 - 1.5, 0),
      place(new CylinderGeometry(2.55, 2.55, 0.5, 28), x, 9.3, 0),
    ],
    slate: [place(new ConeGeometry(2.75, 6.5, 28), x, 9.55 + 3.25, 0)],
    dark: [0, 1, 2, 3].map(k => {
      const a = (k / 4) * Math.PI * 2 + 0.4
      return place(new BoxGeometry(0.5, 1, 0.3), x + Math.cos(a) * 2.3, 5 + (k % 2) * 2, Math.sin(a) * 2.3, -a + Math.PI / 2)
    }),
  }
}
const towers = [broelTower(-BROEL.offset), broelTower(BROEL.offset)]
const bridgeLength = BROEL.offset * 2
const broelStone = [
  ...towers.flatMap(t => t.stone),
  place(new BoxGeometry(bridgeLength, 0.8, 4.2), 0, 2.2, 0),
  place(new BoxGeometry(bridgeLength, 0.6, 0.3), 0, 2.9, 2),
  place(new BoxGeometry(bridgeLength, 0.6, 0.3), 0, 2.9, -2),
  // Bogen onder de brug
  ...[-1, 0, 1].map(k => place(new TorusGeometry(2, 0.45, 8, 16, Math.PI), k * 4.6, -0.4, 0).scale(1, 1, 4.2)),
]
const broel = {
  stone: keep(merge(broelStone)),
  slate: keep(merge(towers.flatMap(t => t.slate))),
  dark: keep(merge(towers.flatMap(t => t.dark))),
}

// --- Belfort: vierkante stenen toren met vier hoektorentjes en een spits ---
const belfortStone = [
  place(new BoxGeometry(5, 15, 5), 0, 7.5, 0),
  place(new BoxGeometry(5.6, 0.5, 5.6), 0, 15.2, 0),
  place(new BoxGeometry(3.6, 4.5, 3.6), 0, 17.6, 0),
  ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => place(new CylinderGeometry(0.55, 0.55, 3.5, 12), sx * 2.5, 17.2, sz * 2.5)),
]
const belfortSlate = [
  place(new ConeGeometry(2.6, 9.5, 8), 0, 19.85 + 4.75, 0),
  ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => place(new ConeGeometry(0.8, 3, 12), sx * 2.5, 20.45, sz * 2.5)),
]
const belfortDark = [-1, 1].flatMap(side => [
  place(new BoxGeometry(1.2, 2.6, 0.2), 0, 11, side * 2.52),
  place(new BoxGeometry(0.2, 2.6, 1.2), side * 2.52, 11, 0),
  place(new BoxGeometry(1, 1.8, 0.2), 0, 17.6, side * 1.82),
])
const belfort = {
  stone: keep(merge(belfortStone)),
  slate: keep(merge(belfortSlate)),
  dark: keep(merge(belfortDark)),
  gold: keep(new SphereGeometry(0.4, 12, 12).translate(0, 29.8, 0)),
}

// --- Sint-Maartenskerk: schip met zadeldak en een hoge toren ---
function gableRoof(width: number, height: number, length: number) {
  const s = new Shape()
  s.moveTo(-width / 2, 0)
  s.lineTo(width / 2, 0)
  s.lineTo(0, height)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: length, bevelEnabled: false })
  g.translate(0, 0, -length / 2)
  return g
}
const church = {
  brick: keep(merge([
    place(new BoxGeometry(7, 9, 18), 0, 4.5, 4),
    place(new BoxGeometry(5, 22, 5), 0, 11, -6.5),
    place(new BoxGeometry(5.6, 0.6, 5.6), 0, 22.3, -6.5),
  ])),
  slate: keep(merge([
    place(gableRoof(7.4, 4.5, 18.4), 0, 9, 4),
    place(new ConeGeometry(3.3, 12, 4), 0, 22.6 + 6, -6.5, Math.PI / 4),
  ])),
}

// --- Rijhuizen ---
const list = houses()
const houseBody = keep(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0))
// Zadeldak met de nok langs lokale X, 1 breed en 1 diep
const houseRoof = keep((() => {
  const g = gableRoof(1.06, 0.55, 1.04)
  g.rotateY(Math.PI / 2)
  return g
})())
const facadeColors = ['#9a5a3c', '#b06d45', '#d8cdb5', '#7e4632', '#c4a27c'].map(c => new Color(c))
const roofColors = ['#3d4047', '#8b3d2d'].map(c => new Color(c))
const houseMat = keep(new MeshStandardMaterial({ roughness: 0.95 }))
const roofMat = keep(new MeshStandardMaterial({ roughness: 0.7 }))
const bodies = new InstancedMesh(houseBody, houseMat, list.length)
const roofs = new InstancedMesh(houseRoof, roofMat, list.length)
const dummy = new Object3D()
list.forEach((h, i) => {
  dummy.position.set(h.x, h.y - 0.2, h.z)
  dummy.rotation.set(0, h.angle, 0)
  dummy.scale.set(h.w, h.h + 0.2, h.d)
  dummy.updateMatrix()
  bodies.setMatrixAt(i, dummy.matrix)
  bodies.setColorAt(i, facadeColors[h.color])
  dummy.position.y = h.y + h.h
  dummy.scale.set(h.w, h.d * 0.75, h.d)
  dummy.updateMatrix()
  roofs.setMatrixAt(i, dummy.matrix)
  roofs.setColorAt(i, roofColors[h.roof])
})
bodies.computeBoundingSphere()
roofs.computeBoundingSphere()
keep(bodies)
keep(roofs)

// --- De Leie: een waterlint dat de meander van de bedding volgt ---
const water = keep((() => {
  const perp = { x: -RIVER.dir.z, z: RIVER.dir.x }
  const half = RIVER.width / 2 + 2.5
  const positions: number[] = []
  const indices: number[] = []
  const steps = 180
  for (let i = 0; i <= steps; i++) {
    const along = -360 + (i / steps) * 720
    const meander = Math.sin(along * 0.018) * 10
    const cx = RIVER.origin.x + RIVER.dir.x * along + perp.x * meander
    const cz = RIVER.origin.z + RIVER.dir.z * along + perp.z * meander
    positions.push(cx - perp.x * half, WATER_LEVEL, cz - perp.z * half, cx + perp.x * half, WATER_LEVEL, cz + perp.z * half)
    if (i < steps) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  // Normalen naar boven richten, ongeacht de volgorde van de driehoeken
  g.attributes.normal.array.fill(0)
  for (let i = 1; i < g.attributes.normal.array.length; i += 3) (g.attributes.normal.array as Float32Array)[i] = 1
  return g
})())

// 's Avonds gaan de lichten in The Penta aan
useLoop().onBeforeRender(() => {
  const target = props.night ? 1.2 : 0
  mat.glass.emissiveIntensity += (target - mat.glass.emissiveIntensity) * 0.05
})

onUnmounted(() => disposables.forEach(d => d.dispose()))
</script>

<template>
  <TresGroup>
    <!-- The Penta (Howest) -->
    <TresGroup :position="[PENTA.x, PENTA.y, PENTA.z]" :rotation="[0, PENTA.angle, 0]">
      <TresMesh :geometry="pentaWhite" :material="mat.white" cast-shadow receive-shadow />
      <TresMesh :geometry="pentaGlass" :material="mat.glass" />
      <TresMesh :geometry="pentaRoof" :material="mat.roofGreen" receive-shadow />
    </TresGroup>

    <!-- Broeltorens en Broelbrug over de Leie -->
    <TresGroup :position="[BROEL.x, BROEL.y, BROEL.z]" :rotation="[0, BROEL.angle, 0]">
      <TresMesh :geometry="broel.stone" :material="mat.stone" cast-shadow receive-shadow />
      <TresMesh :geometry="broel.slate" :material="mat.slate" cast-shadow />
      <TresMesh :geometry="broel.dark" :material="mat.dark" />
    </TresGroup>

    <!-- Belfort op de Grote Markt -->
    <TresGroup :position="[BELFORT.x, BELFORT.y, BELFORT.z]" :rotation="[0, BELFORT.angle, 0]">
      <TresMesh :geometry="belfort.stone" :material="mat.stone" cast-shadow receive-shadow />
      <TresMesh :geometry="belfort.slate" :material="mat.slate" cast-shadow />
      <TresMesh :geometry="belfort.dark" :material="mat.dark" />
      <TresMesh :geometry="belfort.gold" :material="mat.gold" />
    </TresGroup>

    <!-- Sint-Maartenskerk -->
    <TresGroup :position="[CHURCH.x, CHURCH.y, CHURCH.z]" :rotation="[0, CHURCH.angle, 0]">
      <TresMesh :geometry="church.brick" :material="mat.brick" cast-shadow receive-shadow />
      <TresMesh :geometry="church.slate" :material="mat.slate" cast-shadow />
    </TresGroup>

    <primitive :object="bodies" />
    <primitive :object="roofs" />
    <TresMesh :geometry="water" :material="mat.water" receive-shadow />

    <Html
      v-for="l in LANDMARKS"
      :key="l.name"
      :position="[l.x, l.y, l.z]"
      center
      :z-index-range="[10, 0]"
    >
      <span class="landmark">{{ l.name }}</span>
    </Html>
  </TresGroup>
</template>

<style>
.landmark {
  display: inline-block;
  padding: 3px 8px;
  font: 600 11px/1.3 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: #eef4f7;
  white-space: nowrap;
  background: rgb(14 24 33 / 0.6);
  border: 1px solid rgb(255 255 255 / 0.18);
  border-radius: 999px;
  pointer-events: none;
  user-select: none;
}
</style>
