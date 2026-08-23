<script setup lang="ts">
/*
 * A number whose DIGITS roll, like an odometer.
 *
 * Animating the value alone (count from 10k to 1M and reformat each frame) is
 * the obvious approach and the wrong one: the glyphs still hard-cut on every
 * frame, so it reads as a number being retyped very fast rather than as one
 * quantity moving. What makes it feel mechanical is that each COLUMN moves —
 * the ones place spins fast, the thousands crawl, and a digit that didn't
 * change doesn't move at all.
 *
 * So there are two layers:
 *
 *   value  — eased over time, and the digits are re-derived from it every frame,
 *            which is what makes the columns spin at different rates and lets
 *            the number pass through plausible in-between values.
 *   column — each digit is a 0–9 strip translated to the digit it shows. The
 *            strip is duplicated (0–9 twice) so a 9→0 step rolls forward into
 *            the next 0 instead of rewinding the long way round.
 *
 * Non-digit glyphs (separators, currency, the k/M suffix) are static cells that
 * simply fade in and out, so a number gaining a digit doesn't shuffle its
 * commas around.
 *
 *   <LpNumberFlow :value="online" />
 *   <LpNumberFlow :value="bytes" compact />          <!-- 1.2M -->
 *   <LpNumberFlow :value="eur" prefix="€" :decimals="2" grouped />
 */
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { easeOut, prefersReducedMotion } from "../composables/easing"
import { useReveal } from "../composables/useReveal"

const props = withDefaults(
  defineProps<{
    value: number
    /** Travel time in ms. Distance changes the feel, not the duration. */
    duration?: number
    /** Fixed decimal places. Ignored under `compact`. */
    decimals?: number
    /**
     * Abbreviate large numbers — 1.2k, 3.4M. Off by default: an exact figure
     * should stay exact unless asked otherwise.
     */
    compact?: boolean
    /** Thousands separators. Ignored under `compact`. */
    grouped?: boolean
    prefix?: string
    suffix?: string
    /** Custom formatter; overrides compact/decimals/grouped entirely. */
    format?: (v: number) => string
    /** Start from 0 on first render rather than showing the value outright. */
    animateOnMount?: boolean
    locale?: string
    /**
     * Force the roll direction: "up" and "down" make every column travel the
     * same way regardless of the digit, which reads as one mechanism turning.
     * "auto" lets each column take the shorter route.
     */
    trend?: "auto" | "up" | "down"
  }>(),
  { duration: 700, decimals: 0, animateOnMount: true, trend: "auto" },
)

const displayed = ref(props.animateOnMount ? 0 : props.value)
let frame = 0

/*
 * While a change is in flight the row is padded to the WIDER of where it came
 * from and where it is going, with leading zeros. Without this, 42 → 1,000,000
 * grows a column at a time as the value climbs past each power of ten: the row
 * jitters, and every column to its left restarts its roll. Holding the width
 * means the new places are already there, spinning up from zero like the wheels
 * of an odometer that has not reached them yet. The padding is dropped the
 * moment the value settles, so a resting number is never shown as 0,015,800.
 */
const padTo = ref(0)
const settled = ref(true)

const integerDigits = (v: number) => {
  const abs = Math.floor(Math.abs(v))
  return abs === 0 ? 1 : Math.floor(Math.log10(abs)) + 1
}

const stop = () => {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
}

/*
 * How many decimals the journey is allowed to show.
 *
 * A custom `format` is free to render fractions of its own — formatTick, for
 * one, falls back to two places — and a travelling value is fractional on
 * almost every frame. So a hop between two whole numbers (412 GB → 186 GB) grew
 * a ".16" out of nowhere, churned through it for the whole flight, and dropped
 * it again at the end: digits appearing and vanishing that neither endpoint
 * has, and a row whose width jumps with them.
 *
 * Rounding the value BEFORE formatting keeps the shape the endpoints imply. The
 * endpoints decide: if either is fractional the fraction is real and stays.
 */
const decimalsOf = (v: number) => {
  if (Number.isInteger(v)) return 0
  const s = String(v)
  const dot = s.indexOf(".")
  if (dot === -1) return 0
  return Math.min(6, s.length - dot - 1)
}

const journeyDecimals = ref(0)

/* The value last aimed at — the previous leg's destination, which is a real
   endpoint, unlike the interpolated position a new leg starts from. */
let lastTarget = props.animateOnMount ? 0 : props.value

/** Snap an in-flight value to the precision the endpoints justify. */
const round = (v: number) => {
  const p = journeyDecimals.value
  if (p <= 0) return Math.round(v)
  const f = 10 ** p
  return Math.round(v * f) / f
}

