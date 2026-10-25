<script setup lang="ts">
/*
 * A component with its props on switches. The controls come from the
 * component's own types (meta.json): a string union becomes a choice, a
 * boolean a switch, a number a number field, a string a text field.
 *
 * What it switches is the component as the entry's example uses it: the first
 * element of that component in the example's template, with its data
 * (`:items`, `:series`, `:columns`), its `v-model` and its slot content, so a
 * table has rows and a modal has a body. Drawn bare, from props alone, most
 * of the kit had nothing to show or failed on a missing required prop. An
 * element bound to `v-model:open` gets a button that opens it. What the
 * controls set is the code below, ready to copy.
 */
import { NodeTypes, parse, type AttributeNode, type DirectiveNode, type ElementNode, type TemplateChildNode } from "@vue/compiler-dom"
import { computed, defineComponent, h, onErrorCaptured, reactive, ref, watch, type Component } from "vue"
import { LpButton, LpCodeBlock, LpIcon, LpInput, LpNumberField, LpSelect, LpSwitch } from "../../src"
import type { PropMeta } from "./meta"
import type { ComponentEntry } from "./registry"

const props = defineProps<{
  name: string
  component: Component
  meta: PropMeta[]
  slots: string[]
  entry: ComponentEntry
}>()

const SKIP = new Set(["modelValue", "class", "style", "id", "labels", "text", "ariaLabel", "as", "to", "href"])

type Kind = "choice" | "boolean" | "number" | "string"
interface Control {
  name: string
  kind: Kind
  choices?: string[]
  /** The component's own default, against which the code below is written. */
  base: unknown
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

const camel = (s: string) => s.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

const controls = computed<Control[]>(() =>
  props.meta
    .filter((p) => !SKIP.has(camel(p.name)) && !p.name.startsWith("on"))
    .flatMap((p) => {
      const kind = kindOf(p)
      return kind ? [{ name: camel(p.name), kind, choices: p.choices, base: unquote(p.default) ?? (kind === "boolean" ? false : undefined) }] : []
    }),
)
const controlled = computed(() => new Set(controls.value.map((c) => c.name)))

// The element in the example, found depth first by its name in either case.
// One inside a `v-for` or a scoped slot reads names that exist only there,
// so it is passed over for a later one, or for the component alone.
const SCOPING = ["for", "slot"]
const scoping = (node: ElementNode) => node.props.some((p) => p.type === NodeTypes.DIRECTIVE && SCOPING.includes(p.name))
function findElement(nodes: TemplateChildNode[]): ElementNode | null {
  const tags = new Set([props.name, kebab(props.name).replace(/^-/, "")])
  for (const node of nodes) {
    if (node.type !== NodeTypes.ELEMENT || scoping(node)) continue
    if (tags.has(node.tag)) return node
    const inner = findElement(node.children)
    if (inner) return inner
  }
  return null
}

const source = computed(() => props.entry.template.trim())
const element = computed(() => {
  try {
    return findElement(parse(source.value).children)
  } catch {
    return null
  }
})

const propName = (p: AttributeNode | DirectiveNode) =>
  p.type === NodeTypes.ATTRIBUTE ? camel(p.name) : p.name === "bind" && p.arg?.type === NodeTypes.SIMPLE_EXPRESSION ? camel(p.arg.content) : null

// The example's own attributes, minus the ones a control now owns and the
// conditions that would hide it (`v-if` on state the playground never sets).
const kept = computed(() =>
  (element.value?.props ?? []).filter((p) => {
    if (p.type === NodeTypes.DIRECTIVE && ["if", "else-if", "else", "show", "for"].includes(p.name)) return false
    const name = propName(p)
    return !(name && controlled.value.has(name))
  }),
)

const inner = computed(() => {
  const children = element.value?.children ?? []
  if (!children.length) return ""
  return source.value.slice(children[0]!.loc.start.offset, children[children.length - 1]!.loc.end.offset)
})

// An overlay is closed until something opens it; the example opens it with a
// button of its own, which is not part of the element.
const opener = computed(() => {
  const model = element.value?.props.find(
    (p): p is DirectiveNode =>
      p.type === NodeTypes.DIRECTIVE && p.name === "model" && p.arg?.type === NodeTypes.SIMPLE_EXPRESSION && p.arg.content === "open",
  )
  return model?.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? model.exp.content : null
})

const scope = ref<Record<string, unknown>>({})
const values = reactive<Record<string, unknown>>({})

function evaluate(expression: string): unknown {
  try {
    return new Function("scope", `with (scope) { return (${expression}) }`)(scope.value)
  } catch {
    return undefined
  }
}

// A control starts where the example has it, else at the component's default.
function startOf(control: Control): unknown {
  const own = element.value?.props.find((p) => propName(p) === control.name)
  if (!own) return control.base
  if (own.type === NodeTypes.ATTRIBUTE) return own.value ? own.value.content : true
  return own.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? evaluate(own.exp.content) : control.base
}

const failed = ref<string | null>(null)
watch(
  () => props.name,
  () => {
    scope.value = reactive(props.entry.state?.() ?? {})
    for (const k of Object.keys(values)) delete values[k]
    for (const c of controls.value) {
      const start = startOf(c)
      values[c.name] = c.kind === "choice" || c.kind === "string" || c.kind === "number" || c.kind === "boolean" ? start : undefined
    }
    failed.value = null
  },
  { immediate: true },
)

const openTag = (attrs: string[]) => [`<${props.name}`, ...attrs].join(" ")
const close = (open: string) => (inner.value ? `${open}>${inner.value}</${props.name}>` : `${open} />`)

// Every control is bound all the time, so a toggle changes a value rather
// than the template, and the component is not rebuilt on each click.
const live = computed(() => {
  if (!element.value) return null
  const bound = controls.value.map((c) => `:${kebab(c.name)}="lpPlay['${c.name}']"`)
  const tag = close(openTag([...kept.value.map((p) => p.loc.source), ...bound]))
  const button = opener.value
    ? `<LpButton variant="outline" size="sm" @click="${opener.value} = true">Open ${props.name.replace(/^Lp/, "")}</LpButton>`
    : ""
  return `<div class="mx-auto flex w-full max-w-lg flex-col gap-3">${button ? `<div>${button}</div>` : ""}<div>${tag}</div></div>`
})

const Live = computed<Component | null>(() =>
  live.value
    ? {
        components: { LpButton, ...props.entry.components },
        setup: () => Object.assign(scope.value, { lpPlay: values }),
        template: live.value,
      }
    : null,
)

const Boundary = defineComponent({
  setup(_, { slots }) {
    onErrorCaptured((e) => {
      failed.value = e instanceof Error ? e.message : String(e)
      return false
    })
    return () => slots.default?.()
  },
})

// Without the element in the example, the component alone, from props.
const hasDefault = computed(() => props.slots.includes("default"))
// Data a component cannot be drawn without and no control can supply.
const missing = computed(() => props.meta.filter((p) => p.required && !controlled.value.has(camel(p.name))).map((p) => p.name))
const label = computed(() => props.name.replace(/^Lp/, ""))
const Bare = computed(() => () => {
  const bound = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== ""))
  return h(props.component, bound, hasDefault.value ? { default: () => label.value } : undefined)
})

