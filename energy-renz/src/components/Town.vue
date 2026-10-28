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
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { useLocation } from '../composables/useLocation'
import { BRIDGE, CHURCH, OFFICE, TOWN_HALL, TOWN_LABEL, houses } from '../lib/town'
import { RIVER, WATER_LEVEL } from '../lib/terrain'

const props = defineProps<{
  night: boolean
  /** Aandeel van de gezinnen dat door het windpark van stroom voorzien wordt (0..1) */
  share: number
}>()

const { place: city } = useLocation()

const disposables: { dispose: () => void }[] = []
function keep<T extends { dispose: () => void }>(item: T): T {
  disposables.push(item)
  return item
}

// --- Materialen ---
const mat = {
  white: keep(new MeshStandardMaterial({ color: '#e9e8e3', roughness: 0.5 })),
  glass: keep(new MeshStandardMaterial({ color: '#2f4452', roughness: 0.12, metalness: 0.6, emissive: new Color('#f7d58a'), emissiveIntensity: 0 })),
  roofGreen: keep(new MeshStandardMaterial({ color: '#6c8f45', roughness: 1 })),
  stone: keep(new MeshStandardMaterial({ color: '#b8a888', roughness: 0.9 })),
  plaster: keep(new MeshStandardMaterial({ color: '#d9cdb4', roughness: 0.9 })),
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

/** Zadeldak met de nok langs Z */
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

// --- Kantoorgebouw: twee rechthoekige volumes met glazen gevels en witte vloerplaten ---
const officeWhite: BufferGeometry[] = []
const officeGlass: BufferGeometry[] = []
const FLOOR_H = 2.2
function officeBlock(w: number, d: number, floors: number, x: number, z: number) {
  for (let f = 0; f < floors; f++) {
    officeGlass.push(place(new BoxGeometry(w - 0.6, FLOOR_H - 0.45, d - 0.6), x, f * FLOOR_H + (FLOOR_H - 0.45) / 2, z))
    officeWhite.push(place(new BoxGeometry(w, 0.45, d), x, (f + 1) * FLOOR_H - 0.225, z))
  }
  // Verticale stijlen op de hoeken
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    officeWhite.push(place(new BoxGeometry(0.4, floors * FLOOR_H, 0.4), x + sx * (w / 2 - 0.2), (floors * FLOOR_H) / 2, z + sz * (d / 2 - 0.2)))
  }
}
const LOW_FLOORS = 3
const HIGH_FLOORS = 6
officeBlock(17, 9, LOW_FLOORS, -2, 0)
officeBlock(7, 7, HIGH_FLOORS, 5.5, -1)
const office = {
  white: keep(merge(officeWhite)),
  glass: keep(merge(officeGlass)),
  // Groen dak op het lage volume
  roof: keep(place(new BoxGeometry(9.5, 0.12, 8.4), -5.5, LOW_FLOORS * FLOOR_H + 0.06, 0)),
}
;[...officeWhite, ...officeGlass].forEach(g => g.dispose())

// --- Stenen boogbrug met leuningen en lantaarns ---
const bridgeLength = BRIDGE.offset * 2
const bridge = {
  stone: keep(merge([
    place(new BoxGeometry(bridgeLength, 0.8, 4.2), 0, 2.2, 0),
    place(new BoxGeometry(bridgeLength, 0.6, 0.3), 0, 2.9, 2),
    place(new BoxGeometry(bridgeLength, 0.6, 0.3), 0, 2.9, -2),
    // Bogen onder de brug
    ...[-1, 0, 1].map(k => place(new TorusGeometry(2, 0.45, 8, 16, Math.PI), k * 4.6, -0.4, 0).scale(1, 1, 4.2)),
  ])),
  dark: keep(merge([-1, 1].flatMap(side => [-1, 1].map(end =>
    place(new CylinderGeometry(0.08, 0.1, 2.4, 6), end * (bridgeLength / 2 - 0.6), 3.4 + 1.2, side * 2),
  )))),
  gold: keep(merge([-1, 1].flatMap(side => [-1, 1].map(end =>
    place(new SphereGeometry(0.22, 8, 8), end * (bridgeLength / 2 - 0.6), 5.8, side * 2),
  )))),
}

// --- Stadhuis: breed gebouw met zadeldak, dakkapellen en een klein klokkentorentje ---
const townHall = {
  plaster: keep(merge([
    place(new BoxGeometry(14, 8, 7), 0, 4, 0),
    place(new BoxGeometry(2.6, 3, 2.6), 0, 11.6, 0),
  ])),
  stone: keep(merge([
    place(new BoxGeometry(14.4, 0.6, 7.4), 0, 0.3, 0),
    place(new BoxGeometry(14.3, 0.35, 7.3), 0, 8, 0),
    // Trap en ingang
    place(new BoxGeometry(4, 0.4, 1.2), 0, 0.2, 4),
  ])),
  slate: keep(merge([
    place(gableRoof(7.6, 3.6, 14.6), 0, 8, 0, Math.PI / 2),
    place(new ConeGeometry(2.1, 3.2, 4), 0, 13.1 + 1.6, 0, Math.PI / 4),
  ])),
  dark: keep(merge([
    // Ramen in twee rijen aan de voorgevel
    ...[-5, -2.5, 2.5, 5].flatMap(x => [2.6, 5.6].map(y => place(new BoxGeometry(1.1, 1.6, 0.1), x, y, 3.52))),
    place(new BoxGeometry(1.8, 2.6, 0.1), 0, 1.7, 3.52),
    // Wijzerplaat van de klok
    place(new CylinderGeometry(0.75, 0.75, 0.1, 20).rotateX(Math.PI / 2), 0, 11.8, 1.32),
  ])),
  gold: keep(new SphereGeometry(0.3, 12, 12).translate(0, 16.5, 0)),
}

