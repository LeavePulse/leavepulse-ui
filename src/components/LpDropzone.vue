<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

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
 * `links` adds the fourth thing people expect to put there: an address. It
 * arrives by the same routes. A picture dragged from another tab comes as a
 * URL, not a file (Chrome gives no file for a cross-origin image), a copied
 * address is pasted, and "or a link" in the zone turns it into an address
 * field in place, with no extra row the layout has to find room for. Only
 * http(s) addresses are taken; whether the address really serves the right
 * thing is the app's call, since a page cannot fetch most of them anyway.
 *
 * The press target is a BUTTON stretched under the content. It was a div with
 * a click handler first, which is invisible to a keyboard; then the whole zone
 * was the button, which left no room for the address field, since nothing
 * interactive may sit inside a button. The content sits above it and lets
 * clicks through, except the controls the zone itself puts there.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue"
import { HINT_SIGNALS, noteDropzone } from "../composables/useHintSystem"
import { hints } from "../composables/useHints"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useReveal } from "../composables/useReveal"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpInput from "./LpInput.vue"

const props = withDefaults(
  defineProps<{
    /** Same syntax as the input's: "image/*", ".yaml,.yml". */
    accept?: string
    /** Take more than one at a time. */
    multiple?: boolean
    disabled?: boolean
    /**
     * A drag the page itself cannot see is over the zone. Desktop shells
     * (Tauri, Electron) often take file drags natively, and the page then gets
     * no dragenter or dragover at all, only the shell's own events; the app
     * hit-tests those and passes the answer here so the zone lights up the same.
     */
    dragOver?: boolean
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
    /**
     * Also take an address: dropped from another page, pasted, or typed after
     * "or a link". Arrives as the `link` event.
     */
    links?: boolean
    labels?: Partial<{ orLink: string; placeholder: string; done: string; keys: string; invalid: string }>
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
  /** An http(s) address, when `links` is on. */
  (e: "link", url: string): void
}>()

const labels = useLabels(
  "dropzone",
  {
    orLink: "or a link",
    placeholder: "https://…",
    done: "Add",
    keys: "Enter to add · Esc to go back",
    invalid: "That is not a link: it should start with http:// or https://",
  },
  () => props.labels,
)

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
const pointerOver = ref(false)
const over = computed(() => pointerOver.value || (props.dragOver && !props.disabled))

function onDragOver(event: DragEvent) {
  if (props.disabled) return
  pointerOver.value = true
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
}

function onDragLeave(event: DragEvent) {
  // relatedTarget is where the pointer went. Still inside the zone means the
  // drag merely crossed a child, and the highlight stays.
  const to = event.relatedTarget as Node | null
  if (to && (event.currentTarget as HTMLElement).contains(to)) return
  pointerOver.value = false
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

/** The address in a string, if the whole of it is one http(s) address. */
function addressIn(text: string | undefined | null): string | null {
  const value = text?.trim()
  if (!value || /\s/.test(value)) return null
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null
  } catch {
    return null
  }
}

/*
 * What a drag without files points at. A picture dragged out of a page brings
 * the page's markup, and its <img src> is the picture itself, while the
 * uri-list may be the page around it (a search result links to the site). So
 * for an image zone the picture wins; otherwise the first listed address.
 */
function droppedAddress(data: DataTransfer): string | null {
  const html = data.getData("text/html")
  const fromImage = html ? new DOMParser().parseFromString(html, "text/html").querySelector("img")?.getAttribute("src") : null
  const list = data.getData("text/uri-list").split(/\r?\n/).find((line) => line && !line.startsWith("#"))
  const wantsImage = !props.accept || /image\//.test(props.accept)
  const ordered = wantsImage ? [fromImage, list, data.getData("text/plain")] : [list, data.getData("text/plain"), fromImage]
  for (const candidate of ordered) {
    const url = addressIn(candidate)
    if (url) return url
  }
  return null
}

// A picture dragged out of some pages is inlined as data: rather than linked;
// that is a file in all but name, so it goes the file route.
async function inlinePicture(data: DataTransfer): Promise<File | null> {
  const html = data.getData("text/html")
  const src = html ? new DOMParser().parseFromString(html, "text/html").querySelector("img")?.getAttribute("src") : null
  if (!src?.startsWith("data:image/")) return null
  const blob = await (await fetch(src)).blob()
  return new File([blob], `image.${blob.type.split("/")[1] ?? "png"}`, { type: blob.type })
}

async function onDrop(event: DragEvent) {
  pointerOver.value = false
  const data = event.dataTransfer
  if (!data || props.disabled) return
  direct()
  if (data.files.length) return take(data.files)
  if (!props.links) return
  const url = droppedAddress(data)
  if (url) return emit("link", url)
  const inlined = await inlinePicture(data)
  if (inlined) take([inlined])
}

function onPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files ?? [])
  // Only swallow the paste when it actually carried something for the zone: a
  // paste into a field that happens to sit inside it must still reach the
  // field. A copied picture brings its file and its address; the file wins.
  if (files.length) {
    event.preventDefault()
    direct()
    return take(files)
  }
  const url = props.links ? addressIn(event.clipboardData?.getData("text/plain")) : null
  if (!url || props.disabled) return
  event.preventDefault()
  direct()
  emit("link", url)
}

