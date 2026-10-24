<script setup lang="ts">
/*
 * Drop-in onboarding: put it once next to the app's root, hand it a hint
 * system, and the tour offer, the "new" dots, "what changed" and nudges all
 * work. Nothing to wire per page beyond `v-hint` on the elements.
 *
 * It must never cost the page itself. Any error thrown inside (a tour step's
 * `enter`, a storage that rejects, a target that misbehaves) switches the layer
 * off for the session and is logged once; the page under it keeps working.
 */
import { computed, onBeforeUnmount, onErrorCaptured, onMounted, ref, unref, watch } from "vue"
import { provideHintSystem, type HintSystem } from "../composables/useHintSystem"
import { useLabels } from "../composables/useLpConfig"
import LpActionBar, { type ActionBarAction } from "./LpActionBar.vue"
import LpHintLayer from "./LpHintLayer.vue"
import LpTour from "./LpTour.vue"

const props = defineProps<{
  system: HintSystem
  labels?: Partial<typeof DEFAULT_LABELS>
}>()

const DEFAULT_LABELS = {
  tourTitle: "New to {page}?",
  tourText: "A one-minute look at what you can do here.",
  assignedTitle: "You were asked to look at {page}",
  assignedText: "A short tour of this page, about a minute.",
  newsTitle: "What changed: {page}",
  show: "Show me",
  notNow: "Not now",
  never: "Don't offer again",
  gotIt: "Got it",
  noThanks: "No thanks",
}
const labels = useLabels("hints", DEFAULT_LABELS, () => props.labels)

provideHintSystem(props.system)

const broken = ref(false)
onErrorCaptured((error) => {
  if (!broken.value) console.warn("[LpHints] disabled after an error:", error)
  broken.value = true
  props.system.stop()
  return false
})

onMounted(() => {
  try {
    props.system.start()
    if (!props.system.state.loaded) void props.system.load()
  } catch (error) {
    broken.value = true
    console.warn("[LpHints] disabled after an error:", error)
  }
})
onBeforeUnmount(() => props.system.stop())

const state = props.system.state
const fresh = computed(() => unref(props.system.fresh))
const notes = computed(() => unref(props.system.notes))
watch(() => [state.tour.open, state.tour.step] as const, ([open, step]) => open && props.system.tourShown(step))

const offer = computed(() => state.offer)
const page = computed(() => (offer.value ? props.system.pageTitle(offer.value.page) : ""))
const fill = (text: string) => text.replace("{page}", page.value)

const title = computed(() => {
  const o = offer.value
  if (!o) return ""
  if (o.kind === "nudge") return notes.value[o.nudge.feature]?.title ?? ""
  if (o.kind === "tip") return o.tip.title
  if (o.kind === "news") return fill(labels.value.newsTitle)
  return fill(o.kind === "assigned" ? labels.value.assignedTitle : labels.value.tourTitle)
})

const description = computed(() => {
  const o = offer.value
  if (!o) return ""
  if (o.kind === "nudge") return o.nudge.text
  if (o.kind === "tip") return o.tip.keys ? `${o.tip.text} ${o.tip.keys}` : o.tip.text
  if (o.kind === "news") return o.items.map((n) => n.text).join(" ")
  return o.kind === "assigned" ? labels.value.assignedText : labels.value.tourText
})

const actions = computed<ActionBarAction[]>(() => {
  const o = offer.value
  if (!o) return []
  const answer = (choice: "show" | "later" | "never") => () => props.system.answer(choice)
  const show: ActionBarAction = { label: labels.value.show, icon: "lucide:sparkles", onClick: answer("show") }
  if (o.kind === "nudge") return [{ label: labels.value.noThanks, variant: "ghost", onClick: answer("never") }, show]
  if (o.kind === "tip") {
    const later: ActionBarAction = { label: labels.value.gotIt, variant: o.tip.step ? "ghost" : undefined, onClick: answer("later") }
    return [{ label: labels.value.never, variant: "ghost", onClick: answer("never") }, later, ...(o.tip.step ? [show] : [])]
  }
  if (o.kind === "news") return [{ label: labels.value.gotIt, variant: "ghost", onClick: answer("later") }, show]
  return [
    ...(o.kind === "tour" ? [{ label: labels.value.never, variant: "ghost" as const, onClick: answer("never") }] : []),
    { label: labels.value.notNow, variant: "ghost", onClick: answer("later") },
    show,
  ]
})
</script>

<template>
  <template v-if="!broken">
    <LpTour
      v-model:open="state.tour.open"
      v-model:step="state.tour.step"
      :steps="state.tour.steps"
      @finish="system.tourEnded(true)"
      @dismiss="system.tourEnded(false)"
    />
    <LpHintLayer :fresh="fresh" :notes="notes" @read="system.readFresh" />
    <LpActionBar
      :open="!!offer"
      :title="title"
      :description="description"
      :icon="offer?.kind === 'news' ? 'lucide:gift' : offer?.kind === 'tip' ? 'lucide:lightbulb' : 'lucide:compass'"
      :actions="actions"
    />
  </template>
</template>
