<script setup lang="ts">
/*
 * A place to put files: drop them, click to browse, or paste from the
 * clipboard.
 *
 * All three, because they are the same intent arriving by different routes and
 * a zone that only accepts one of them is the one people call broken. Paste in
 * particular is what a screenshot is: cropped with the OS tool, Ctrl+V, done —
 * there is no file on disk to browse for.
 *
 * Not tied to images. `accept` is passed to the input and used to filter what a
 * drop actually yields, so this is equally the place a YAML import or an
 * attachment lands.
 *
 * The zone is a BUTTON. It was a div with a click handler first, which is
 * invisible to a keyboard: nothing focusable, nothing that Enter activates, and
 * the file dialog unreachable without a mouse.
 */
import { onBeforeUnmount, onMounted, ref } from "vue"
import { useReveal } from "../composables/useReveal"
import LpIcon from "./LpIcon.vue"

const props = withDefaults(
  defineProps<{
    /** Same syntax as the input's: "image/*", ".yaml,.yml". */
    accept?: string
    /** Take more than one at a time. */
    multiple?: boolean
    disabled?: boolean
    /**
     * Also accept a paste anywhere on the page, not only while focused.
     * Off by default: two zones both listening would each take the same
     * screenshot, and a page with one obvious target is the case for it.
     */
    pasteTarget?: boolean
    /** Largest file accepted, in bytes. Bigger ones are rejected, not silently
     *  dropped — a picture that vanishes reads as a broken uploader. */
    maxBytes?: number
    icon?: string
    title?: string
    hint?: string
    /**
     * How the well sits against what holds it. A drop target reads as a hole
     * in the surface, not a tile on top of it, so the default is darker than
     * the card — which is what a dashed border is already suggesting.
     * `flush` for a zone that fills a panel of its own, `soft` when it sits
     * directly on the page background and needs to lift off it instead.
     */
    tone?: "sunken" | "flush" | "soft"
    /** Draw the entrance when the zone first comes into view. */
    animate?: boolean
  }>(),
  {
    accept: "",
    multiple: false,
    icon: "lucide:upload",
    title: "",
    hint: "",
    tone: "sunken",
    animate: true,
  },
)

const TONES = {
  sunken: "bg-surface",
  flush: "bg-surface-raised",
  soft: "bg-surface-soft",
} as const

// Entrance on arrival, not on mount — the kit's rule, and the reason a zone in
// a modal that opens later still draws rather than being found already there.
const { el: revealAnchor, revealed } = useReveal({ immediate: () => !props.animate })

const emit = defineEmits<{
  (e: "files", files: File[]): void
  /** Something was refused, and why — the caller decides how loudly to say so. */
  (e: "rejected", reason: { file: File; cause: "type" | "size" }[]): void
}>()

const input = ref<HTMLInputElement | null>(null)
/*
 * Is a drag over the zone?
 *
 * Answered by asking where the pointer is, not by counting enter/leave pairs.
 * The count is the usual trick and it does not balance: `dragenter` fires for
 * every child the pointer crosses and bubbles, while the matching `dragleave`
 * may not — one stuck increment and the zone stays lit after the drag is long
 * gone, which is exactly what it did.
 */
const over = ref(false)

function onDragOver(event: DragEvent) {
  if (props.disabled) return
  over.value = true
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
}

function onDragLeave(event: DragEvent) {
  // relatedTarget is where the pointer went. Still inside the zone means the
  // drag merely crossed a child, and the highlight stays.
  const to = event.relatedTarget as Node | null
  if (to && (event.currentTarget as HTMLElement).contains(to)) return
  over.value = false
}

/** Does the file match `accept`? Mirrors the input's own matching so a drop
 *  and a browse cannot disagree about what is allowed. */
function matches(file: File): boolean {
  if (!props.accept) return true
  return props.accept.split(",").some((rule) => {
    const pattern = rule.trim().toLowerCase()
    if (!pattern) return false
    if (pattern.startsWith(".")) return file.name.toLowerCase().endsWith(pattern)
    if (pattern.endsWith("/*")) return file.type.startsWith(pattern.slice(0, -1))
    return file.type.toLowerCase() === pattern
  })
}

function take(list: FileList | File[] | null | undefined) {
  if (props.disabled || !list) return
  const all = Array.from(list)
  const kept: File[] = []
  const refused: { file: File; cause: "type" | "size" }[] = []

  for (const file of all) {
    if (!matches(file)) refused.push({ file, cause: "type" })
    else if (props.maxBytes && file.size > props.maxBytes) {
      refused.push({ file, cause: "size" })
    } else kept.push(file)
  }

  // `multiple` bounds the result rather than rejecting the extras: dropping a
  // folder of photographs on a single-file zone should take the first, not
  // refuse the lot.
  const bounded = props.multiple ? kept : kept.slice(0, 1)
  if (refused.length) emit("rejected", refused)
  if (bounded.length) emit("files", bounded)
}

function onDrop(event: DragEvent) {
  over.value = false
  take(event.dataTransfer?.files)
}

function onPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files ?? [])
  if (!files.length) return
  // Only swallow the paste when it actually carried a file: a paste into a
  // field that happens to sit inside the zone must still reach the field.
  event.preventDefault()
  take(files)
}

function onPicked(event: Event) {
  const el = event.target as HTMLInputElement
  take(el.files)
  // Cleared so picking the same file twice in a row fires again — otherwise
  // "I chose the wrong one, let me redo it" silently does nothing.
  el.value = ""
}

function windowPaste(event: ClipboardEvent) {
  if (props.disabled) return
  const target = event.target as HTMLElement | null
  // A paste aimed at somewhere you can type belongs to that thing.
  if (target?.closest("input, textarea, [contenteditable]")) return
  onPaste(event)
}

onMounted(() => {
  if (props.pasteTarget) window.addEventListener("paste", windowPaste)
})
onBeforeUnmount(() => window.removeEventListener("paste", windowPaste))

defineExpose({ browse: () => input.value?.click() })
</script>

<template>
  <button
    ref="revealAnchor"
    type="button"
    :disabled="disabled"
    class="lp-dropzone flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-line px-6 py-8 text-center transition-colors duration-[var(--duration-fast)] hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55"
    :class="[
      over ? 'border-brand bg-brand-soft' : TONES[tone],
      animate && !revealed ? 'lp-dropzone--waiting' : '',
    ]"
    @click="input?.click()"
    @paste="onPaste"
    @dragenter.prevent="onDragOver"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <slot :over="over">
      <LpIcon
        :name="icon"
        :size="22"
        class="text-muted transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
        :class="over ? 'scale-110 text-brand' : ''"
      />
      <span v-if="title" class="text-sm font-medium text-ink">{{ title }}</span>
      <span v-if="hint" class="text-xs text-muted">{{ hint }}</span>
    </slot>

    <input
      ref="input"
      type="file"
      class="hidden"
      :accept="accept || undefined"
      :multiple="multiple"
      :disabled="disabled"
      @change="onPicked"
      @click.stop
    >
  </button>
</template>

<style scoped>
/* The dashes draw themselves in and the block settles up a few pixels. The
   border is a real dashed border rather than an SVG, so the entrance is the
   fade plus the rise — enough to read as arrival without pretending to be a
   stroke animation the browser cannot give a border. */
.lp-dropzone {
  animation: lp-dropzone-in var(--duration-slow) var(--ease-settle) both;
}

.lp-dropzone--waiting {
  opacity: 0;
  animation: none;
}

@keyframes lp-dropzone-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-dropzone,
  .lp-dropzone--waiting {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>
