<script setup lang="ts">
/*
 * Mount once near the app root. Renders the shared toast queue on the top
 * z-layer (--z-toast) — above modals on purpose. Minimalist look: icon + text
 * + a countdown progress bar. Colors come from tokens, so it follows the theme.
 */
import {
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from "reka-ui"
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import { useLabels } from "../composables/useLpConfig"
import { useToast, type ToastItem } from "../composables/useToast"
import { CLOSE_ICON } from "./dropdown"
import LpCopyButton from "./LpCopyButton.vue"
import LpIcon from "./LpIcon.vue"
import { toneLook } from "./tone"
import { usePortalTarget } from "../composables/useView"

const props = defineProps<{ labels?: Partial<{ dismiss: string; copy: string; copied: string }> }>()
const text = useLabels("toast", { dismiss: "Dismiss", copy: "Copy message", copied: "Copied" }, () => props.labels)

const { queue, dismiss } = useToast()

/*
 * The stack slides rather than jumps. A new toast lands at the bottom and the
 * ones above used to leap up by its height in a single frame; one leaving let
 * the rest drop the same way. Each toast's layout position (offsetTop, which
 * ignores transforms) is remembered, and when the list changes every toast
 * that moved is played from where it was to where it is (FLIP). The observer
 * fires after the DOM changes and before the frame is painted, so the jump is
 * never seen. Toasts render through reka's portal into the viewport, which is
 * why this watches the DOM rather than a TransitionGroup.
 */
let observer: MutationObserver | undefined
const tops = new WeakMap<Element, number>()

function toastsIn(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("li[data-state]")]
}

function slide(root: Element) {
  const reduce = prefersReducedMotion()
  const height = (root as HTMLElement).offsetHeight
  for (const el of toastsIn(root)) {
    const before = tops.get(el)
    const now = el.offsetTop - height
    tops.set(el, now)
    if (before === undefined || before === now || reduce || el.hasAttribute("data-swipe")) continue
    el.animate([{ translate: `0 ${before - now}px` }, { translate: "0 0" }], {
      duration: 220,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    })
  }
}

// The viewport's component root is a wrapper fragment, not the list, so the
// list is found by a mark of its own once it is teleported into place.
const viewportId = useId()
onMounted(() =>
  nextTick(() => {
    const root = document.querySelector(`[data-lp-toasts="${viewportId}"]`)
    if (!root || typeof MutationObserver === "undefined") return
    for (const el of toastsIn(root)) tops.set(el, el.offsetTop - (root as HTMLElement).offsetHeight)
    observer = new MutationObserver(() => slide(root))
    observer.observe(root, { childList: true, subtree: true })
  }),
)
onBeforeUnmount(() => observer?.disconnect())

// A toast replaced through its `key` keeps its id and gets a new revision, so
// everything tied to one rendered toast goes by both.
const tag = (t: ToastItem) => `${t.id}:${t.rev}`

// Toasts that are playing their exit animation. We don't splice them out of the
// queue immediately on close — that would unmount before `toast-out` can run.
// Instead we flip `open` to false (reka sets data-state=closed → the keyframe
// plays), then drop the toast for real once `animationend` fires. A safety
// timer removes it even if the animationend event is missed (e.g. tab hidden).
const closing = ref<Set<string>>(new Set())

function beginClose(t: ToastItem) {
  const at = tag(t)
  if (closing.value.has(at)) return
  closing.value = new Set(closing.value).add(at)
  // Fallback slightly longer than the 140ms toast-out duration.
  window.setTimeout(() => finishClose(t.id, at), 220)
}

function finishClose(id: number, at: string) {
  if (!closing.value.has(at)) return
  const next = new Set(closing.value)
  next.delete(at)
  closing.value = next
  // Replaced while it was leaving: the new revision stays.
  if (queue.some((t) => tag(t) === at)) dismiss(id)
}

function onAnimEnd(e: AnimationEvent, t: ToastItem) {
  // Only the exit keyframe should trigger removal, not toast-in.
  if (e.animationName === "toast-out") finishClose(t.id, tag(t))
}

