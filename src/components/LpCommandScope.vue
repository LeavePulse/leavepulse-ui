<script setup lang="ts">
import { bindPaletteScopeElement, createPaletteRegistry, providePaletteScope, usePaletteCommands, usePaletteScope, type PaletteScope } from "../composables/usePaletteCommands"
import type { ComponentPublicInstance } from "vue"
import type { Command } from "./LpCommandPalette.vue"
import { usePaletteTheme } from "../theme/palette"
import type { ThemeStudio } from "../theme/studio"

const props = withDefaults(defineProps<{
  id: string
  label?: string
  enabled?: boolean
  discover?: boolean
  /** Start a separate registry, e.g. an embedded demo inside an application's palette scope. */
  isolated?: boolean
  theme?: ThemeStudio
  commands?: Command[]
}>(), { enabled: true, discover: true })
const parent = usePaletteScope()
const scope: PaletteScope = {
  registry: !props.isolated && parent ? parent.registry : createPaletteRegistry(),
  get id() { return parent && !props.isolated ? `${parent.id}/${props.id}` : props.id },
  get label() { return props.label ?? props.id },
  depth: parent && !props.isolated ? parent.depth + 1 : 0,
  get enabled() { return props.enabled && (props.isolated || !parent || parent.enabled) },
  get discover() { return props.discover },
}
providePaletteScope(scope)
usePaletteTheme(() => props.theme, { scope })
usePaletteCommands(() => props.commands ?? [], { scope })
function bind(element: Element | ComponentPublicInstance | null) {
  if (element && "nodeType" in element) bindPaletteScopeElement(element as Element, scope)
}
</script>

<template><div :ref="bind" data-lp-command-scope class="contents"><slot /></div></template>