const travel = (to: number) => {
  stop()
  const from = displayed.value
  if (from === to) return

  if (prefersReducedMotion() || props.duration <= 0) {
    displayed.value = to
    return
  }

  /*
   * Compact notation rolls its own scale over, so it needs no padding; the plain
   * and grouped forms do, because there the integer part is what grows.
   *
   * An interrupted flight must not SHRINK the row: a change arriving mid-travel
   * starts from a value that is already wide, and recomputing the pad from
   * scratch would drop columns that are still visibly spinning. The widest
   * requirement so far wins until the number finally settles.
   */
  // Width, like precision, is measured against the endpoints — but here the
  // live value counts too: a leg interrupted at 873 must not shed the column it
  // is currently using just because both destinations are shorter.
  padTo.value = props.compact
    ? 0
    : Math.max(padTo.value, integerDigits(from), integerDigits(to))
  /*
   * Precision comes from the DESTINATIONS, never from where the value happens
   * to be right now. `from` is the live displayed value, and interrupting a
   * flight mid-way — hovering a slice, flicking to empty space, back again —
   * leaves it on something like 873.71. Reading its decimals then licensed two
   * places for the whole next leg, so rapid hovering made fractions appear on a
   * chart whose every figure is whole.
   *
   * The previous target is kept instead: whole → whole shows no fraction, and a
   * genuinely fractional endpoint still keeps its places. An explicit `decimals`
   * wins outright — a caller asking for two places wants them on every frame.
   */
  journeyDecimals.value = Math.max(
    props.decimals,
    decimalsOf(lastTarget),
    decimalsOf(to),
  )
  lastTarget = to
  settled.value = false

  const started = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - started) / props.duration)
    /*
     * Two curves are at work and they must not both be hard. This one moves the
     * VALUE, which is what makes the columns spin; the WHEELS then settle onto
     * their digits on --ease-settle. A steep curve here is nearly done by the
     * halfway point, so the spinning ends before it registers and the rest of
     * the duration is a number that has stopped moving without having landed.
     * The gentle shared curve keeps the columns turning the whole way and
     * leaves the sense of arrival to the wheels, where it belongs.
     */
    displayed.value = from + (to - from) * easeOut(t)
    if (t < 1) frame = requestAnimationFrame(step)
    else {
      // Land exactly: an eased fraction never quite reaches 1.
      displayed.value = to
      settled.value = true
      padTo.value = 0
      frame = 0
    }
  }
  frame = requestAnimationFrame(step)
}

/*
 * The count-up waits for the number to be on screen.
 *
 * `animateOnMount` says the figure should be seen ARRIVING at its value rather
 * than simply being there — and a count-up that ran while the tile was below
 * the fold delivers the opposite: the reader scrolls to a number that is
 * already resting, having missed the one thing the prop was asking for. A stat
 * tile is the common case, and a dashboard is a column of them.
 *
 * Later changes are not gated. A value that updates while the user is on the
 * page is news, and it should roll whether or not it is in view — the reveal
 * governs the FIRST reading only.
 */
const { el: revealAnchor, revealed } = useReveal({ immediate: () => !props.animateOnMount })

watch(revealed, (visible) => {
  if (visible && props.animateOnMount) travel(props.value)
}, { immediate: true })

watch(() => props.value, travel)
onBeforeUnmount(stop)

const UNITS = [
  { limit: 1e9, suffix: "B" },
  { limit: 1e6, suffix: "M" },
  { limit: 1e3, suffix: "k" },
] as const

const scaleFor = (v: number) => {
  const abs = Math.abs(v)
  const unit = UNITS.find((u) => abs >= u.limit)
  if (!unit) return { divisor: 1, suffix: "", decimals: 0 }
  // One decimal is what makes 1.2k readable; a value that lands exactly on the
  // unit (5M) keeps none, matching how these are written by hand.
  const scaled = v / unit.limit
  return {
    divisor: unit.limit,
    suffix: unit.suffix,
    decimals: Number.isInteger(scaled) ? 0 : 1,
  }
}