/*
 * Typing an address. The zone's content gives way to the field, so the zone
 * keeps its place and size; Enter adds, Escape or leaving the field puts the
 * zone back. A click on the zone around the field also only closes it: the
 * file dialog opening under a half-typed address would lose it.
 */
const linking = ref(false)
const draft = ref("")
const invalid = ref(false)
const linkField = ref<InstanceType<typeof LpInput> | null>(null)
const pressTarget = ref<HTMLButtonElement | null>(null)

// The zone keeps its height while the field stands in for its content, so
// nothing below it moves when an address is being typed.
const heldHeight = ref<number | null>(null)

function startLink() {
  if (!props.links || props.disabled) return
  heldHeight.value = (revealAnchor.value as HTMLElement | null)?.offsetHeight ?? null
  linking.value = true
  invalid.value = false
}

// Released only once the zone's own content is back: between the field fading
// out and the content fading in the zone is empty, and without the hold it
// would collapse for that moment and jump back.
function contentBack() {
  if (!linking.value) heldHeight.value = null
}

// The field arrives only after the zone's content has faded out, later than
// the next tick, so it takes focus when it is actually there.
watch(linkField, (field) => {
  if (field && linking.value) field.focus()
})

function stopLink(refocus = true) {
  linking.value = false
  draft.value = ""
  invalid.value = false
  if (refocus) void nextTick(() => pressTarget.value?.focus())
}

function addLink() {
  const url = addressIn(draft.value)
  if (!url) {
    invalid.value = true
    linkField.value?.focus()
    return
  }
  emit("link", url)
  stopLink()
}

function onLinkKey(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault()
    addLink()
  } else if (event.key === "Escape") {
    event.preventDefault()
    event.stopPropagation()
    stopLink()
  }
}

function onLinkLeave(event: FocusEvent) {
  const to = event.relatedTarget as Node | null
  // Into the zone's own press target: its click closes the field, and closing
  // here first would let that same click open the file dialog.
  if (to && (to === pressTarget.value || (event.currentTarget as HTMLElement).contains(to))) return
  if (!draft.value.trim()) stopLink(false)
}

watch(draft, () => (invalid.value = false))

function press() {
  if (linking.value) return stopLink()
  input.value?.click()
}

const contentId = useId()

// Usage for `dropzoneTip`: someone who keeps going through the file dialog
// and never drops or pastes gets told that the zone takes both.
function direct() {
  hints.use(HINT_SIGNALS.dropzoneDirect)
}

function onPicked(event: Event) {
  const el = event.target as HTMLInputElement
  if (el.files?.length) {
    hints.use(HINT_SIGNALS.dropzoneBrowse)
    const zone = revealAnchor.value
    if (zone instanceof Element) noteDropzone(zone)
  }
  take(el.files)
  // Cleared so picking the same file twice in a row fires again — otherwise
  // "I chose the wrong one, let me redo it" silently does nothing.
  el.value = ""
}

function windowPaste(event: ClipboardEvent) {
  // Already taken by the zone itself, which the paste bubbled up from.
  if (props.disabled || event.defaultPrevented) return
  const target = event.target as HTMLElement | null
  // A paste aimed at somewhere you can type belongs to that thing.
  if (target?.closest("input, textarea, [contenteditable]")) return
  onPaste(event)
}

let listening = false
function listen(on: boolean) {
  if (on === listening || typeof window === "undefined") return
  listening = on
  if (on) window.addEventListener("paste", windowPaste)
  else window.removeEventListener("paste", windowPaste)
}
let mounted = false
onMounted(() => {
  mounted = true
  listen(props.pasteTarget)
})
watch(
  () => props.pasteTarget,
  (on) => mounted && listen(on),
)
onBeforeUnmount(() => {
  mounted = false
  listen(false)
})

defineExpose({ browse: () => input.value?.click(), link: startLink })

