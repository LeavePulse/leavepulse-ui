<script lang="ts">
// The root class is merged with the consumer's (useMergedAttrs).
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Text typed out a character at a time, optionally cycling through several
 * strings: type, hold, erase, type the next.
 *
 * For a line that suggests rather than states: the examples a search box can
 * take ("Search servers", "Search logs", "Search people"), a hero line naming
 * what a product does, a terminal-styled empty state. Not for anything the
 * reader has to read to continue: it makes them wait for it.
 *
 *   <LpTypewriter text="Hello, operator." />
 *   <LpTypewriter :text="['servers', 'logs', 'people']" loop />
 *
 * Keystrokes are uneven and pause after punctuation, so it reads as typing and
 * not as a progress bar. Erasing stops at what the next string shares with the
 * current one ("Search logs" to "Search people" erases only "logs").
 *
 * The box reserves the size of the longest string, so the line it sits in
 * does not jump as characters come and go. `reserve` off lets it take the
 * width of what is typed, for text that runs on in a sentence.
 *
 * Screen readers hear whole strings, never characters: a polite live region
 * gets each string once it is fully typed. It starts typing the first time it
 * is on screen and pauses while it is off screen or the tab is hidden. Under
 * reduced motion whole strings appear and swap without typing.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import { useInView } from "../composables/useInView"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useReveal } from "../composables/useReveal"
import { graphemes } from "./scramble"
import { typewriterNext, typewriterStart, type TypewriterState } from "./typewriter"

const props = withDefaults(
  defineProps<{
    /** One string, or several to cycle through. */
    text: string | string[]
    /** Ms per character, before the natural unevenness. */
    speed?: number
    /** Ms per erased character. */
    eraseSpeed?: number
    /** Ms a finished string stays before it is erased. */
    hold?: number
    /** Ms before the first keystroke, once it is on screen. */
    startDelay?: number
    /** After the last string, start over from the first. Without it the last string stays. */
    loop?: boolean
    /** Show the caret. */
    caret?: boolean
    /** Reserve the longest string's size so the surroundings hold still. */
    reserve?: boolean
    /** Hold it until true. Leave unset to start the first time it is on screen. */
    play?: boolean
    /** Element to render. */
    as?: string
  }>(),
  {
    speed: 55,
    eraseSpeed: 28,
    hold: 1800,
    startDelay: 0,
    loop: false,
    caret: true,
    reserve: true,
    play: undefined,
    as: "span",
  },
)

const emit = defineEmits<{
  /** A string has been typed out in full. */
  typed: [index: number, text: string]
  /** The last string is typed and nothing more will happen (never fires with `loop`). */
  finished: []
}>()

const { class: rootClass, attrs: rest } = useMergedAttrs(
  () => "lp-typewriter relative inline-grid whitespace-pre-wrap align-bottom",
)

const strings = computed(() => (Array.isArray(props.text) ? props.text : [props.text]))
const split = computed(() => strings.value.map((s) => graphemes(s)))

const state = ref<TypewriterState>(typewriterStart())
const visible = computed(() => (split.value[state.value.index] ?? []).slice(0, state.value.length).join(""))
const announced = ref(strings.value[0] ?? "")
const idle = computed(() => state.value.phase === "holding" || state.value.phase === "done")

const { el: revealEl, revealed } = useReveal({ immediate: () => props.play !== undefined })
const { el: viewEl, inView } = useInView()
const setRoot = (node: unknown) => {
  const element = node instanceof Element ? node : null
  revealEl.value = element
  viewEl.value = element
}
const running = computed(() => (props.play ?? revealed.value) && inView.value)

let timer: ReturnType<typeof setTimeout> | undefined
// Time left on the step a pause interrupted, so going off screen mid-hold and
// back does not restart the hold from zero or skip it.
let pendingWait: number | null = null
let dueAt = 0
let started = false

function schedule(wait: number) {
  clearTimeout(timer)
  timer = undefined
  if (!Number.isFinite(wait)) return
  pendingWait = wait
  if (!running.value) return
  dueAt = performance.now() + wait
  timer = setTimeout(tick, wait)
}

function tick() {
  timer = undefined
  pendingWait = null
  const options = { speed: props.speed, eraseSpeed: props.eraseSpeed, hold: props.hold, loop: props.loop }
  let step = typewriterNext(state.value, split.value, options)
  if (prefersReducedMotion()) {
    // Whole strings: run the keystrokes of this phase at once and keep only
    // the waits that are holds.
    let guard = 0
    while (step.typed === undefined && Number.isFinite(step.wait) && guard++ < 10_000) {
      step = typewriterNext(step.state, split.value, options)
    }
  }
  state.value = step.state
  if (step.typed !== undefined) {
    const text = strings.value[step.typed] ?? ""
    announced.value = text
    emit("typed", step.typed, text)
    if (step.state.phase === "done") emit("finished")
  }
  if (step.wait === 0) return tick()
  schedule(step.wait)
}

watch(
  running,
  (now) => {
    if (!now) {
      if (timer) pendingWait = Math.max(0, dueAt - performance.now())
      clearTimeout(timer)
      timer = undefined
      return
    }
    if (!started) {
      started = true
      return schedule(prefersReducedMotion() ? 0 : props.startDelay)
    }
    if (pendingWait !== null) schedule(pendingWait)
  },
  { immediate: true },
)

// New strings: erase back to what the new first string shares, then type it.
watch(
  () => strings.value.join("\u0000"),
  () => {
    if (!started) return
    const index = Math.min(state.value.index, split.value.length - 1)
    state.value = { index: Math.max(0, index), length: Math.min(state.value.length, split.value[index]?.length ?? 0), phase: "erasing", to: 0 }
    schedule(props.eraseSpeed)
  },
)

watch(
  () => props.loop,
  (loop) => {
    if (loop && state.value.phase === "done") {
      state.value = { ...state.value, phase: "holding" }
      schedule(props.hold)
    }
  },
)

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <component :is="as" :ref="setRoot" :class="rootClass" v-bind="rest">
    <span class="sr-only" aria-live="polite">{{ announced }}</span>
    <!-- The zero-width space keeps a baseline while nothing is typed yet, so
         the empty box does not sink below the text around it. -->
    <span aria-hidden="true" class="[grid-area:1/1]"
      >&#8203;{{ visible
      }}<span
        v-if="caret"
        class="lp-typewriter__caret"
        :class="idle ? 'lp-typewriter__caret--blink' : ''"
    /></span>
    <template v-if="reserve">
      <span v-for="(s, i) in strings" :key="i" aria-hidden="true" class="invisible [grid-area:1/1]"
        >{{ s }}<span v-if="caret" class="lp-typewriter__caret"
      /></span>
    </template>
  </component>
</template>

<style>
.lp-typewriter__caret {
  display: inline-block;
  width: 0.08em;
  min-width: 2px;
  height: 1.05em;
  margin-inline-start: 0.06em;
  vertical-align: -0.15em;
  border-radius: 1px;
  background: var(--color-brand);
}

/* Solid while keys are moving, blinking while it waits: the same cue a real
   text field gives about whether input is happening. */
.lp-typewriter__caret--blink {
  animation: lp-typewriter-blink 1.06s step-end infinite;
}

@keyframes lp-typewriter-blink {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-typewriter__caret--blink {
    animation: none;
  }
}
</style>
