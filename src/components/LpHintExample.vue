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
 * `inline` is for a sample inside a row or a cell (an icon next to a name): a
 * span instead of a block, and no tag, which would not fit there. The tour
 * card still says it is an example.
 */
import { computed, watch } from "vue"
import { easingToken, prefersReducedMotion } from "../composables/easing"
import { hints } from "../composables/useHints"
import { useLabels } from "../composables/useLpConfig"

const props = defineProps<{
  /** The hint id this stands in for, as in `v-hint`. */
  hint: string
  inline?: boolean
  labels?: Partial<{ badge: string }>
}>()

const labels = useLabels("hintExample", { badge: "Example" }, () => props.labels)

watch(
  () => props.hint,
  (id, _, onCleanup) => onCleanup(hints.registerExample(id)),
  { immediate: true },
)

const visible = computed(() => hints.showingExample(props.hint) && !hints.present(props.hint))

// The block grows from nothing and shrinks back, so what sits below it glides
// instead of jumping. It exists only while shown: an always-present wrapper
// would take a gap in the parent's flex column even when empty.
function duration(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--duration-medium").trim()
  return Number.parseFloat(raw) || 220
}

function grow(el: Element, done: () => void, opening: boolean) {
  if (prefersReducedMotion()) return done()
  const box = el as HTMLElement
  const frames = [
    { height: "0px", opacity: 0 },
    { height: `${box.scrollHeight}px`, opacity: 1 },
  ]
  box.style.overflow = "hidden"
  box.animate(opening ? frames : frames.reverse(), {
    duration: duration(),
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
    <span v-if="visible" :data-lp-hint-example="hint" inert aria-hidden="true" class="inline-flex">
      <slot />
    </span>
  </Transition>
  <Transition
    v-else
    :css="false"
    @enter="(el, done) => grow(el, done, true)"
    @leave="(el, done) => grow(el, done, false)"
  >
    <div v-if="visible" :data-lp-hint-example="hint" inert aria-hidden="true" class="relative">
      <slot />
      <span
        class="pointer-events-none absolute -top-2 right-3 z-10 rounded-pill border border-brand/40 bg-surface-raised px-1.5 py-px text-[10px] font-medium tracking-wide text-brand"
      >{{ labels.badge }}</span>
    </div>
  </Transition>
</template>
