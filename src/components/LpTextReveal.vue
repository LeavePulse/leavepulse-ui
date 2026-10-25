<script lang="ts">
// The root class is merged with the consumer's (useMergedAttrs).
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Text that arrives word by word (or letter by letter): each piece fades in,
 * rises a few pixels and comes into focus, one after another.
 *
 * For a line that is the point of the screen: a hero heading, an empty state's
 * message, a result that was just computed. On body copy it only slows reading
 * down, so it is not a default for text in general.
 *
 *   <LpTextReveal text="Your server is ready" as="h2" />
 *   <LpTextReveal :text="summary" by="letter" :stagger="15" />
 *
 * It plays the first time the text is on screen (useReveal), not at mount, so
 * a heading below the fold is still arriving when it is scrolled to. `play`
 * takes over when the moment is the app's to decide (a step becoming active),
 * and a new `replayKey` plays it again.
 *
 * When `text` changes, the words that stay keep their place and do not replay:
 * the words that are gone fade out, the new ones arrive in their spot. A status
 * line going from "3 builds running" to "4 builds running" moves one word, not
 * the whole sentence.
 *
 * Screen readers get the whole string once; the split pieces are hidden from
 * them, so the sentence is not read as a list of separate words. The pieces
 * are inline boxes separated by real spaces, so the text wraps like any other.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useReveal } from "../composables/useReveal"
import { splitText, wordKeys, type TextPiece } from "./textSplit"

const props = withDefaults(
  defineProps<{
    /** The text. A change animates only the words that changed. */
    text: string
    /** The unit that animates. Letters suit a short heading; words read better on a sentence. */
    by?: "word" | "letter"
    /** Delay between pieces in ms. Defaults to 70 for words, 22 for letters. */
    stagger?: number
    /** Each piece's entrance in ms. */
    duration?: number
    /** How far a piece rises, in px. 0 for a pure fade. */
    rise?: number
    /** Start out of focus and sharpen. Off for long text on a slow machine, where a blur per piece costs frames. */
    blur?: boolean
    /**
     * Hold the text hidden until true. Leave unset to play the first time the
     * text is on screen.
     */
    play?: boolean
    /** Changing this plays the whole text again (the old one fades out first). */
    replayKey?: unknown
    /** Element to render: `h1`…`h6` or `p` for a heading or a paragraph. */
    as?: string
  }>(),
  { by: "word", duration: 560, rise: 8, blur: true, play: undefined, as: "span" },
)

const emit = defineEmits<{
  /** The last piece has arrived. */
  done: []
}>()

const { class: rootClass, attrs: rest } = useMergedAttrs(() => "lp-reveal")

const LEAVE_MS = 180

const { el, revealed } = useReveal({ immediate: () => props.play !== undefined })
const ready = computed(() => props.play ?? revealed.value)

const shown = ref(props.text)
const generation = ref(0)
const pieces = computed<TextPiece[]>(() =>
  splitText(shown.value, props.by).map((p) => ({ ...p, key: `${generation.value}:${p.key}` })),
)
// The words that animate in on this pass; everything else stays as it is.
const fresh = ref<Set<string>>(wordKeys(pieces.value))
const leaving = ref<Set<string>>(new Set())

const stagger = computed(() => props.stagger ?? (props.by === "letter" ? 22 : 70))

// The position of each fresh part in the cascade. Counted over fresh parts only,
// so a single changed word in a long line starts at once instead of waiting for
// the words before it.
const order = computed(() => {
  const map = new Map<string, number>()
  let i = 0
  for (const piece of pieces.value) {
    if (piece.kind !== "word" || !fresh.value.has(piece.key)) continue
    map.set(piece.key, i)
    i += piece.parts.length
  }
  return { map, count: i }
})

let leaveTimer: ReturnType<typeof setTimeout> | undefined
let doneTimer: ReturnType<typeof setTimeout> | undefined

function scheduleDone() {
  clearTimeout(doneTimer)
  if (!ready.value) return
  const count = order.value.count
  const ms = prefersReducedMotion() || count === 0 ? 0 : props.duration + stagger.value * (count - 1)
  doneTimer = setTimeout(() => emit("done"), ms)
}