const variantIcon: Record<ToastItem["variant"], string> = {
  info: "lucide:info",
  success: "lucide:circle-check",
  warning: "lucide:triangle-alert",
  error: "lucide:circle-x",
}


/*
 * The countdown bar is the shared drain (.lp-drain): a CSS animation as long as
 * the toast's duration. reka pauses its own auto-dismiss timer while a toast
 * is hovered or focused and resumes it with the time that was left; pausing
 * the animation alongside it does exactly the same, so the bar empties at the
 * moment the toast actually closes, with no clock ticking in the meantime.
 */
const paused = ref<Set<string>>(new Set())

/*
 * How far into its run a toast already was when its bar first rendered (a
 * Toaster mounted after toasts were queued). Remembered per rendered toast,
 * because the style is re-evaluated on every render and a delay that changed
 * under a running animation would jump the bar.
 */
const startOffsets = new Map<string, number>()
function drainStyle(t: ToastItem) {
  const at = tag(t)
  let offset = startOffsets.get(at)
  if (offset === undefined) {
    offset = t.dismissAt === null ? 0 : Math.max(0, t.duration - (t.dismissAt - Date.now()))
    startOffsets.set(at, offset)
  }
  return { animationDuration: `${t.duration}ms`, animationDelay: `${-offset}ms` }
}

// Keyed by every rendered toast, not the count: a toast replaced through its
// `key` leaves the same length behind.
watch(
  () => queue.map(tag).join("|"),
  () => {
    // Drop per-toast state for toasts that have left the queue (e.g. dismissed
    // while hovered) so it can't grow unbounded over a long session. A toast
    // evicted by the queue cap or clear() leaves without an animationend, so
    // the closing set is pruned here too.
    const live = (at: string) => queue.some((t) => tag(t) === at)
    for (const at of startOffsets.keys()) if (!live(at)) startOffsets.delete(at)
    if ([...paused.value].some((at) => !live(at))) paused.value = new Set([...paused.value].filter(live))
    if (closing.value.size) {
      const next = new Set([...closing.value].filter(live))
      if (next.size !== closing.value.size) closing.value = next
    }
  },
)

function onPause(t: ToastItem) {
  paused.value = new Set(paused.value).add(tag(t))
}
function onResume(t: ToastItem) {
  const next = new Set(paused.value)
  next.delete(tag(t))
  paused.value = next
}

/*
 * reka cancels the click that ends a swipe by adding a listener after ours, so
 * by the time it runs our handler has already acted on it: a swiped-away
 * "View details" toast navigated. The swipe marks the toast instead, and the
 * mark lasts only until that trailing click has had its chance.
 */
let swiped: string | null = null
function onSwipeDone(t: ToastItem) {
  swiped = tag(t)
  window.setTimeout(() => (swiped = null), 0)
}

const busy = ref<Set<string>>(new Set())

async function settle(t: ToastItem, run: () => void | Promise<void>) {
  const at = tag(t)
  if (busy.value.has(at)) return
  busy.value = new Set(busy.value).add(at)
  try {
    await run()
    beginClose(t)
  } finally {
    const next = new Set(busy.value)
    next.delete(at)
    busy.value = next
  }
}

/*
 * An error is something people need to pass on, so its text can be selected
 * and copied. reka sets user-select: none on the toast and starts a swipe on
 * any press, which made the message impossible to select: the description
 * opts back into selection and keeps its presses from starting a swipe. A
 * click that ends a selection is not a click on the toast.
 */
const copyable = (t: ToastItem) => t.variant === "error" || t.variant === "warning"
// Read on click rather than bound, so a toast whose text is updated in place copies what it now says.
const toastText = (t: ToastItem) => () => [t.title, t.message, t.details, t.context].filter(Boolean).join("\n")

function selecting(): boolean {
  return Boolean(window.getSelection()?.toString())
}

function runClick(t: ToastItem) {
  if (swiped === tag(t) || selecting()) return
  if (t.onClick) return settle(t, t.onClick)
}

function runAction(t: ToastItem, action: NonNullable<ToastItem["actions"]>[number]) {
  return settle(t, action.onClick)
}

