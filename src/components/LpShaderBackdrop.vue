<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * A slowly moving decorative background, drawn on the GPU: behind a sign-in
 * screen, a hero, an empty state, a launcher's home. It fills the box it is
 * put in (`absolute inset-0`, so position the parent) and takes no pointer
 * events.
 *
 *   <section class="relative">
 *     <LpShaderBackdrop preset="aurora" />
 *     …content…
 *   </section>
 *
 * Looks (`preset`, see shaderBackdrop.ts): `aurora` (flowing bands of light),
 * `silk` (folded sheen), `grain` (drifting colour under film grain), `dots`
 * (a dot grid with a travelling ripple). All are coloured from the theme's
 * tokens and follow a theme change, blending to the new colours.
 *
 * What makes it safe to drop in anywhere:
 * - A CSS still of the same look is always underneath. It is what shows
 *   while the first frame is drawn, and instead of the canvas where WebGL is
 *   missing, software-only, loses its context, or cannot keep up (judged on
 *   the first second of frames) — the cases that occur on WebKitGTK, where the
 *   kit's desktop shells run. The page looks the same; it only stops moving.
 * - Reduced motion gets the still, without creating a GL context at all.
 * - It draws only while someone can see it: off-screen (IntersectionObserver),
 *   in a hidden tab, or `paused`, the loop stops. Frames are capped (`fps`),
 *   since a background gains nothing from 120 a second.
 * - Unmounting releases the GL context, so a page that mounts and unmounts
 *   backdrops does not run into the browser's limit on live contexts.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { parseColor } from "./color"
import { approach, frameDue, FRAGMENT_HEADER, PRESETS, tooSlow, VERTEX_SHADER, type ShaderPreset, type Vec3 } from "./shaderBackdrop"
import { isBrokenBackdropEngine } from "../theme/backdrop"
import { durationToken, prefersReducedMotion } from "../composables/easing"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = withDefaults(
  defineProps<{
    preset?: ShaderPreset
    /** How strongly the theme colours show over the surface, 0–1. Lower for a backdrop under body text. */
    intensity?: number
    /** Motion speed; 1 is a calm drift, 0.5 half as fast. */
    speed?: number
    /** Frame cap. 30 is smooth for slow motion and half the work of 60. */
    fps?: number
    /** Hold the current frame. */
    paused?: boolean
    /** Always show the CSS still, never start WebGL: for a low-power mode or a screenshot. */
    still?: boolean
  }>(),
  { preset: "aurora", intensity: 0.7, speed: 1, fps: 30, paused: false, still: false },
)

const emit = defineEmits<{
  /** WebGL could not be used (missing, too slow, context lost); the still is showing. Useful to log, not to act on. */
  (e: "fallback", reason: "unavailable" | "slow" | "lost" | "compile"): void
}>()

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
/** Bumped whenever a context is released: a canvas whose context was lost cannot get a new one. */
const canvasKey = ref(0)

const reduced = ref(prefersReducedMotion())
const onScreen = ref(true)
const pageHidden = ref(typeof document !== "undefined" && document.hidden)
const failed = ref(false)
/** The canvas holds a finished frame of the current look and is faded in over the still. */
const shown = ref(false)

const wantGl = computed(() => !props.still && !reduced.value && !failed.value)
const animating = computed(() => !props.paused && onScreen.value && !pageHidden.value)

/*
 * WebKitGTK composites on the CPU more often than not. There the canvas is
 * drawn at one device pixel per CSS pixel and at most 24 frames a second,
 * which keeps the look and halves the cost again.
 */
const weakEngine = typeof navigator !== "undefined" && isBrokenBackdropEngine()

const fallbackStyle = computed(() => ({ background: PRESETS[props.preset].fallback, opacity: Math.min(1, clamp01(props.intensity) * 1.15) }))

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

// ── Theme colours ───────────────────────────────────────────────────────────

const TOKENS = ["surface", "brand", "accent", "action", "ink"] as const
type Palette = Record<(typeof TOKENS)[number], Vec3>

let probe: HTMLSpanElement | null = null
let paint: CanvasRenderingContext2D | null = null

/*
 * A token's colour as numbers. The computed `color` of a probe styled with
 * the variable resolves any scoped override and any colour syntax a theme
 * uses; rgb() is parsed directly, and anything newer (color(), oklch()) is
 * handed to a 2D canvas, which converts whatever the engine itself accepts.
 */
