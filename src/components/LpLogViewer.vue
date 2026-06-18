<script setup lang="ts">
/*
 * Terminal-flavoured log stream. Monospace rows, a tonal level gutter, optional
 * timestamps + source tags, search highlighting, and a sticky "tail" that pins
 * to the bottom as lines arrive (drops out the moment you scroll up, with a
 * jump-to-latest pill to re-arm). Built on LpScrollArea, which exposes its
 * viewport element and re-emits the native scroll event — exactly what tailing
 * needs.
 */
import { computed, nextTick, ref, watch } from "vue"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "success"

export interface LogLine {
  /** Body of the line. */
  message: string
  level?: LogLevel
  /** Epoch ms, ISO string, or pre-formatted label — shown in the time column. */
  time?: number | string
  /** Short origin tag (service / module), rendered as a dim chip. */
  source?: string
}

const props = withDefaults(
  defineProps<{
    lines: LogLine[]
    /** Show the timestamp column. */
    showTime?: boolean
    /** Show 1-based gutter line numbers. */
    lineNumbers?: boolean
    /** Wrap long lines instead of scrolling horizontally. */
    wrap?: boolean
    /** Case-insensitive substring to highlight in message bodies. */
    highlight?: string
    /** When set with `highlight`, hide every line that doesn't match. */
    filterMatches?: boolean
    /** Pin to the bottom as new lines arrive (until the user scrolls up). */
    tail?: boolean
    /** Fixed height. Anything CSS-valid; defaults to a comfortable terminal. */
    height?: string
    emptyLabel?: string
  }>(),
  {
    showTime: true,
    lineNumbers: false,
    wrap: false,
    tail: true,
    height: "20rem",
    emptyLabel: "No logs yet",
  },
)

// Level → gutter rail + text colour. Reads only semantic tokens so re-skinning
// just works. trace/debug stay muted; success is green; warn amber; error/fatal
// red (fatal gets a filled chip to stand apart from plain error).
const levelMeta: Record<LogLevel, { rail: string; text: string; chip: string }> = {
  trace: { rail: "bg-line-strong", text: "text-muted", chip: "text-muted" },
  debug: { rail: "bg-line-strong", text: "text-muted-strong", chip: "text-muted-strong" },
  info: { rail: "bg-brand", text: "text-ink", chip: "text-brand" },
  success: { rail: "bg-action", text: "text-ink", chip: "text-action" },
  warn: { rail: "bg-accent", text: "text-ink", chip: "text-accent" },
  error: { rail: "bg-danger", text: "text-ink", chip: "text-danger" },
  fatal: { rail: "bg-danger", text: "text-ink", chip: "rounded-xs bg-danger px-1 text-ink-inverse" },
}

function metaFor(level?: LogLevel) {
  return levelMeta[level ?? "info"]
}

// Rows actually rendered, each carrying its ORIGINAL index so line numbers stay
// truthful when filtering. With filterMatches + a search term, keep only lines
// whose message contains it (case-insensitive); otherwise pass everything.
const visibleLines = computed<{ line: LogLine; n: number }[]>(() => {
  const term = props.filterMatches ? props.highlight?.trim().toLowerCase() : ""
  return props.lines
    .map((line, n) => ({ line, n }))
    .filter(({ line }) => !term || line.message.toLowerCase().includes(term))
})

// True when filtering has emptied an otherwise non-empty stream.
const filteredEmpty = computed(
  () => props.lines.length > 0 && visibleLines.value.length === 0,
)

function fmtTime(time?: number | string): string {
  if (time == null) return ""
  if (typeof time === "number" || /^\d+$/.test(time)) {
    const d = new Date(Number(time))
    if (Number.isNaN(d.getTime())) return String(time)
    return d.toLocaleTimeString(undefined, { hour12: false }) + "." +
      String(d.getMilliseconds()).padStart(3, "0")
  }
  return time
}

// Split a message around the (case-insensitive) highlight term so we can wrap
// matches in <mark> without v-html. Empty/absent term → single plain part.
interface Part {
  text: string
  hit: boolean
}
function splitHighlight(message: string): Part[] {
  const term = props.highlight?.trim()
  if (!term) return [{ text: message, hit: false }]
  const parts: Part[] = []
  const lower = message.toLowerCase()
  const needle = term.toLowerCase()
  let i = 0
  while (i < message.length) {
    const at = lower.indexOf(needle, i)
    if (at === -1) {
      parts.push({ text: message.slice(i), hit: false })
      break
    }
    if (at > i) parts.push({ text: message.slice(i, at), hit: false })
    parts.push({ text: message.slice(at, at + needle.length), hit: true })
    i = at + needle.length
  }
  return parts
}

// ── tail / auto-scroll ───────────────────────────────────────────────
const scrollRef = ref<{ viewportEl: HTMLElement | null } | null>(null)
const pinned = ref(true) // currently glued to the bottom
// Slack from the bottom that still counts as "pinned". Generous (a few rows
// tall) so a freshly pushed line — which momentarily grows scrollHeight before
// the tail catches up — doesn't unpin us and flash the jump-to-latest pill;
// only a deliberate scroll up past this clears it.
const NEAR = 120

