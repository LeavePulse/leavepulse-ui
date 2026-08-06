<script setup lang="ts">
/*
 * Point picker on a raster tile map — drag to pan, wheel or the buttons to
 * zoom, click to drop the pin, arrows and +/−/0 from the keyboard.
 *
 * No mapping library: a slippy map is a grid of <img> tiles placed by the Web
 * Mercator maths in ./address.ts, which is a fraction of what wrapping one
 * would cost — and the kit stays dependency-free.
 *
 * Two things keep it smooth. Panning moves ONE transform on the tile layer:
 * tiles are positioned against a fixed world anchor, so dragging never touches
 * their styles and Vue has nothing to patch per frame. Zooming scales that same
 * layer first and swaps the tile pyramid only once the animation lands, which
 * is how the zoom reads as continuous instead of as a hard cut between levels.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { type LatLon, OSM_TILES, type TileSource, project, tileUrl, unproject } from "./address"
import LpIcon from "./LpIcon.vue"

const props = withDefaults(
  defineProps<{
    /** Picked point. Bind with v-model; undefined leaves the map unpinned. */
    modelValue?: LatLon
    /** Tile server. Defaults to OpenStreetMap; swap for your own. */
    tiles?: TileSource
    /** Zoom used on first paint, and when a point arrives from outside. */
    zoom?: number
    /** Where to look when there is no point yet. */
    center?: LatLon
    disabled?: boolean
    /** Any CSS length. */
    height?: string
    /** Offer the "use my location" control (needs a secure context). */
    locatable?: boolean
    zoomInLabel?: string
    zoomOutLabel?: string
    locateLabel?: string
    recentreLabel?: string
  }>(),
  {
    tiles: () => OSM_TILES,
    zoom: 13,
    center: () => ({ lat: 50.11, lon: 14.44 }),
    height: "20rem",
    locatable: true,
    zoomInLabel: "Zoom in",
    zoomOutLabel: "Zoom out",
    locateLabel: "Use my location",
    recentreLabel: "Back to the pin",
  },
)

const emit = defineEmits<{ (e: "update:modelValue", value: LatLon): void }>()

const PAN_STEP = 80
const ZOOM_MS = 220

/*
 * Tiles already fetched this session, by URL. The browser's HTTP cache stops
 * the network request, but a fresh <img> still fades in from nothing — which
 * looks like a reload every time you zoom back to a level you've seen. Tracking
 * them here lets a known tile paint at full opacity straight away. Module-level
 * on purpose: two pickers, or one remounted inside a dialog, share the benefit.
 */
const seenTiles = new Set<string>()

const tileSize = computed(() => props.tiles.tileSize ?? 256)
const minZoom = computed(() => props.tiles.minZoom ?? 1)
const maxZoom = computed(() => props.tiles.maxZoom ?? 19)

const viewport = ref<HTMLElement | null>(null)
const viewWidth = ref(0)
const viewHeight = ref(0)
const level = ref(clampZoom(props.zoom))
const mapCenter = ref<LatLon>(props.modelValue ?? props.center)

// True for the length of a zoom, which is the only time the layers' transforms
// are allowed to transition — during a pan they change every frame and easing
// them would lag the map behind the cursor.
const zooming = ref(false)
let zoomTimer: ReturnType<typeof setTimeout> | undefined
let pruneTimer: ReturnType<typeof setTimeout> | undefined

function clampZoom(value: number) {
  return Math.round(Math.min(maxZoom.value, Math.max(minZoom.value, value)))
}

/** World-pixel coordinate of the viewport's top-left corner, at `level`. */
const origin = computed(() => {
  const point = project(mapCenter.value.lat, mapCenter.value.lon, level.value, tileSize.value)
  return { x: point.x - viewWidth.value / 2, y: point.y - viewHeight.value / 2 }
})

interface Tile {
  key: string
  url: string
  left: number
  top: number
  loaded: boolean
}

/*
 * One zoom level's worth of tiles. Each layer keeps its own anchor — a whole
 * tile near the view it was built for — and every tile offset is measured from
 * it, so panning never touches a tile's style: only the layer's translate
 * moves.
 *
 * Zooming pushes a new layer instead of replacing the old one. The outgoing
 * level stays mounted underneath, scaled to match, until the incoming one has
 * painted — otherwise every zoom flashes the background through the gap while
 * the new tiles are still in flight.
 */