function tokenColor(name: string): Vec3 {
  if (!probe || !root.value) return [0, 0, 0]
  probe.style.color = `var(--color-${name})`
  const css = getComputedStyle(probe).color
  const rgb = parseColor(css)
  if (rgb) return [rgb.r / 255, rgb.g / 255, rgb.b / 255]
  paint ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  if (!paint) return [0, 0, 0]
  paint.clearRect(0, 0, 1, 1)
  paint.fillStyle = "#000"
  paint.fillStyle = css
  paint.fillRect(0, 0, 1, 1)
  const [r, g, b] = paint.getImageData(0, 0, 1, 1).data
  return [r / 255, g / 255, b / 255]
}

function readPalette(): Palette {
  const out = {} as Palette
  for (const name of TOKENS) out[name] = tokenColor(name)
  return out
}

let target: Palette | null = null
let current: Palette | null = null

function refreshPalette() {
  target = readPalette()
  // Mid-animation the loop blends toward it; otherwise there is no next frame to blend in, so it lands now.
  if (!current || !running) {
    current = { ...target }
    drawFrame()
  }
}

// ── GL ──────────────────────────────────────────────────────────────────────

let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let buffer: WebGLBuffer | null = null
let uniforms: Record<string, WebGLUniformLocation | null> = {}

function compile(type: number, source: string): WebGLShader | null {
  if (!gl) return null
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function useProgram(preset: ShaderPreset): boolean {
  if (!gl) return false
  if (program) gl.deleteProgram(program)
  program = null
  const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_HEADER + PRESETS[preset].fragment)
  if (!vs || !fs) return false
  const next = gl.createProgram()
  if (!next) return false
  gl.attachShader(next, vs)
  gl.attachShader(next, fs)
  gl.linkProgram(next)
  // Linked programs keep what they need; the shader objects can go.
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(next, gl.LINK_STATUS)) {
    gl.deleteProgram(next)
    return false
  }
  program = next
  gl.useProgram(program)
  const at = gl.getAttribLocation(program, "p")
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(at)
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0)
  uniforms = {}
  for (const name of ["u_res", "u_time", "u_px", "u_k", "u_bg", "u_brand", "u_accent", "u_action", "u_ink"]) {
    uniforms[name] = gl.getUniformLocation(program, name)
  }
  sizeCanvas()
  return true
}

let pixelRatio = 1

function sizeCanvas() {
  const el = canvas.value
  if (!el) return
  const dpr = Math.min(weakEngine ? 1 : 2, window.devicePixelRatio || 1)
  pixelRatio = dpr * PRESETS[props.preset].scale
  const w = Math.max(1, Math.round(el.clientWidth * pixelRatio))
  const h = Math.max(1, Math.round(el.clientHeight * pixelRatio))
  if (el.width !== w || el.height !== h) {
    el.width = w
    el.height = h
  }
  gl?.viewport(0, 0, w, h)
}

let time = 0

function drawFrame() {
  if (!gl || !program || !current || !canvas.value) return
  const c = current
  gl.uniform2f(uniforms.u_res, canvas.value.width, canvas.value.height)
  gl.uniform1f(uniforms.u_time, time)
  gl.uniform1f(uniforms.u_px, pixelRatio)
  gl.uniform1f(uniforms.u_k, clamp01(props.intensity))
  gl.uniform3fv(uniforms.u_bg, c.surface)
  gl.uniform3fv(uniforms.u_brand, c.brand)
  gl.uniform3fv(uniforms.u_accent, c.accent)
  gl.uniform3fv(uniforms.u_action, c.action)
  gl.uniform3fv(uniforms.u_ink, c.ink)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

function giveUp(reason: "unavailable" | "slow" | "lost" | "compile") {
  failed.value = true
  emit("fallback", reason)
}

function onContextLost() {
  release()
  giveUp("lost")
}

function start() {
  const el = canvas.value
  if (!el || gl) return
  /*
   * `failIfMajorPerformanceCaveat` refuses a software rasteriser outright:
   * a CPU-drawn full-screen shader is exactly the load a backdrop must not
   * put on a machine that has no GPU to spare.
   */
  const context = el.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
    failIfMajorPerformanceCaveat: true,
  })
  if (!context) return giveUp("unavailable")
  gl = context
  el.addEventListener("webglcontextlost", onContextLost)
  buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  // One triangle that covers the whole viewport: cheaper than a quad, no seam.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  if (!useProgram(props.preset)) {
    release()
    return giveUp("compile")
  }
  intervals = []
  refreshPalette()
  drawFrame()
  shown.value = true
  sync()
}

/** Free the context and everything on it; the next start gets a fresh canvas. */
function release() {
  stop()
  shown.value = false
  const el = canvas.value
  el?.removeEventListener("webglcontextlost", onContextLost)
  if (gl) {
    if (program) gl.deleteProgram(program)
    if (buffer) gl.deleteBuffer(buffer)
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    canvasKey.value++
  }
  gl = null
  program = null
  buffer = null
  current = null
}

