<script setup lang="ts">
/*
 * A component with its props on switches. The controls come from the
 * component's own types (meta.json): a string union becomes a choice, a
 * boolean a switch, a number a number field, a string a text field. What the
 * controls set is the code below, ready to copy. Props that take objects,
 * arrays or functions are left to the examples.
 */
import { computed, h, reactive, watch, type Component } from "vue"
import { LpCodeBlock, LpInput, LpNumberField, LpSelect, LpSwitch } from "../../src"
import type { PropMeta } from "./meta"

const props = defineProps<{
  name: string
  component: Component
  meta: PropMeta[]
  slots: string[]
}>()

const SKIP = new Set(["modelValue", "class", "style", "id", "labels", "text", "ariaLabel", "as", "to", "href"])

type Kind = "choice" | "boolean" | "number" | "string"
interface Control {
  name: string
  kind: Kind
  choices?: string[]
  initial: unknown
}

function kindOf(p: PropMeta): Kind | null {
  if (p.choices?.length) return "choice"
  const type = p.type.replace(/\s*\|\s*undefined/g, "").trim()
  if (type === "boolean") return "boolean"
  if (type === "number") return "number"
  if (type === "string") return "string"
  return null
}

function unquote(value?: string): unknown {
  if (value === undefined) return undefined
  if (/^".*"$/.test(value)) return value.slice(1, -1)
  if (value === "true" || value === "false") return value === "true"
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

const controls = computed<Control[]>(() =>
  props.meta
    .filter((p) => !SKIP.has(p.name) && !p.name.startsWith("on"))
    .flatMap((p) => {
      const kind = kindOf(p)
      return kind ? [{ name: p.name, kind, choices: p.choices, initial: unquote(p.default) }] : []
    }),
)

const values = reactive<Record<string, unknown>>({})
watch(
  () => props.name,
  () => {
    for (const k of Object.keys(values)) delete values[k]
    for (const c of controls.value) values[c.name] = c.initial ?? (c.kind === "boolean" ? false : undefined)
  },
  { immediate: true },
)

const hasDefault = computed(() => props.slots.includes("default"))
const label = computed(() => props.name.replace(/^Lp/, ""))

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const code = computed(() => {
  const attrs = controls.value
    .filter((c) => {
      const v = values[c.name]
      const base = c.initial ?? (c.kind === "boolean" ? false : undefined)
      return v !== undefined && v !== "" && v !== null && v !== base
    })
    .map((c) => {
      const v = values[c.name]
      if (v === true) return kebab(c.name)
      if (typeof v === "boolean" || typeof v === "number") return `:${kebab(c.name)}="${v}"`
      return `${kebab(c.name)}="${String(v).replace(/"/g, "&quot;")}"`
    })
  const open = [`<${props.name}`, ...attrs].join(" ")
  return hasDefault.value ? `${open}>${label.value}</${props.name}>` : `${open} />`
})

const Rendered = computed(() => () => {
  const bound = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== ""))
  return h(props.component, bound, hasDefault.value ? { default: () => label.value } : undefined)
})

</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
    <div class="flex min-w-0 flex-col gap-3">
      <div class="flex min-h-48 items-center justify-center overflow-x-auto rounded-card border border-line bg-surface p-8 [justify-content:safe_center]">
        <component :is="Rendered" />
      </div>
      <LpCodeBlock :model-value="code" lang="html" copyable />
    </div>
    <div class="flex flex-col gap-3 rounded-card border border-line bg-surface-raised p-4">
      <p v-if="!controls.length" class="text-sm text-muted">This component is set up with data rather than switches: see the examples.</p>
      <label v-for="c in controls" :key="c.name" class="flex flex-col gap-1.5">
        <span class="font-mono text-xs text-muted">{{ c.name }}</span>
        <LpSelect
          v-if="c.kind === 'choice'"
          v-model="values[c.name] as string"
          size="sm"
          :options="c.choices!.map((v) => ({ value: v, label: v }))"
          placeholder="default"
          clearable
        />
        <LpSwitch v-else-if="c.kind === 'boolean'" v-model="values[c.name] as boolean" />
        <LpNumberField v-else-if="c.kind === 'number'" v-model="values[c.name] as number" size="sm" />
        <LpInput v-else v-model="values[c.name] as string" size="sm" />
      </label>
    </div>
  </div>
</template>