// The code: the example's element with the controls that differ from the
// component's default written in as values.
const code = computed(() => {
  const changed = controls.value
    .filter((c) => {
      const v = values[c.name]
      return v !== undefined && v !== "" && v !== null && v !== c.base
    })
    .map((c) => {
      const v = values[c.name]
      if (v === true) return kebab(c.name)
      if (typeof v === "boolean" || typeof v === "number") return `:${kebab(c.name)}="${v}"`
      return `${kebab(c.name)}="${String(v).replace(/"/g, "&quot;")}"`
    })
  if (!element.value) return hasDefault.value ? `${openTag(changed)}>${label.value}</${props.name}>` : `${openTag(changed)} />`
  return close(openTag([...kept.value.map((p) => p.loc.source), ...changed]))
})
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
    <div class="flex min-w-0 flex-col gap-3">
      <div class="flex min-h-48 items-center justify-center overflow-x-auto rounded-card border border-line bg-surface p-8 [justify-content:safe_center]">
        <p v-if="failed" class="flex items-start gap-2 text-sm text-danger">
          <LpIcon name="lucide:triangle-alert" :size="16" class="mt-0.5 shrink-0" />{{ failed }}
        </p>
        <Boundary v-else-if="Live" :key="name">
          <component :is="Live" />
        </Boundary>
        <p v-else-if="missing.length" class="max-w-sm text-center text-sm text-muted">
          {{ name }} is drawn from data ({{ missing.join(", ") }}), which its examples set up: see the Example tab.
        </p>
        <Boundary v-else :key="`${name}-bare`">
          <component :is="Bare" />
        </Boundary>
      </div>
      <LpCodeBlock :model-value="code" lang="html" copyable />
    </div>
    <div class="flex flex-col gap-3 rounded-card border border-line bg-surface-raised p-4">
      <p v-if="!controls.length" class="text-sm text-muted">This component is set up with data rather than switches: see the example.</p>
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
        <LpNumberField
          v-else-if="c.kind === 'number'"
          v-model="values[c.name] as number"
          size="sm"
          :step-snapping="false"
          :format-options="{ maximumFractionDigits: 6 }"
        />
        <LpInput v-else v-model="values[c.name] as string" size="sm" />
      </label>
    </div>
  </div>
</template>