interface Layer {
  id: number
  level: number
  anchor: { x: number; y: number }
  tiles: Tile[]
  range: { firstX: number; firstY: number; lastX: number; lastY: number }
}

const layers = ref<Layer[]>([])
let nextLayerId = 1

const active = computed<Layer | undefined>(() => layers.value[layers.value.length - 1])

function anchorFor(atLevel: number) {
  const size = tileSize.value
  const factor = 2 ** (atLevel - level.value)
  return {
    x: Math.floor((origin.value.x * factor) / size) * size,
    y: Math.floor((origin.value.y * factor) / size) * size,
  }
}

function pushLayer() {
  layers.value = [
    ...layers.value,
    {
      id: nextLayerId++,
      level: level.value,
      anchor: anchorFor(level.value),
      tiles: [],
      range: { firstX: 0, firstY: 0, lastX: -1, lastY: -1 },
    },
  ]
  refreshTiles()
}

/** Drop everything under the active layer once it has something to show. */
function pruneLayers() {
  if (layers.value.length < 2) return
  layers.value = [layers.value[layers.value.length - 1]]
}

function reanchor() {
  const layer = active.value
  if (!layer) return
  const next = anchorFor(layer.level)
  const dx = layer.anchor.x - next.x
  const dy = layer.anchor.y - next.y
  if (!dx && !dy) return
  layer.anchor = next
  // Offsets are measured from the anchor, so moving it has to move them by the
  // same amount or the grid jumps.
  for (const tile of layer.tiles) {
    tile.left += dx
    tile.top += dy
  }
}

/** Rebuild the visible set. Existing tiles keep their identity (and their
 *  loaded flag), so a pan only appends the row or column that came into view. */
/** Rebuild the active layer's tiles. Mounted tiles keep their identity (and
 *  their loaded flag), so a pan only appends the row that came into view. */
function refreshTiles() {
  const layer = active.value
  if (!layer || !viewWidth.value || !viewHeight.value) return
  const size = tileSize.value
  const count = 2 ** layer.level
  // A margin of one tile all round means the edge is already painted by the
  // time a drag exposes it.
  const firstX = Math.floor(origin.value.x / size) - 1
  const firstY = Math.floor(origin.value.y / size) - 1
  const lastX = Math.floor((origin.value.x + viewWidth.value) / size) + 1
  const lastY = Math.floor((origin.value.y + viewHeight.value) / size) + 1

  // Most frames of a drag stay inside the tiles already mounted; rebuilding the
  // list for those would hand Vue a fresh array 60 times a second for nothing.
  const seen = layer.range
  if (
    seen.firstX === firstX &&
    seen.firstY === firstY &&
    seen.lastX === lastX &&
    seen.lastY === lastY
  ) {
    return
  }
  layer.range = { firstX, firstY, lastX, lastY }

  const previous = new Map(layer.tiles.map((tile) => [tile.key, tile]))
  const next: Tile[] = []
  for (let y = firstY; y <= lastY; y++) {
    // No tile rows exist past the poles; the x axis wraps instead, so the map
    // keeps going east and west forever.
    if (y < 0 || y >= count) continue
    for (let x = firstX; x <= lastX; x++) {
      const wrapped = ((x % count) + count) % count
      const key = `${layer.level}/${x}/${y}`
      const existing = previous.get(key)
      if (existing) {
        next.push(existing)
        continue
      }
      const url = tileUrl(props.tiles, layer.level, wrapped, y)
      next.push({
        key,
        url,
        left: x * size - layer.anchor.x,
        top: y * size - layer.anchor.y,
        // Anything fetched before paints at once: replaying the fade on a
        // cached tile is what makes a zoom look like a reload.
        loaded: seenTiles.has(url),
      })
    }
  }
  layer.tiles = next
}

const loadingTiles = computed(() => active.value?.tiles.some((tile) => !tile.loaded) ?? false)

function onTileLoad(tile: Tile) {
  tile.loaded = true
  seenTiles.add(tile.url)
  // The outgoing level is only worth keeping until the new one has painted.
  if (!loadingTiles.value) pruneLayers()
}