const formatted = computed(() => {
  // Rounded first: every branch below should render the shape the endpoints
  // imply, not whatever precision an intermediate value happens to carry.
  const v = round(displayed.value)
  if (props.format) return props.format(v)
  if (props.compact) {
    /*
     * The unit tracks the CURRENT value, not the destination — the way a real
     * odometer rolls over into the next scale. Pinning it to the target instead
     * prints "0M" for most of a climb from 42, and pinning it to the source
     * prints "42000k"; following the value gives 42 → 999 → 1.0k → 999.9k →
     * 1.0M, where every frame is a number someone would actually write.
     *
     * The decimal count is what stays fixed: one place whenever a unit is in
     * play, so the row's shape only changes at a rollover, not on every frame.
     */
    const { divisor, suffix } = scaleFor(v)
    const places = divisor === 1 ? 0 : 1
    return `${(v / divisor).toFixed(places)}${suffix}`
  }
  const pad = settled.value ? 1 : Math.max(1, padTo.value)
  if (props.grouped)
    return v.toLocaleString(props.locale, {
      minimumFractionDigits: props.decimals,
      maximumFractionDigits: props.decimals,
      minimumIntegerDigits: pad,
    })

  const text = v.toFixed(props.decimals)
  if (pad <= 1) return text
  // toFixed has no padding option; widen the integer part by hand.
  const neg = text.startsWith("-")
  const body = neg ? text.slice(1) : text
  const dot = body.indexOf(".")
  const int = dot === -1 ? body : body.slice(0, dot)
  const rest = dot === -1 ? "" : body.slice(dot)
  return `${neg ? "-" : ""}${int.padStart(pad, "0")}${rest}`
})

interface Cell {
  /** Stable across renders so a column keeps its identity as digits shift. */
  key: string
  digit: number | null
  char: string
  /** A leading zero held open for a column the value hasn't reached yet. */
  isPad: boolean
}

/*
 * Cells are keyed by PLACE, not by position in the string, so that a column
 * keeps its identity as the number grows: the ones place stays the ones place
 * whether the value is 42 or 1,000,000, and only the columns that genuinely
 * appear are animated in.
 *
 * The place is counted from the decimal point (or the end), skipping non-digits
 * — grouping separators must not consume a place, or every column left of one
 * would shift by one and re-animate on 999→1,000.
 *
 * Non-digits are keyed by their own character as well as their place. A compact
 * suffix is the reason: 4.1k and 15.8k put "k" at different offsets, and a
 * purely positional key let the old "k" inherit a digit's column — the number
 * rendered as "11k.2k" for a frame mid-transition.
 *
 * The TRAILING run of non-digits is the exception: it is keyed by its role, not
 * its text, so the unit occupies one column across a rollover. Keyed by
 * character, "k" and "M" were two separate cells and both were on screen while
 * one animated out — the row read "1654.3kM" crossing a million.
 */
const cells = computed<Cell[]>(() => {
  const chars = [...formatted.value]
  const dot = chars.indexOf(".")
  const intEnd = dot === -1 ? chars.length : dot

  const isDigit = (c: string) => {
    const code = c.charCodeAt(0)
    return code >= 48 && code <= 57
  }

  // Where the trailing unit/suffix begins, if any.
  let suffixStart = chars.length
  while (suffixStart > 0 && !isDigit(chars[suffixStart - 1])) suffixStart--

  // Integer places, right to left.
  const keys: string[] = new Array(chars.length)
  let place = 0
  for (let i = intEnd - 1; i >= 0; i--) {
    keys[i] = isDigit(chars[i]) ? `i${place++}` : `s${place}-${chars[i]}`
  }
  // Fraction places, left to right after the point.
  place = 0
  for (let i = intEnd; i < chars.length; i++) {
    keys[i] = isDigit(chars[i]) ? `f${place++}` : `t${place}-${chars[i]}`
  }
  // The trailing unit keeps ONE column whatever it says, so "k" and "M" swap in
  // place at a rollover instead of briefly sitting side by side.
  for (let i = suffixStart; i < chars.length; i++) keys[i] = `u${i - suffixStart}`

  // Padding zeros are structure, not value: they hold the column open while the
  // number climbs into it, so they are dimmed rather than read as digits.
  let leading = !settled.value
  return chars.map((char, i) => {
    const digit = isDigit(char) ? char.charCodeAt(0) - 48 : null
    const isPad = leading && digit === 0 && i < intEnd - 1
    if (digit !== null && digit !== 0) leading = false
    return { key: keys[i], digit, char, isPad }
  })
})

/*
 * The strip holds 0–9 twice. Which copy a digit points at decides the travel
 * direction: staying inside one copy rolls the short way, stepping into the
 * second copy always rolls forward — the way an odometer wheel never spins
 * backwards through the 9.
 */
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const STRIP = [...DIGITS, ...DIGITS]

const offsetFor = (digit: number) => {
  if (props.trend === "up") return digit
  if (props.trend === "down") return digit + 10
  return digit
}

const label = computed(
  () => `${props.prefix ?? ""}${props.value}${props.suffix ?? ""}`,
)
</script>