// Overlays open in the window this component renders in (an LpFrame's, inside one).
const portalTo = usePortalTarget()
</script>

<template>
  <ToastProvider>
    <ToastRoot
      v-for="t in queue"
      :key="tag(t)"
      :open="!closing.has(tag(t))"
      :duration="t.duration"
      :type="t.variant === 'error' || t.variant === 'warning' ? 'foreground' : 'background'"
      class="pointer-events-auto relative overflow-hidden rounded-card border border-line bg-surface-raised shadow-panel data-[state=open]:animate-[toast-in_200ms_var(--ease-emphasized)] data-[state=closed]:animate-[toast-out_140ms_ease]"
      :class="{ 'cursor-pointer': t.onClick }"
      @update:open="(open) => !open && beginClose(t)"
      @animationend="(e: AnimationEvent) => onAnimEnd(e, t)"
      @swipe-end="onSwipeDone(t)"
      @swipe-cancel="onSwipeDone(t)"
      @pause="onPause(t)"
      @resume="onResume(t)"
      @click="runClick(t)"
    >
      <div class="flex items-start gap-3 p-3.5">
        <LpIcon
          :name="variantIcon[t.variant]"
          :size="18"
          class="mt-0.5 shrink-0"
          :class="toneLook(t.variant).text"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <ToastTitle v-if="t.title" class="text-sm font-semibold text-ink">
            {{ t.title }}
          </ToastTitle>
          <ToastDescription
            class="cursor-text select-text break-words text-xs text-muted"
            @pointerdown.stop
          >
            {{ t.message }}
          </ToastDescription>

          <div
            v-if="t.actions?.length"
            class="mt-2 flex flex-wrap gap-2"
            @click.stop
          >
            <button
              v-for="(action, i) in t.actions"
              :key="i"
              type="button"
              :disabled="busy.has(tag(t))"
              :aria-busy="busy.has(tag(t)) || undefined"
              class="inline-flex items-center gap-1.5 rounded-control disabled:opacity-60 border border-line bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink outline-none transition-[border-color,background-color,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] hover:border-line-strong hover:bg-surface-soft/70 active:scale-95 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring"
              @click="runAction(t, action)"
            >
              <LpIcon v-if="action.icon" :name="action.icon" :size="14" />
              {{ action.label }}
            </button>
          </div>
        </div>

        <!-- Sized to the dismiss button beside it rather than to LpButton's
             scale; the click stays off the toast, whose own click would run
             its action or close it. -->
        <LpCopyButton
          v-if="copyable(t)"
          :value="toastText(t)"
          variant="muted"
          :icon-size="15"
          class="-mt-1 size-auto aspect-auto rounded-inner p-1 hover:bg-transparent"
          :labels="{ copy: text.copy, copied: text.copied }"
          @click.stop
        />
        <button
          type="button"
          class="group -mr-1 -mt-1 rounded-inner p-1 text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink"
          :aria-label="text.dismiss"
          @click.stop="beginClose(t)"
        >
          <LpIcon
            name="lucide:x"
            :size="16"
            :class="CLOSE_ICON"
          />
        </button>
      </div>

      <!-- Countdown progress bar -->
      <div
        v-if="t.dismissAt"
        class="lp-drain absolute inset-x-0 bottom-0 h-0.5"
        :class="toneLook(t.variant).bg"
        :style="drainStyle(t)"
        :data-paused="paused.has(tag(t)) || undefined"
      />
    </ToastRoot>

    <!-- Teleported to body so the viewport escapes any stacking context the
         consumer's app root creates (e.g. an opaque `#app { z-index }` wrapper).
         Modals portal to body too, so both compare at the same root level and
         --z-toast (200) > --z-modal (110) wins as intended. -->
    <Teleport :to="portalTo">
      <ToastViewport
        :data-lp-toasts="viewportId"
        class="fixed bottom-0 right-0 z-(--z-toast) flex w-[min(92vw,22rem)] flex-col gap-2 p-4 outline-none"
      />
    </Teleport>
  </ToastProvider>
</template>