/*
 * Where a layer sits right now. Its own level's pixels are scaled to the
 * current level's, then translated — so an older layer under the active one
 * lines up exactly and, once `zooming` turns the transition on, glides into
 * place instead of cutting.
 */
function layerStyle(layer: Layer) {
  const factor = 2 ** (layer.level - level.value)
  const originX = origin.value.x * factor
  const originY = origin.value.y * factor
  return {
    transform: `scale(${1 / factor}) translate3d(${layer.anchor.x - originX}px, ${layer.anchor.y - originY}px, 0)`,
    transformOrigin: "0 0",
    transition: zooming.value
      ? "transform var(--duration-medium) var(--ease-emphasized)"
      : undefined,
  }
}

/** Pin position in viewport pixels — it belongs to the map, not to a layer. */
const pin = computed(() => {
  if (!props.modelValue) return null
  const point = project(props.modelValue.lat, props.modelValue.lon, level.value, tileSize.value)
  return { left: point.x - origin.value.x, top: point.y - origin.value.y }
})

function viewportPoint(e: { clientX: number; clientY: number }) {
  const rect = viewport.value?.getBoundingClientRect()
  return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 }
}

function toLatLon(at: { x: number; y: number }): LatLon {
  return unproject(origin.value.x + at.x, origin.value.y + at.y, level.value, tileSize.value)
}

const panning = ref(false)
// A drag is a pan, not a pick — track whether the pointer actually travelled so
// releasing after a drag doesn't also drop the pin.
let moved = false
let last = { x: 0, y: 0 }
// Pointer velocity in px/ms, smoothed so one jittery frame at the end of a
// flick doesn't decide where the map coasts to.
let velocity = { x: 0, y: 0 }
let lastMove = 0
let glideFrame: number | undefined

function stopGlide() {
  if (glideFrame !== undefined) cancelAnimationFrame(glideFrame)
  glideFrame = undefined
  velocity = { x: 0, y: 0 }
}

function onPointerDown(e: PointerEvent) {
  if (props.disabled || e.button !== 0 || zooming.value) return
  stopGlide()
  panning.value = true
  moved = false
  last = { x: e.clientX, y: e.clientY }
  lastMove = performance.now()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!panning.value) return
  const dx = e.clientX - last.x
  const dy = e.clientY - last.y
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true

  const now = performance.now()
  const dt = now - lastMove
  if (dt > 0) {
    velocity = {
      x: velocity.x * 0.7 + (dx / dt) * 0.3,
      y: velocity.y * 0.7 + (dy / dt) * 0.3,
    }
  }
  lastMove = now
  last = { x: e.clientX, y: e.clientY }
  panBy(-dx, -dy)
}

function onPointerUp(e: PointerEvent) {
  if (!panning.value) return
  panning.value = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  if (!moved && !props.disabled) {
    emit("update:modelValue", toLatLon(viewportPoint(e)))
    return
  }
  // Nothing to coast from if the pointer was resting when it lifted.
  if (performance.now() - lastMove > 90) velocity = { x: 0, y: 0 }
  glide()
}

/*
 * Momentum: keep panning after release and bleed the speed off exponentially,
 * so letting go of a flick drifts to a stop instead of stopping dead. Time-based
 * rather than per-frame, which keeps the feel identical at 60 and 144 Hz.
 */
function glide() {
  if (reducedMotion() || Math.hypot(velocity.x, velocity.y) < 0.05) {
    velocity = { x: 0, y: 0 }
    return
  }
  let previous = performance.now()
  const step = (now: number) => {
    const dt = Math.min(now - previous, 32)
    previous = now
    const friction = Math.exp(-dt / 240)
    velocity = { x: velocity.x * friction, y: velocity.y * friction }
    panBy(-velocity.x * dt, -velocity.y * dt)
    if (Math.hypot(velocity.x, velocity.y) > 0.015) {
      glideFrame = requestAnimationFrame(step)
    } else {
      stopGlide()
    }
  }
  glideFrame = requestAnimationFrame(step)
}

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
}

