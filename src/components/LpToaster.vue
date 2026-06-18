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
import LpIcon from "./LpIcon.vue"

const { queue, dismiss } = useToast()

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
    dismiss(t.id)
  }
}

async function runAction(t: ToastItem, action: NonNullable<ToastItem["actions"]>[number]) {
  await action.onClick()
  dismiss(t.id)
}
</script>

<template>
  <ToastProvider>
    <ToastRoot
      v-for="t in queue"
      :key="t.id"
      :duration="t.duration"
      class="pointer-events-auto relative overflow-hidden rounded-card border border-line bg-surface-raised shadow-panel data-[state=open]:animate-[toast-in_200ms_var(--ease-emphasized)] data-[state=closed]:animate-[toast-out_140ms_ease]"
      :class="{ 'cursor-pointer': t.onClick }"
      @update:open="(open) => !open && dismiss(t.id)"
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
              class="rounded-control border border-line bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink hover:border-line-strong"
              @click="runAction(t, action)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>

        <button
          type="button"
          class="-mr-1 -mt-1 rounded-md p-1 text-muted hover:text-ink"
          aria-label="Dismiss"
          @click.stop="dismiss(t.id)"
        >
          <LpIcon name="lucide:x" :size="16" />
        </button>
      </div>

      <!-- Countdown progress bar -->
      <div
        v-if="t.dismissAt"
        class="absolute inset-x-0 bottom-0 h-0.5 origin-left"
        :class="variantBar[t.variant]"
        :style="{ transform: `scaleX(${progress(t) / 100})` }"
      />
    </ToastRoot>

    <ToastViewport
      class="fixed bottom-0 right-0 z-(--z-toast) flex w-[min(92vw,22rem)] flex-col gap-2 p-4 outline-none"
    />
  </ToastProvider>
</template>
