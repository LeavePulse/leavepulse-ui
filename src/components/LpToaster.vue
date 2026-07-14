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
import { onBeforeUnmount, ref, watch } from "vue"
import { useToast, type ToastItem } from "../composables/useToast"
import { CLOSE_ICON } from "./dropdown"
import LpIcon from "./LpIcon.vue"

const { queue, dismiss } = useToast()

// Toasts that are playing their exit animation. We don't splice them out of the
// queue immediately on close — that would unmount before `toast-out` can run.
// Instead we flip `open` to false (reka sets data-state=closed → the keyframe
// plays), then drop the toast for real once `animationend` fires. A safety
// timer removes it even if the animationend event is missed (e.g. tab hidden).
const closing = ref<Set<number>>(new Set())

function beginClose(id: number) {
  if (closing.value.has(id)) return
  closing.value = new Set(closing.value).add(id)
  // Fallback slightly longer than the 140ms toast-out duration.
  window.setTimeout(() => finishClose(id), 220)
}

function finishClose(id: number) {
  if (!closing.value.has(id)) return
  const next = new Set(closing.value)
  next.delete(id)
  closing.value = next
  dismiss(id)
}

function onAnimEnd(e: AnimationEvent, id: number) {
  // Only the exit keyframe should trigger removal, not toast-in.
  if (e.animationName === "toast-out") finishClose(id)
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
      const live = new Set([...closing.value].filter((id) => queue.some((t) => t.id === id)))
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

async function runClick(t: ToastItem) {
  if (t.onClick) {
    await t.onClick()
    beginClose(t.id)
  }
}

async function runAction(t: ToastItem, action: NonNullable<ToastItem["actions"]>[number]) {
  await action.onClick()
  beginClose(t.id)
}
</script>

<template>
  <ToastProvider>
    <ToastRoot
      v-for="t in queue"
      :key="t.id"
      :open="!closing.has(t.id)"
      :duration="t.duration"
      class="pointer-events-auto relative overflow-hidden rounded-card border border-line bg-surface-raised shadow-panel data-[state=open]:animate-[toast-in_200ms_var(--ease-emphasized)] data-[state=closed]:animate-[toast-out_140ms_ease]"
      :class="{ 'cursor-pointer': t.onClick }"
      @update:open="(open) => !open && beginClose(t.id)"
      @animationend="(e: AnimationEvent) => onAnimEnd(e, t.id)"
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
              class="rounded-control border border-line bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink outline-none transition-[border-color,background-color,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] hover:border-line-strong hover:bg-surface-soft/70 active:scale-95 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring"
              @click="runAction(t, action)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>

        <button
          type="button"
          class="group -mr-1 -mt-1 rounded-md p-1 text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink"
          aria-label="Dismiss"
          @click.stop="beginClose(t.id)"
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
        class="fixed bottom-0 right-0 z-(--z-toast) flex w-[min(92vw,22rem)] flex-col gap-2 p-4 outline-none"
      />
    </Teleport>
  </ToastProvider>
</template>