function panBy(dx: number, dy: number) {
  mapCenter.value = unproject(
    origin.value.x + dx + viewWidth.value / 2,
    origin.value.y + dy + viewHeight.value / 2,
    level.value,
    tileSize.value,
  )
  refreshTiles()
}

/*
 * Zoom: adopt the new level immediately and stack a layer for it. The layers
 * below still describe the old level, so their transforms change too — with
 * `zooming` on, that change is a transition, which is what makes the outgoing
 * tiles scale smoothly under the arriving ones rather than blink out.
 */
function zoomBy(delta: number, at?: { x: number; y: number }) {
  if (props.disabled) return
  const target = clampZoom(level.value + delta)
  if (target === level.value) return
  stopGlide()

  const point = at ?? { x: viewWidth.value / 2, y: viewHeight.value / 2 }
  const ground = toLatLon(point)
  // Recentre so the ground under the anchor point stays under it afterwards.
  const world = project(ground.lat, ground.lon, target, tileSize.value)

  level.value = target
  mapCenter.value = unproject(
    world.x - point.x + viewWidth.value / 2,
    world.y - point.y + viewHeight.value / 2,
    target,
    tileSize.value,
  )

  zooming.value = true
  pushLayer()

  clearTimeout(zoomTimer)
  zoomTimer = setTimeout(() => (zooming.value = false), ZOOM_MS)
  // Backstop: a tile that never loads (offline, 404) must not leave the old
  // level stacked underneath forever.
  clearTimeout(pruneTimer)
  pruneTimer = setTimeout(pruneLayers, 1200)
}

function onWheel(e: WheelEvent) {
  if (props.disabled) return
  e.preventDefault()
  zoomBy(e.deltaY < 0 ? 1 : -1, viewportPoint(e))
}

function onDoubleClick(e: MouseEvent) {
  zoomBy(1, viewportPoint(e))
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  switch (e.key) {
    case "ArrowUp":
      e.preventDefault()
      panBy(0, -PAN_STEP)
      break
    case "ArrowDown":
      e.preventDefault()
      panBy(0, PAN_STEP)
      break
    case "ArrowLeft":
      e.preventDefault()
      panBy(-PAN_STEP, 0)
      break
    case "ArrowRight":
      e.preventDefault()
      panBy(PAN_STEP, 0)
      break
    case "+":
    case "=":
      e.preventDefault()
      zoomBy(1)
      break
    case "-":
      e.preventDefault()
      zoomBy(-1)
      break
    case "0":
      e.preventDefault()
      recentre()
      break
  }
}

const canRecentre = computed(() => {
  if (!pin.value) return false
  const { left, top } = pin.value
  return left < 0 || top < 0 || left > viewWidth.value || top > viewHeight.value
})

function recentre() {
  if (!props.modelValue) return
  stopGlide()
  mapCenter.value = props.modelValue
  reanchor()
  refreshTiles()
}

const locating = ref(false)

function locate() {
  if (!navigator.geolocation || locating.value) return
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locating.value = false
      const next = { lat: position.coords.latitude, lon: position.coords.longitude }
      emit("update:modelValue", next)
      mapCenter.value = next
      reanchor()
      refreshTiles()
    },
    () => {
      locating.value = false
    },
    { enableHighAccuracy: true, timeout: 10_000 },
  )
}

// A point set from outside (a suggestion picked in the form, say) recentres the
// map; panning afterwards must not yank it back, so only the value is watched.
watch(
  () => props.modelValue,
  (value) => {
    if (!value || panning.value) return
    mapCenter.value = value
    if (level.value < props.zoom) {
      level.value = clampZoom(props.zoom)
      pushLayer()
      return
    }
    reanchor()
    refreshTiles()
  },
)

watch(
  () => props.tiles,
  () => {
    layers.value = []
    pushLayer()
  },
)

let observer: ResizeObserver | undefined

onMounted(() => {
  const el = viewport.value
  if (!el) return
  observer = new ResizeObserver(([entry]) => {
    viewWidth.value = entry.contentRect.width
    viewHeight.value = entry.contentRect.height
    if (!layers.value.length) {
      pushLayer()
      return
    }
    reanchor()
    refreshTiles()
  })
  observer.observe(el)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  clearTimeout(zoomTimer)
  clearTimeout(pruneTimer)
  stopGlide()
})