function apply(text: string, bump: boolean) {
  const before = wordKeys(pieces.value)
  if (bump) generation.value++
  shown.value = text
  const after = wordKeys(pieces.value)
  // Before the reveal everything is still to come; after it, only what is new.
  fresh.value = ready.value ? new Set([...after].filter((k) => !before.has(k))) : after
  leaving.value = new Set()
  scheduleDone()
}

function change(text: string, bump: boolean) {
  clearTimeout(leaveTimer)
  if (!ready.value || prefersReducedMotion()) return apply(text, bump)
  const next = new Set(
    splitText(text, props.by).map((p) => `${generation.value + (bump ? 1 : 0)}:${p.key}`),
  )
  const gone = [...wordKeys(pieces.value)].filter((k) => !next.has(k))
  if (!gone.length) return apply(text, bump)
  leaving.value = new Set(gone)
  leaveTimer = setTimeout(() => apply(text, bump), LEAVE_MS)
}

watch(() => props.text, (text) => change(text, false))
watch(() => props.replayKey, () => change(props.text, true))
watch(() => props.by, () => apply(props.text, true))
watch(ready, (now) => now && scheduleDone(), { immediate: true })

onBeforeUnmount(() => {
  clearTimeout(leaveTimer)
  clearTimeout(doneTimer)
})

const style = computed(() => ({
  "--lp-reveal-duration": `${props.duration}ms`,
  "--lp-reveal-stagger": `${stagger.value}ms`,
  "--lp-reveal-rise": `${props.rise}px`,
  "--lp-reveal-blur": props.blur ? "4px" : "0px",
  "--lp-reveal-leave": `${LEAVE_MS}ms`,
}))

// A leaving word drops its entrance: an animation's fill outranks the fade-out
// declaration, and the word would stay fully visible until it is removed.
function partClass(key: string) {
  if (leaving.value.has(key)) return "lp-reveal__part lp-reveal__part--out"
  return ready.value && fresh.value.has(key) ? "lp-reveal__part lp-reveal__part--in" : "lp-reveal__part"
}
</script>

<template>
  <component
    :is="as"
    ref="el"
    :class="[rootClass, ready ? '' : 'lp-reveal--waiting']"
    :style="style"
    v-bind="rest"
  >
    <span class="sr-only">{{ text }}</span>
    <span aria-hidden="true"
      ><template v-for="piece in pieces" :key="piece.key"
        ><template v-if="piece.kind === 'space'">{{ piece.text }}</template
        ><span
          v-else-if="by === 'word'"
          :class="partClass(piece.key)"
          :style="{ '--lp-reveal-i': order.map.get(piece.key) ?? 0 }"
          >{{ piece.text }}</span
        ><span
          v-else
          class="inline-block whitespace-nowrap"
          :class="leaving.has(piece.key) ? 'lp-reveal__part--out' : ''"
          ><span
            v-for="(letter, j) in piece.parts"
            :key="j"
            :class="leaving.has(piece.key) ? 'lp-reveal__part' : partClass(piece.key)"
            :style="{ '--lp-reveal-i': (order.map.get(piece.key) ?? 0) + j }"
            >{{ letter }}</span
          ></span
        ></template
      ></span
    >
  </component>
</template>

<style>
/* Unscoped and namespaced, like LpRollingText: the classes are toggled on
   elements rendered inside a v-for of fragments. */
.lp-reveal__part {
  display: inline-block;
}

.lp-reveal--waiting .lp-reveal__part {
  opacity: 0;
}

.lp-reveal__part--in {
  animation: lp-reveal-in var(--lp-reveal-duration) var(--ease-emphasized) both;
  animation-delay: calc(var(--lp-reveal-i, 0) * var(--lp-reveal-stagger));
}

.lp-reveal__part--out {
  opacity: 0;
  filter: blur(var(--lp-reveal-blur));
  transition:
    opacity var(--lp-reveal-leave) ease-in,
    filter var(--lp-reveal-leave) ease-in;
}

@keyframes lp-reveal-in {
  from {
    opacity: 0;
    transform: translateY(var(--lp-reveal-rise));
    filter: blur(var(--lp-reveal-blur));
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-reveal__part--in {
    animation: none;
  }
  .lp-reveal__part--out {
    transition: none;
  }
}
</style>
