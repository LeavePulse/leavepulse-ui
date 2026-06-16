<script setup lang="ts">
/*
 * Live template playground. Takes an editable Vue template string + a scope
 * (components + reactive state) and renders it with Vue's runtime compiler
 * (vue.esm-browser, already in the tree). Recompiles on edit; compile/render
 * errors are captured and shown instead of crashing the page.
 *
 * Preview-only: the kit package never ships a runtime compiler.
 */
import { computed, defineComponent, h, onErrorCaptured, reactive, ref, type Component } from "vue"

const props = defineProps<{
  template: string
  components: Record<string, Component>
  state?: Record<string, unknown>
}>()

const sharedState = reactive(props.state ?? {})
const error = ref<string | null>(null)

const Dynamic = computed<Component>(() => {
  error.value = null
  const tpl = props.template?.trim() || "<div />"
  return {
    components: props.components,
    setup: () => sharedState,
    template: tpl,
  }
})

// Error boundary: catch runtime-compile/render failures and surface the message.
const Boundary = defineComponent({
  setup(_, { slots }) {
    onErrorCaptured((e) => {
      error.value = e instanceof Error ? e.message : String(e)
      return false
    })
    return () => slots.default?.()
  },
})
</script>

<template>
  <div class="rounded-card border border-line bg-surface">
    <div class="flex min-h-32 items-center justify-center p-8">
      <Boundary :key="template">
        <component :is="Dynamic" />
      </Boundary>
    </div>
    <p v-if="error" class="border-t border-danger/30 bg-danger-soft px-4 py-2 font-mono text-xs text-danger">
      {{ error }}
    </p>
  </div>
</template>