function viewport(): HTMLElement | null {
  return scrollRef.value?.viewportEl ?? null
}

function atBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR
}

function onScroll(e: Event) {
  pinned.value = atBottom(e.target as HTMLElement)
}

// Glide to the bottom. Honours OS reduce-motion. For auto-tail we skip the
// animation on large jumps (`far`), where a smooth chase would feel sluggish —
// but a deliberate "jump to latest" passes force=true to always animate.
function rideToBottom(smooth = true, force = false) {
  const el = viewport()
  if (!el) return
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  const far = !force && el.scrollHeight - el.scrollTop - el.clientHeight > el.clientHeight
  el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduce && !far ? "smooth" : "auto" })
}

function scrollToBottom() {
  rideToBottom(true, true)
  pinned.value = true
}

// New lines: if tailing and pinned, glide the bottom into view after the DOM
// settles. Two frames — one for the DOM, one so the row's enter transition has
// started growing the scroll height before we chase it.
watch(
  () => props.lines.length,
  async () => {
    if (!props.tail || !pinned.value) return
    await nextTick()
    requestAnimationFrame(() => rideToBottom(true))
  },
)

const showJump = computed(() => props.tail && !pinned.value && props.lines.length > 0)
</script>

<template>
  <div
    class="relative overflow-hidden rounded-card border border-line bg-surface font-mono text-xs leading-relaxed"
  >
    <LpScrollArea
      ref="scrollRef"
      fade
      :content-class="wrap ? '' : 'min-w-max'"
      :style="{ height }"
      @scroll="onScroll"
    >
      <div
        v-if="lines.length === 0 || filteredEmpty"
        class="flex h-full flex-col items-center justify-center gap-1 px-4 py-10 text-center"
      >
        <span class="text-muted">{{ filteredEmpty ? "No lines match" : emptyLabel }}</span>
        <span v-if="filteredEmpty" class="text-muted/70">“{{ highlight }}”</span>
      </div>

      <TransitionGroup
        v-else
        tag="ol"
        class="py-1"
        enter-active-class="transition duration-200 ease-[var(--ease-emphasized)]"
        enter-from-class="-translate-x-1 opacity-0"
        move-class="transition-transform duration-200 ease-[var(--ease-emphasized)]"
      >
        <li
          v-for="{ line, n } in visibleLines"
          :key="n"
          class="group flex items-start gap-0 px-0 transition-colors hover:bg-surface-soft/60"
        >
          <!-- level rail -->
          <span
            class="mr-2 w-0.5 shrink-0 self-stretch"
            :class="metaFor(line.level).rail"
            aria-hidden="true"
          />

          <!-- line number -->
          <span
            v-if="lineNumbers"
            class="mr-3 w-10 shrink-0 select-none text-right tabular-nums text-muted/70"
          >{{ n + 1 }}</span>

          <!-- timestamp -->
          <span
            v-if="showTime"
            class="mr-3 shrink-0 select-none tabular-nums text-muted"
          >{{ fmtTime(line.time) }}</span>

          <!-- level chip -->
          <span
            class="mr-3 w-12 shrink-0 select-none text-[10px] font-semibold uppercase tracking-[0.06em]"
            :class="metaFor(line.level).chip"
          >{{ line.level ?? "info" }}</span>

          <!-- source tag -->
          <span
            v-if="line.source"
            class="mr-2 shrink-0 select-none text-muted-strong"
          >[{{ line.source }}]</span>

          <!-- message -->
          <span
            class="min-w-0 pr-3"
            :class="[metaFor(line.level).text, wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre']"
          >
            <template v-for="(part, p) in splitHighlight(line.message)" :key="p">
              <mark
                v-if="part.hit"
                class="rounded-xs bg-accent/30 text-ink"
              >{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </span>
        </li>
      </TransitionGroup>
    </LpScrollArea>

    <!-- jump-to-latest: shown only when tailing and scrolled away. The
         Transition rides an outer wrapper so its transform/opacity don't fight
         the button's own -translate-x-1/2 centring and hover colour transition. -->
    <Transition
      enter-active-class="transition duration-200 ease-[var(--ease-emphasized)]"
      enter-from-class="translate-y-3 scale-90 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-3 scale-90 opacity-0"
    >
      <div v-if="showJump" class="absolute inset-x-0 bottom-3 flex justify-center">
        <button
          type="button"
          class="group flex items-center gap-1.5 rounded-pill border border-line bg-surface-overlay px-3 py-1 text-xs font-medium text-ink shadow-[var(--shadow-panel)] backdrop-blur outline-none transition-colors hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring"
          @click="scrollToBottom"
        >
          <LpIcon
            name="lucide:arrow-down"
            :size="14"
            class="transition-transform duration-200 ease-[var(--ease-emphasized)] group-hover:translate-y-0.5"
          />
          Jump to latest
        </button>
      </div>
    </Transition>
  </div>
</template>
