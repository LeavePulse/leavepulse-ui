<script setup lang="ts">
/*
 * Live template playground. Takes an editable Vue template string + a scope
 * (components + reactive state) and renders it with Vue's runtime compiler.
 * The template is compiled first on its own: an edit that does not compile
 * keeps the last one that did on screen, with the error over it, instead of
 * blanking the example while you type.
 *
 * The stage above it sets the width (the whole column, a tablet, a phone) and
 * the background, so a component can be checked where it will live.
 *
 * Preview-only: the kit package never ships a runtime compiler.
 */
import { compile, computed, defineComponent, onErrorCaptured, reactive, ref, watch, type Component } from "vue"
import { LpFrame, LpIcon, LpSegmented, usePersisted } from "../../src"

const props = defineProps<{
  template: string
  components: Record<string, Component>
  state?: Record<string, unknown>
  /** No width and background controls: for small embedded examples. */
  bare?: boolean
}>()

const sharedState = reactive(props.state ?? {})
const runtimeError = ref<string | null>(null)
const compileError = ref<string | null>(null)
const good = ref(props.template?.trim() || "<div />")

watch(
  () => props.template,
  (next) => {
    const tpl = next?.trim() || "<div />"
    const errors: string[] = []
    try {
      compile(tpl, { onError: (e) => errors.push(e.message), onWarn: () => {} })
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
    compileError.value = errors[0] ?? null
    if (!errors.length) {
      runtimeError.value = null
      good.value = tpl
    }
  },
)

const Dynamic = computed<Component>(() => ({
  components: props.components,
  setup: () => sharedState,
  template: good.value,
}))

// Error boundary: catch runtime-compile/render failures and surface the message.
const Boundary = defineComponent({
  setup(_, { slots }) {
    onErrorCaptured((e) => {
      runtimeError.value = e instanceof Error ? e.message : String(e)
      return false
    })
    return () => slots.default?.()
  },
})

const width = usePersisted<"full" | "tablet" | "phone">("lp-preview-stage-width", "full")
const backdrop = usePersisted<"plain" | "grid" | "dots">("lp-preview-stage-backdrop", "plain")
const WIDTHS = { full: "100%", tablet: "768px", phone: "375px" }
// A device is a screen, not a strip as tall as the demo: a modal centres in
// it and a tour's sheet sits at its bottom. The full width grows with the
// demo instead, from a height that still leaves an overlay room.
const HEIGHTS = { full: undefined, tablet: 720, phone: 667 }
const error = computed(() => compileError.value ?? runtimeError.value)
</script>

<template>
  <div class="min-w-0 overflow-hidden rounded-card border border-line bg-surface">
    <div v-if="!bare" class="flex flex-wrap items-center justify-end gap-2 border-b border-line bg-surface-raised px-3 py-2">
      <LpSegmented
        v-model="backdrop"
        size="sm"
        aria-label="Stage background"
        :options="[
          { value: 'plain', label: '', ariaLabel: 'Plain background', icon: 'lucide:square' },
          { value: 'grid', label: '', ariaLabel: 'Grid background', icon: 'lucide:grid-3x3' },
          { value: 'dots', label: '', ariaLabel: 'Dotted background', icon: 'lucide:grip' },
        ]"
      />
      <LpSegmented
        v-model="width"
        size="sm"
        aria-label="Stage width"
        :options="[
          { value: 'full', label: '', ariaLabel: 'Full width', icon: 'lucide:monitor' },
          { value: 'tablet', label: '', ariaLabel: 'Tablet, 768 px', icon: 'lucide:tablet' },
          { value: 'phone', label: '', ariaLabel: 'Phone, 375 px', icon: 'lucide:smartphone' },
        ]"
      />
    </div>
    <!-- The demo runs in a frame of its own (LpFrame): its width is the
         viewport, so the phone width gets the phone layout, overlays open
         inside it, and using the page around it closes nothing in it. A demo
         wider than the frame scrolls inside it; "safe" centring keeps its
         left edge reachable. -->
    <div class="lp-stage relative flex justify-center p-4 sm:p-8" :data-backdrop="backdrop">
      <div
        class="w-full transition-[max-width] duration-(--duration-medium) ease-(--ease-emphasized)"
        :class="width !== 'full' && 'rounded-control outline-1 outline-offset-8 outline-line-strong outline-dashed'"
        :style="{ maxWidth: WIDTHS[width] }"
      >
        <LpFrame :height="HEIGHTS[width]" class="min-h-40" title="Example">
          <div
            class="flex w-full items-center justify-center overflow-x-auto p-4 [justify-content:safe_center] *:max-w-full *:min-w-0"
            :class="width === 'full' ? 'min-h-40' : 'min-h-screen'"
          >
            <Boundary :key="good">
              <component :is="Dynamic" />
            </Boundary>
          </div>
        </LpFrame>
      </div>
    </div>
    <p v-if="error" class="flex items-start gap-2 border-t border-danger/30 bg-danger-soft px-4 py-2 font-mono text-xs text-danger">
      <LpIcon name="lucide:triangle-alert" :size="14" class="mt-px shrink-0" />
      <span>{{ error }}<template v-if="compileError"> · showing the last version that compiled</template></span>
    </p>
  </div>
</template>

<style>
.lp-stage[data-backdrop="grid"] {
  background-image:
    linear-gradient(var(--color-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-line) 1px, transparent 1px);
  background-size: 24px 24px;
}
.lp-stage[data-backdrop="dots"] {
  background-image: radial-gradient(var(--color-line-strong) 1px, transparent 1.5px);
  background-size: 16px 16px;
}
</style>