// --- Kerk: schip met zadeldak en een toren met een achtzijdige spits ---
const church = {
  brick: keep(merge([
    place(new BoxGeometry(7, 9, 18), 0, 4.5, 4),
    place(new BoxGeometry(5, 18, 5), 0, 9, -6.5),
    place(new BoxGeometry(5.6, 0.6, 5.6), 0, 18.3, -6.5),
  ])),
  slate: keep(merge([
    place(gableRoof(7.4, 4.5, 18.4), 0, 9, 4),
    place(new ConeGeometry(3, 10, 8), 0, 18.6 + 5, -6.5),
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

// Ramen: een band aan voor- en achtergevel die oplicht als het huis stroom van de molens krijgt
const windowGeometry = keep(new BoxGeometry(0.72, 0.2, 1.02).translate(0, 0.62, 0))
const windowMat = keep(new MeshBasicMaterial({ toneMapped: false }))
const windows = keep(new InstancedMesh(windowGeometry, windowMat, list.length))
list.forEach((h, i) => {
  dummy.position.set(h.x, h.y - 0.2, h.z)
  dummy.rotation.set(0, h.angle, 0)
  dummy.scale.set(h.w, h.h + 0.2, h.d)
  dummy.updateMatrix()
  windows.setMatrixAt(i, dummy.matrix)
})
windows.computeBoundingSphere()
// Willekeurige volgorde waarin de huizen aangaan
const lightOrder = list.map((_, i) => i).sort(() => Math.random() - 0.5)
const LIT = new Color('#ffd27a').multiplyScalar(1.6)
const UNLIT = new Color('#2b3036')
let litCount = -1
function updateWindows(count: number) {
  if (count === litCount) return
  litCount = count
  lightOrder.forEach((house, rank) => windows.setColorAt(house, rank < count ? LIT : UNLIT))
  windows.instanceColor!.needsUpdate = true
}
updateWindows(0)

// --- De rivier: een waterlint dat de meander van de bedding volgt ---
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

// Lichten in de stad volgen de stroom van het windpark (en zijn 's avonds feller in het kantoorgebouw)
useLoop().onBeforeRender(() => {
  updateWindows(Math.round(props.share * list.length))
  // Het kantoorgebouw haalt zijn stroom ook uit het park
  const target = props.share * (props.night ? 1.4 : 0.3)
  mat.glass.emissiveIntensity += (target - mat.glass.emissiveIntensity) * 0.05
})

onUnmounted(() => disposables.forEach(d => d.dispose()))
</script>

<template>
  <TresGroup>
    <!-- Kantoorgebouw in het park -->
    <TresGroup :position="[OFFICE.x, OFFICE.y, OFFICE.z]" :rotation="[0, OFFICE.angle, 0]">
      <TresMesh :geometry="office.white" :material="mat.white" cast-shadow receive-shadow />
      <TresMesh :geometry="office.glass" :material="mat.glass" />
      <TresMesh :geometry="office.roof" :material="mat.roofGreen" receive-shadow />
    </TresGroup>

    <!-- Brug over de rivier -->
    <TresGroup :position="[BRIDGE.x, BRIDGE.y, BRIDGE.z]" :rotation="[0, BRIDGE.angle, 0]">
      <TresMesh :geometry="bridge.stone" :material="mat.stone" cast-shadow receive-shadow />
      <TresMesh :geometry="bridge.dark" :material="mat.dark" />
      <TresMesh :geometry="bridge.gold" :material="mat.gold" />
    </TresGroup>

    <!-- Stadhuis aan het marktplein -->
    <TresGroup :position="[TOWN_HALL.x, TOWN_HALL.y, TOWN_HALL.z]" :rotation="[0, TOWN_HALL.angle, 0]">
      <TresMesh :geometry="townHall.plaster" :material="mat.plaster" cast-shadow receive-shadow />
      <TresMesh :geometry="townHall.stone" :material="mat.stone" receive-shadow />
      <TresMesh :geometry="townHall.slate" :material="mat.slate" cast-shadow />
      <TresMesh :geometry="townHall.dark" :material="mat.dark" />
      <TresMesh :geometry="townHall.gold" :material="mat.gold" />
    </TresGroup>

    <!-- Kerk -->
    <TresGroup :position="[CHURCH.x, CHURCH.y, CHURCH.z]" :rotation="[0, CHURCH.angle, 0]">
      <TresMesh :geometry="church.brick" :material="mat.brick" cast-shadow receive-shadow />
      <TresMesh :geometry="church.slate" :material="mat.slate" cast-shadow />
    </TresGroup>

    <primitive :object="bodies" />
    <primitive :object="roofs" />
    <primitive :object="windows" />
    <TresMesh :geometry="water" :material="mat.water" receive-shadow />

    <!-- Naam van de gekozen stad boven het stadhuis -->
    <Html :position="[TOWN_LABEL.x, TOWN_LABEL.y, TOWN_LABEL.z]" center :z-index-range="[10, 0]">
      <span class="landmark">{{ city.name }}</span>
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