defineExpose({ zoomIn: () => zoomBy(1), zoomOut: () => zoomBy(-1), recentre, locate })

const CONTROL =
  "flex size-8 items-center justify-center rounded-control bg-black/45 text-white/90 outline-none backdrop-blur-sm transition-[background-color,scale] duration-[var(--duration-fast)] hover:bg-black/65 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:shadow-[var(--glow-brand)] disabled:pointer-events-none disabled:opacity-40"
</script>

<template>
  <div
    class="relative overflow-hidden rounded-control border border-line bg-surface-soft"
    :style="{ height }"
  >
    <div
      ref="viewport"
      class="absolute inset-0 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:shadow-[var(--glow-brand)]"
      :class="disabled ? 'cursor-not-allowed opacity-55' : panning ? 'cursor-grabbing' : 'cursor-grab'"
      :tabindex="disabled ? -1 : 0"
      role="application"
      :aria-label="recentreLabel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
      @dblclick="onDoubleClick"
      @keydown="onKeydown"
    >
      <!-- Oldest level first, so an arriving one paints over the one it
           replaces and the swap has no gap to show through. -->
      <div
        v-for="layer in layers"
        :key="layer.id"
        class="absolute left-0 top-0 will-change-transform motion-reduce:transition-none"
        :style="layerStyle(layer)"
      >
        <img
          v-for="tile in layer.tiles"
          :key="tile.key"
          :src="tile.url"
          alt=""
          draggable="false"
          class="absolute max-w-none"
          :class="tile.loaded ? '' : 'animate-[map-tile-in_var(--duration-medium)_ease] motion-reduce:animate-none'"
          :style="{
            left: `${tile.left}px`,
            top: `${tile.top}px`,
            width: `${tileSize}px`,
            height: `${tileSize}px`,
          }"
          @load="onTileLoad(tile)"
        />
      </div>

      <span
        v-if="pin"
        class="pointer-events-none absolute"
        :style="{ left: `${pin.left}px`, top: `${pin.top}px`, transform: 'translate(-50%, -100%)' }"
      >
        <LpIcon
          name="lucide:map-pin"
          :size="30"
          class="block animate-[map-pin-in_var(--duration-medium)_var(--ease-emphasized)] text-danger drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] motion-reduce:animate-none"
        />
      </span>
    </div>

    <div class="absolute right-2 top-2 flex flex-col gap-1.5">
      <button
        :class="CONTROL"
        type="button"
        :disabled="disabled || level >= maxZoom"
        :title="zoomInLabel"
        :aria-label="zoomInLabel"
        @click="zoomBy(1)"
      >
        <LpIcon name="lucide:plus" :size="16" />
      </button>
      <button
        :class="CONTROL"
        type="button"
        :disabled="disabled || level <= minZoom"
        :title="zoomOutLabel"
        :aria-label="zoomOutLabel"
        @click="zoomBy(-1)"
      >
        <LpIcon name="lucide:minus" :size="16" />
      </button>
      <button
        v-if="canRecentre"
        :class="CONTROL"
        type="button"
        :title="recentreLabel"
        :aria-label="recentreLabel"
        @click="recentre"
      >
        <LpIcon name="lucide:locate-fixed" :size="16" />
      </button>
      <button
        v-if="locatable"
        :class="CONTROL"
        type="button"
        :disabled="disabled || locating"
        :title="locateLabel"
        :aria-label="locateLabel"
        @click="locate"
      >
        <LpIcon
          :name="locating ? 'lucide:loader-circle' : 'lucide:crosshair'"
          :size="16"
          :class="locating ? 'animate-spin' : ''"
        />
      </button>
    </div>

    <LpIcon
      v-if="loadingTiles"
      name="lucide:loader-circle"
      :size="16"
      class="pointer-events-none absolute left-2 top-2 animate-spin text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
    />

    <p
      v-if="props.tiles.attribution"
      class="pointer-events-none absolute bottom-0 right-0 rounded-tl-control bg-black/45 px-1.5 py-0.5 text-[10px] text-white/75 backdrop-blur-sm"
    >
      {{ props.tiles.attribution }}
    </p>
  </div>
</template>