// The zone is a full-width block with generous padding by default, which is
// the right shape on a page and the wrong one in a sidebar — `class="w-40"`
// and `class="py-2"` have to be able to say so. The drag/reveal state classes
// go through the same merge so there is a single class source on the root.
const { class: rootClass, attrs: rest } = useMergedAttrs(() => [
  "lp-dropzone relative flex w-full flex-col items-center justify-center gap-2 rounded-card px-6 py-8 text-center transition-colors duration-[var(--duration-fast)] has-[>.lp-dropzone__press:focus-visible]:ring-2 has-[>.lp-dropzone__press:focus-visible]:ring-ring",
  props.disabled ? "cursor-not-allowed opacity-55" : "",
  over.value ? "bg-brand-soft" : TONES[props.tone],
  over.value ? "lp-dropzone--over" : "",
  props.animate && !revealed.value ? "lp-dropzone--waiting" : "",
].join(" "))
</script>

<template>
  <div
    ref="revealAnchor"
    :class="rootClass"
    :aria-disabled="disabled || undefined"
    :style="heldHeight ? { minHeight: `${heldHeight}px` } : undefined"
    @dragenter.prevent="onDragOver"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <button
      ref="pressTarget"
      type="button"
      class="lp-dropzone__press absolute inset-0 rounded-[inherit] focus-visible:outline-none disabled:cursor-not-allowed"
      :disabled="disabled"
      :aria-labelledby="rest['aria-label'] ? undefined : contentId"
      v-bind="rest"
      @click="press"
      @paste="onPaste"
    />
    <!-- The border is drawn rather than declared, because `border-style:
         dashed` cannot be moved: a CSS border has no dash offset to animate.
         At rest it is a plain dashed outline; while something is being dragged
         over it the dashes travel, which answers "yes, let go here" to
         peripheral vision — the pointer is what the person is watching, not
         this box. -->
    <svg
      aria-hidden="true"
      class="lp-dropzone__frame pointer-events-none absolute inset-0 size-full"
    >
      <rect
        x="0.5"
        y="0.5"
        width="calc(100% - 1px)"
        height="calc(100% - 1px)"
        rx="var(--radius-card)"
        fill="none"
        stroke-width="1"
        stroke-dasharray="6 5"
      />
    </svg>

    <Transition
      mode="out-in"
      enter-active-class="transition-[opacity,translate] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-[var(--duration-fast)] ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0 translate-y-1"
      leave-to-class="opacity-0"
      @after-enter="contentBack"
    >
      <div
        v-if="linking"
        key="link"
        class="relative z-10 flex w-full max-w-md flex-col gap-1.5"
        @focusout="onLinkLeave"
      >
        <div class="flex items-center gap-2">
          <LpInput
            ref="linkField"
            v-model="draft"
            class="min-w-0 flex-1"
            size="sm"
            type="url"
            icon="lucide:link"
            :invalid="invalid"
            :placeholder="labels.placeholder"
            :aria-label="labels.placeholder"
            @keydown="onLinkKey"
          />
          <LpButton size="sm" @click="addLink">{{ labels.done }}</LpButton>
        </div>
        <span class="text-xs" :class="invalid ? 'text-danger' : 'text-muted'" aria-live="polite">{{ invalid ? labels.invalid : labels.keys }}</span>
      </div>
      <div
        v-else
        :id="contentId"
        key="zone"
        class="pointer-events-none relative flex w-full flex-1 flex-col items-center justify-center gap-[inherit]"
      >
        <slot :over="over" :start-link="startLink">
          <LpIcon
            :name="icon"
            :size="22"
            class="text-muted transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
            :class="over ? 'scale-110 text-brand' : ''"
          />
          <span v-if="title" class="text-sm font-medium text-ink">{{ title }}</span>
          <span v-if="hint || links" class="text-xs text-muted">
            {{ hint }}<template v-if="hint && links"> · </template><button
              v-if="links"
              type="button"
              class="pointer-events-auto rounded-inner font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
              :disabled="disabled"
              @click.stop="startLink"
            >{{ labels.orLink }}</button>
          </span>
        </slot>
      </div>
    </Transition>

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
  </div>
</template>

<style scoped>
.lp-dropzone__frame rect {
  stroke: var(--color-line);
  transition: stroke var(--duration-fast) linear;
}

.lp-dropzone:hover .lp-dropzone__frame rect {
  stroke: var(--color-line-strong);
}

/* Marching ants, and only while a drag is in flight. At rest this would be a
   loop nobody asked for, running for as long as the page is open and competing
   with every other thing on it; under a drag it is the answer to "can I let go
   here". One dash period per cycle, so the travel is continuous rather than
   jumping back at the seam. */
.lp-dropzone--over .lp-dropzone__frame rect {
  stroke: var(--color-brand);
  animation: lp-dropzone-ants 500ms linear infinite;
}

@keyframes lp-dropzone-ants {
  to {
    stroke-dashoffset: -11;
  }
}

/* The dashes fade in and the block settles up a few pixels. */
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

  /* The ants stop, the colour stays: the brand stroke is what says "drop
     here", and it says it standing still. */
  .lp-dropzone--over .lp-dropzone__frame rect {
    animation: none;
  }
}
</style>
