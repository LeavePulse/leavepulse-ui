<script setup lang="ts">
/*
 * A sample of something that is absent right now, for the tour and "what
 * changed" to point at: nobody left the server, no flag to show. Works like
 * LpSkeleton: the app puts its own markup inside (the real component with
 * made-up data), and the kit decides when it shows and how it looks.
 *
 *   <LpHintExample hint="branches.departures">
 *     <Departures :items="[sampleDeparture]" />
 *   </LpHintExample>
 *
 * It renders nothing until a tour step (or "Show me" on news) reaches that
 * hint id while the real element is not on the page; then the content eases
 * in, inert and hidden from assistive tech, with an "Example" tag, and leaves
 * when the step does. Being mounted is what tells the tour a sample exists, so
 * the registry entry needs nothing extra. The sample never counts as the real
 * control: it does not mark the feature seen or used.
 *
 * One sample can stand in for several steps that live in the same block (a
 * list and the detail beside it): pass the ids as an array and mark each part
 * with `data-lp-hint-part="id"`. The tour then points at that part, and the
 * sample stays put while the walk moves between them instead of shrinking and
 * growing back.
 *
 *   <LpHintExample :hint="['errors.list', 'errors.detail']">
 *     <div data-lp-hint-part="errors.list">...</div>
 *     <div data-lp-hint-part="errors.detail">...</div>
 *   </LpHintExample>
 *
 * `inline` is for a sample inside a row or a cell (an icon next to a name): a
 * span instead of a block, and no tag, which would not fit there. The tour
 * card still says it is an example.
 */
import { computed, watch } from "vue"
import { durationToken, easingToken, prefersReducedMotion } from "../composables/easing"
import { hints } from "../composables/useHints"
import HintSampleTag from "./HintSampleTag.vue"

const props = defineProps<{
  /** The hint id this stands in for, as in `v-hint`, or several for a sample with parts. */
  hint: string | string[]
  inline?: boolean
  labels?: Partial<{ badge: string }>
}>()

const ids = computed(() => (Array.isArray(props.hint) ? props.hint : [props.hint]))

// Offered only for the ids whose real element is absent: with it on the page
// the tour points there, and the card must not call it an example.
const absent = computed(() => ids.value.filter((id) => !hints.present(id)))

watch(
  () => absent.value.join(" "),
  (_, __, onCleanup) => {
    const releases = absent.value.map((id) => hints.registerExample(id))
    onCleanup(() => releases.forEach((release) => release()))
  },
  { immediate: true },
)

const visible = computed(() => absent.value.some((id) => hints.showingExample(id)))

// The block grows from nothing and shrinks back, so what sits below it glides
// instead of jumping. It exists only while shown: an always-present wrapper
// would take a gap in the parent's flex column even when empty.

function grow(el: Element, done: () => void, opening: boolean) {
  if (prefersReducedMotion()) return done()
  const box = el as HTMLElement
  const frames = [
    { height: "0px", opacity: 0 },
    { height: `${box.scrollHeight}px`, opacity: 1 },
  ]
  box.style.overflow = "hidden"
  box.animate(opening ? frames : frames.reverse(), {
    duration: durationToken("duration-medium"),
    easing: easingToken("ease-emphasized"),
  }).onfinish = () => {
    box.style.overflow = ""
    done()
  }
}
</script>

<template>
  <Transition
    v-if="inline"
    enter-active-class="transition-opacity duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
    leave-active-class="transition-opacity duration-[var(--duration-fast)] ease-out motion-reduce:transition-none"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <span v-if="visible" :data-lp-hint-example="ids.join(' ')" inert aria-hidden="true" class="inline-flex">
      <slot />
    </span>
  </Transition>
  <Transition
    v-else
    :css="false"
    @enter="(el, done) => grow(el, done, true)"
    @leave="(el, done) => grow(el, done, false)"
  >
    <div v-if="visible" :data-lp-hint-example="ids.join(' ')" inert aria-hidden="true" class="relative">
      <slot />
      <HintSampleTag :labels="labels" />
    </div>
  </Transition>
</template>