// ── Loop ────────────────────────────────────────────────────────────────────

let frame = 0
let running = false
let last = 0
let intervals: number[] = []

function tick(now: number) {
  frame = requestAnimationFrame(tick)
  const cap = weakEngine ? Math.min(props.fps, 24) : props.fps
  if (!frameDue(now, last, cap)) return
  const dt = last ? now - last : 0
  last = now
  // A long gap (a stalled tab) is skipped over, not caught up on.
  time += (Math.min(dt, 100) / 1000) * props.speed
  if (current && target) {
    const k = Math.min(1, dt / 160)
    for (const name of TOKENS) current[name] = approach(current[name], target[name], k)
  }
  drawFrame()
  // The first second of drawing decides whether the engine can carry it.
  if (dt > 0 && dt < 500 && intervals.length < 30) {
    intervals.push(dt)
    if (tooSlow(intervals, cap)) {
      release()
      giveUp("slow")
    }
  }
}

function stop() {
  running = false
  if (frame) cancelAnimationFrame(frame)
  frame = 0
}

function sync() {
  if (gl && animating.value) {
    if (running) return
    running = true
    last = 0
    frame = requestAnimationFrame(tick)
  } else stop()
}

// ── Observers ───────────────────────────────────────────────────────────────

let io: IntersectionObserver | undefined
let ro: ResizeObserver | undefined
let themeObserver: MutationObserver | undefined
let motionQuery: MediaQueryList | undefined
let schemeQuery: MediaQueryList | undefined

const onMotion = () => (reduced.value = prefersReducedMotion())
const onVisibility = () => (pageHidden.value = document.hidden)

onMounted(() => {
  probe = document.createElement("span")
  probe.style.display = "none"
  root.value?.appendChild(probe)

  io = new IntersectionObserver((entries) => {
    onScreen.value = entries.some((e) => e.isIntersecting)
  })
  if (root.value) io.observe(root.value)

  ro = new ResizeObserver(() => {
    sizeCanvas()
    drawFrame()
  })
  if (root.value) ro.observe(root.value)

  // Themes are applied as variables and attributes on <html>; a scheme switch can also come from the OS.
  themeObserver = new MutationObserver(() => {
    if (gl) refreshPalette()
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "data-theme", "data-theme-mode"] })
  schemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)")
  schemeQuery?.addEventListener("change", refreshPalette)
  motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)")
  motionQuery?.addEventListener("change", onMotion)
  document.addEventListener("visibilitychange", onVisibility)

  if (wantGl.value) start()
})

watch(wantGl, (on) => {
  if (on) requestAnimationFrame(start)
  else release()
})
watch(animating, sync)

/*
 * A new look fades the canvas out to the still of the new look (which has
 * crossfaded in underneath), swaps the shader there, and fades back in.
 */
let swapTimer = 0
watch(
  () => props.preset,
  (preset) => {
    if (!gl) return
    shown.value = false
    window.clearTimeout(swapTimer)
    swapTimer = window.setTimeout(() => {
      if (!gl) return
      if (!useProgram(preset)) {
        release()
        return giveUp("compile")
      }
      drawFrame()
      shown.value = true
    }, durationToken("duration-medium"))
  },
)
watch(
  () => props.intensity,
  () => {
    if (!running) drawFrame()
  },
)

onBeforeUnmount(() => {
  window.clearTimeout(swapTimer)
  release()
  io?.disconnect()
  ro?.disconnect()
  themeObserver?.disconnect()
  schemeQuery?.removeEventListener("change", refreshPalette)
  motionQuery?.removeEventListener("change", onMotion)
  document.removeEventListener("visibilitychange", onVisibility)
  probe?.remove()
})

const { class: rootClass, attrs: rest } = useMergedAttrs("pointer-events-none absolute inset-0 overflow-hidden bg-surface")
</script>

<template>
  <div ref="root" :class="rootClass" v-bind="rest" aria-hidden="true" :data-mode="shown ? 'gl' : 'css'">
    <Transition
      enter-active-class="transition-opacity duration-medium ease-out motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-medium ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div :key="preset" class="absolute inset-0">
        <div class="absolute inset-0 transition-opacity duration-medium" :style="fallbackStyle" />
      </div>
    </Transition>
    <canvas
      :key="canvasKey"
      ref="canvas"
      class="absolute inset-0 size-full transition-opacity duration-medium ease-out"
      :class="shown ? 'opacity-100' : 'opacity-0'"
    />
  </div>
</template>