<template>
  <!-- One accessible reading of the real value; the moving parts are hidden
       from assistive tech, which would otherwise announce every frame. -->
  <span
    ref="revealAnchor"
    class="lp-nf inline-flex items-baseline tabular-nums"
    :aria-label="label"
    role="text"
  >
    <span v-if="prefix" aria-hidden="true">{{ prefix }}</span>

    <span class="lp-nf__track inline-flex items-baseline" aria-hidden="true">
      <TransitionGroup name="lp-nf-cell">
        <span
          v-for="cell in cells"
          :key="cell.key"
          class="lp-nf__cell"
          :class="cell.isPad ? 'lp-nf__cell--pad' : ''"
        >
          <!-- A digit is a window onto its strip; a separator is just a glyph. -->
          <template v-if="cell.digit !== null">
            <span
              class="lp-nf__strip"
              :style="{ transform: `translateY(${-offsetFor(cell.digit) * 5}%)` }"
            >
              <span v-for="(d, i) in STRIP" :key="i" class="lp-nf__digit">{{ d }}</span>
            </span>
            <!-- Reserves the column's width without being visible: the strip is
                 absolutely positioned and would otherwise collapse the cell. -->
            <span class="lp-nf__ghost">0</span>
          </template>
          <template v-else>{{ cell.char }}</template>
        </span>
      </TransitionGroup>
    </span>

    <span v-if="suffix" aria-hidden="true">{{ suffix }}</span>
  </span>
</template>

<style>
/*
 * Unscoped: TransitionGroup applies its classes to elements Vue moves and
 * clones, which a scoped attribute selector doesn't reliably reach. Everything
 * is namespaced under .lp-nf.
 */
/*
 * Fades the top and bottom of every column, so a digit rolls in and out of a
 * window rather than appearing at a hard edge.
 *
 * In PIXELS, not percentages. A percentage fade scales with the row: at 18% it
 * ate 2.4px off a 13.2px line, which on small text read as a shadow lying over
 * the digits rather than as a window they pass through. A fixed 2px looks the
 * same at every size, and only ever touches the sliver where a digit is
 * genuinely entering or leaving.
 */
.lp-nf__track {
  --lp-nf-fade: 2px;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--lp-nf-fade),
    #000 calc(100% - var(--lp-nf-fade)),
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--lp-nf-fade),
    #000 calc(100% - var(--lp-nf-fade)),
    transparent 100%
  );
}

/*
 * The cell INHERITS its line box rather than declaring one. A fixed 1.1 made
 * the digits 13.2px tall next to 16px text in the same row, so the two sat on
 * different baselines and the number read as floating above the words beside
 * it. Sharing the inherited line-height puts them on one baseline at any size.
 */
.lp-nf__cell {
  position: relative;
  display: inline-block;
  overflow: hidden;
  /* A formatter may put a space before its unit ("412 GB"); inline-flex would
     collapse it away, gluing the unit to the number. */
  white-space: pre;
}

/*
 * The strip is as tall as its 20 entries and hangs from the top of the cell —
 * NOT stretched to the cell's height, or each entry would be a twentieth of a
 * line tall. Percentages on `translateY` resolve against the strip's own
 * height, so one entry is 5% of it: digit N sits at -N × 5%.
 */
.lp-nf__strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  /* Per-instance, so a counter whose VALUE is already being animated from
     outside can shorten the wheel's own spin and stop lagging behind it. */
  /* Settles rather than stops: the wheel carries a hair past its digit and
     drifts back, so a column reads as a mechanism coming to rest. */
  transition: transform var(--lp-nf-spin, var(--duration-slow, 320ms))
    var(--ease-settle);
  will-change: transform;
}

/* Each strip entry is exactly one line box tall, so translating by -N × 5%
   (one twentieth of the 20-entry strip) lands digit N in the window. */
.lp-nf__digit {
  line-height: inherit;
}

.lp-nf__ghost {
  visibility: hidden;
}

/* Faded, so a held-open column reads as an empty wheel rather than a zero the
   number actually has. */
.lp-nf__cell--pad {
  opacity: 0.18;
  transition: opacity var(--duration-fast, 160ms) linear;
}

/*
 * Columns fade rather than grow. Animating `max-width` here was the cause of
 * the row jittering whenever the digit count changed: the width tween fought
 * the layout while the value was still climbing, so the whole number shuffled
 * sideways and every wheel restarted. The padding above now reserves the space
 * up front, which leaves these transitions with only the appearance of a
 * column to handle — and that is a fade.
 */
.lp-nf-cell-enter-active,
.lp-nf-cell-leave-active {
  transition: opacity var(--duration-fast, 160ms) linear;
}

.lp-nf-cell-enter-from,
.lp-nf-cell-leave-to {
  opacity: 0;
}

/* Out of flow while leaving, so the settled row closes up without a reflow
   jump at the end of the transition. */
.lp-nf-cell-leave-active {
  position: absolute;
}

@media (prefers-reduced-motion: reduce) {
  .lp-nf__strip,
  .lp-nf-cell-enter-active,
  .lp-nf-cell-leave-active {
    transition: none;
  }
}
</style>
