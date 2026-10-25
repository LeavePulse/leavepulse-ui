<script lang="ts">
export interface HintNote {
  title: string
  text?: string
}
</script>

<script setup lang="ts">
/*
 * Quiet "new" markers over `v-hint` elements, with a short note when the user
 * reaches for one. Nothing pops up by itself: a dot sits on the control, and
 * the note opens only when the pointer or focus lands on it. Reading the note
 * (or simply using the control) is the app's cue to stop marking it.
 *
 * The layer only draws. Which ids are new, and when a read counts, is decided
 * by the app from the registry's seen/used events.
 */
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from "reka-ui"
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import { hints } from "../composables/useHints"
import { useLabels } from "../composables/useLpConfig"
import { PANEL_SURFACE, POPOVER_ANIM } from "./dropdown"
import LpButton from "./LpButton.vue"
import { useOutsideGuard, usePortalTarget } from "../composables/useView"

const props = withDefaults(
  defineProps<{
    /** Ids to mark, most important first. */
    fresh: string[]
    notes: Record<string, HintNote>
    /** At most this many dots at once, so a page full of news stays calm. */
    limit?: number
    labels?: Partial<typeof DEFAULT_LABELS>
  }>(),
  { limit: 3 },
)

const emit = defineEmits<{ (e: "read", id: string): void }>()

const DEFAULT_LABELS = { gotIt: "Got it", badge: "New" }
const labels = useLabels("hintLayer", DEFAULT_LABELS, () => props.labels)

const OPEN_DELAY_MS = 350

const shown = computed(() => props.fresh.filter((id) => hints.present(id) && props.notes[id]).slice(0, props.limit))
const spots = ref<{ id: string; x: number; y: number }[]>([])
const openId = ref<string | null>(null)
const anchor = shallowRef<Element | null>(null)
let frame = 0
let timer: ReturnType<typeof setTimeout> | undefined

function place() {
  spots.value = shown.value.flatMap((id) => {
    const el = hints.element(id)
    if (!el) return []
    const r = el.getBoundingClientRect()
    return r.width || r.height ? [{ id, x: r.right, y: r.top }] : []
  })
  frame = shown.value.length ? requestAnimationFrame(place) : 0
}

watch(
  shown,
  (ids) => {
    if (ids.length && !frame) frame = requestAnimationFrame(place)
    if (openId.value && !ids.includes(openId.value)) openId.value = null
  },
  { immediate: true },
)

function reveal(id: string) {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (!shown.value.includes(id)) return
    anchor.value = hints.element(id)
    openId.value = anchor.value ? id : null
  }, OPEN_DELAY_MS)
}

function read() {
  const id = openId.value
  openId.value = null
  if (id) emit("read", id)
}

let off: (() => void)[] = []
onMounted(() => {
  off = [
    hints.on("hover", (id) => {
      if (shown.value.includes(id)) reveal(id)
    }),
    hints.on("used", (id) => {
      if (!shown.value.includes(id)) return
      clearTimeout(timer)
      if (openId.value === id) openId.value = null
      emit("read", id)
    }),
  ]
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearTimeout(timer)
  for (const stop of off) stop()
})

const note = computed(() => (openId.value ? props.notes[openId.value] : undefined))

// Overlays open in the window this component renders in (an LpFrame's, inside one).
const portalTo = usePortalTarget()
// What happens in another document (the page around a frame, or a frame in
// the page) is not "outside" for this layer.
const guardOutside = useOutsideGuard()
</script>

<template>
  <Teleport :to="portalTo">
    <button
      v-for="spot in spots"
      :key="spot.id"
      type="button"
      class="fixed z-(--z-popover) -translate-x-1/2 -translate-y-1/2 rounded-full p-1"
      :style="{ left: `${spot.x}px`, top: `${spot.y}px` }"
      :aria-label="`${labels.badge}: ${notes[spot.id]?.title ?? ''}`"
      @pointerenter="reveal(spot.id)"
      @focus="reveal(spot.id)"
      @click="reveal(spot.id)"
    >
      <span class="relative flex size-2">
        <span class="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:animate-none" />
        <span class="relative inline-flex size-2 rounded-full bg-brand ring-2 ring-surface" />
      </span>
    </button>
    <PopoverRoot :open="!!openId" @update:open="(value) => !value && (openId = null)">
      <PopoverAnchor v-if="anchor" :reference="anchor" />
      <PopoverPortal :to="portalTo">
        <PopoverContent
          @interact-outside="guardOutside"
          @escape-key-down="guardOutside"
          side="bottom"
          :side-offset="8"
          :collision-padding="8"
          :class="[PANEL_SURFACE, POPOVER_ANIM, 'z-(--z-popover) w-72 rounded-card p-3 text-sm text-ink outline-none']"
        >
          <p class="flex items-center gap-2 font-medium">
            <span class="rounded-full bg-brand/15 px-1.5 text-[11px] text-brand">{{ labels.badge }}</span>
            {{ note?.title }}
          </p>
          <p v-if="note?.text" class="mt-1.5 text-muted">{{ note.text }}</p>
          <div class="mt-3 flex justify-end">
            <LpButton size="sm" @click="read">{{ labels.gotIt }}</LpButton>
          </div>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </Teleport>
</template>
