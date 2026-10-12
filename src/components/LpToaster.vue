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
import LpIcon from "./LpIcon.vue"

const props = defineProps<{ labels?: Partial<{ dismiss: string }> }>()
const text = useLabels("toast", { dismiss: "Dismiss" }, () => props.labels)

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

// One token color drives icon + progress per variant.
const variantColor: Record<ToastItem["variant"], string> = {
  info: "text-brand",
  success: "text-action",
  warning: "text-accent",
  error: "text-danger",
}
const variantBar: Record<ToastItem["variant"], string> = {
  info: "bg-brand",
  success: "bg-action",
  warning: "bg-accent",
  error: "bg-danger",
}

// reka pauses its own auto-dismiss timer while a toast is hovered/focused; mirror
// that on the visual bar by carrying each toast's dismissAt forward over the
// paused span, so the countdown matches when it actually closes.
const pausedAt = new Map<number, number>()

// Ticking clock so the progress bar animates smoothly. Runs only while there's
// at least one auto-dismissing toast on screen — no idle interval otherwise.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

function startTimer() {
  if (timer === null) timer = setInterval(() => (now.value = Date.now()), 80)
}
function stopTimer() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

watch(
  () => queue.length,
  () => {
    // Drop pause state for toasts that have left the queue (e.g. dismissed
    // while hovered) so the map can't grow unbounded over a long session.
    for (const id of pausedAt.keys()) {
      if (!queue.some((t) => t.id === id)) pausedAt.delete(id)
    }
    // Same for the closing set — a toast evicted by the queue cap or clear()
    // leaves without an animationend, so prune dead ids here.
    if (closing.value.size) {
      const live = new Set([...closing.value].filter((at) => queue.some((t) => tag(t) === at)))
      if (live.size !== closing.value.size) closing.value = live
    }
    if (queue.some((t) => t.dismissAt !== null)) startTimer()
    else stopTimer()
  },
  { immediate: true },
)
onBeforeUnmount(stopTimer)

function onPause(t: ToastItem) {
  pausedAt.set(t.id, now.value)
}
function onResume(t: ToastItem) {
  const since = pausedAt.get(t.id)
  if (since !== undefined && t.dismissAt !== null) {
    t.dismissAt += Date.now() - since
  }
  pausedAt.delete(t.id)
}

function progress(t: ToastItem): number {
  if (!t.dismissAt || t.duration <= 0) return 0
  // While paused, freeze the bar at the moment hover started.
  const at = pausedAt.get(t.id) ?? now.value
  const remaining = t.dismissAt - at
  return Math.max(0, Math.min(100, (remaining / t.duration) * 100))
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

function runClick(t: ToastItem) {
  if (swiped === tag(t)) return
  if (t.onClick) return settle(t, t.onClick)
}

function runAction(t: ToastItem, action: NonNullable<ToastItem["actions"]>[number]) {
  return settle(t, action.onClick)
}
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
          :class="variantColor[t.variant]"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <ToastTitle v-if="t.title" class="text-sm font-semibold text-ink">
            {{ t.title }}
          </ToastTitle>
          <ToastDescription class="break-words text-xs text-muted">
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

        <button
          type="button"
          class="group -mr-1 -mt-1 rounded-md p-1 text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink"
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
        class="absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform duration-100 ease-linear motion-reduce:transition-none"
        :class="variantBar[t.variant]"
        :style="{ transform: `scaleX(${progress(t) / 100})` }"
      />
    </ToastRoot>

    <!-- Teleported to body so the viewport escapes any stacking context the
         consumer's app root creates (e.g. an opaque `#app { z-index }` wrapper).
         Modals portal to body too, so both compare at the same root level and
         --z-toast (200) > --z-modal (110) wins as intended. -->
    <Teleport to="body">
      <ToastViewport
        :data-lp-toasts="viewportId"
        class="fixed bottom-0 right-0 z-(--z-toast) flex w-[min(92vw,22rem)] flex-col gap-2 p-4 outline-none"
      />
    </Teleport>
  </ToastProvider>
</template>
