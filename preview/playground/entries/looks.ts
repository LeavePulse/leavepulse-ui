import { defineComponent, h, reactive } from "vue"
import {
  LpAvatar,
  LpBadge,
  LpButton,
  LpCollapse,
  LpDropzone,
  LpHoverCard,
  LpIcon,
  LpIdenticon,
  LpInput,
  LpPagination,
  LpSegmented,
  LpSelect,
  LpShaderBackdrop,
  LpSlider,
  LpSwitch,
  provideLpConfig,
  pseudoLocalize,
  SHADER_PRESETS,
} from "../../../src"
import type { ComponentEntry } from "./shared"

// Overlays and look: components built from ideas seen in other kits, written from scratch.
// Each array lands in the section it is named after (see registry.ts).

/* Turns pseudo-localisation on for every kit label below it, the way an app would at its root. */
const PseudoScope = defineComponent({
  name: "PseudoScope",
  props: { on: { type: Boolean, default: false } },
  setup(props, { slots }) {
    provideLpConfig(() => ({ pseudoLocale: props.on }))
    return () => h("div", { class: "contents" }, slots.default?.())
  },
})

const presetOptions = SHADER_PRESETS.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))

export const looksBasics: ComponentEntry[] = [
  {
    id: "identicon",
    name: "Identicon",
    description:
      "A face for whatever has no picture: a mirrored pixel pattern and a colour derived from a string. The same seed always draws the same identicon, and the colour stays in a band that reads on dark and light themes. On its own as LpIdenticon, inside LpAvatar through `identicon` (true derives it from `alt`, a string is the seed), and as `identicon()` / `identiconSvg()` for a canvas or a favicon.",
    components: { LpAvatar, LpIdenticon, LpInput, LpSegmented },
    state: () => reactive({ seed: "ada.lovelace", grid: "5" }),
    template: `<div class="flex w-96 flex-col gap-5">
  <LpInput v-model="seed" placeholder="Any string: an id, a name, a key" />
  <div class="flex items-center gap-4">
    <LpAvatar :alt="seed" identicon size="xl" />
    <LpAvatar :alt="seed" identicon size="xl" shape="soft" />
    <LpIdenticon :seed="seed" :grid="Number(grid)" class="size-16 rounded-card" :label="'Identicon for ' + seed" />
    <LpSegmented v-model="grid" :options="[{ value: '5', label: '5' }, { value: '7', label: '7' }]" size="sm" />
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <LpAvatar v-for="n in 12" :key="n" :alt="'user-' + n" identicon size="md" />
  </div>
  <div class="flex items-center gap-3 text-sm text-muted">
    <LpAvatar alt="Ada Lovelace" size="md" /> Default stays initials
    <LpAvatar alt="Ada Lovelace" identicon fallback="AL" size="md" /> fallback text still wins
  </div>
</div>`,
    thumb: `<div class="flex flex-col items-center gap-3">
  <div class="flex items-center gap-3">
    <LpAvatar :alt="tSeed + '-a'" identicon size="xl" />
    <LpAvatar :alt="tSeed + '-b'" identicon size="xl" shape="soft" />
    <LpAvatar :alt="tSeed + '-c'" identicon size="xl" />
  </div>
  <div class="flex items-center gap-2">
    <LpAvatar v-for="n in 6" :key="n" :alt="tSeed + n" identicon size="sm" />
  </div>
</div>`,
    thumbLoop: { every: 1800, frames: [{ tSeed: "lp" }, { tSeed: "kit" }, { tSeed: "pulse" }] },
  },
  {
    id: "pseudo-locale",
    name: "Pseudo-locale",
    description:
      "A development switch for translations: `lpConfig({ pseudoLocale: true })` shows every kit label accented, about a third longer and in brackets. Plain English left on screen never went through the labels; a clipped bracket is truncation; a label that overflows here will overflow in German. `pseudoLocalize(text)` does the same to an app's own strings and leaves `{placeholders}`, `%s` and tags alone.",
    components: { PseudoScope, LpSelect, LpDropzone, LpPagination, LpSwitch, LpButton },
    state: () => reactive({ on: true, value: undefined, page: 3, sample: pseudoLocalize("Welcome back, {name}") }),
    template: `<div class="flex w-[28rem] flex-col gap-4">
  <label class="flex items-center gap-2 text-sm text-muted"><LpSwitch v-model="on" /> Pseudo-locale</label>
  <PseudoScope :on="on">
    <div class="flex flex-col gap-4">
      <LpSelect v-model="value" :options="[{ value: 'eu', label: 'Europe' }, { value: 'na', label: 'North America' }]" class="w-48" />
      <LpDropzone links title="Drop files here" hint="App text stays English: it is not a kit label" class="h-36" />
      <LpPagination v-model:page="page" :total="120" :page-size="10" />
    </div>
  </PseudoScope>
  <p class="font-mono text-xs text-muted">pseudoLocalize("Welcome back, {name}") → {{ sample }}</p>
</div>`,
    thumb: `<PseudoScope :on="tOn">
  <div class="flex w-64 flex-col gap-3">
    <LpSelect :options="[{ value: 'a', label: 'A' }]" class="w-full" />
    <LpPagination :page="2" :total="50" :page-size="10" :siblings="0" />
  </div>
</PseudoScope>`,
    thumbLoop: { every: 1800, frames: [{ tOn: false }, { tOn: true }] },
  },
]

export const looksForms: ComponentEntry[] = []
export const looksData: ComponentEntry[] = []

export const looksOverlays: ComponentEntry[] = [
  {
    id: "hover-card",
    name: "HoverCard",
    description:
      "A preview that opens when the pointer rests on a name or a link: a profile, a server's status, where a link goes. Waits longer than a tooltip (passing over a list flashes nothing), opens at once on keyboard focus, stays open while the pointer crosses to it, and on touch opens on press-and-hold without following the link (`touch=\"none\"` to leave touch alone). Not a place for the only way to do something: whatever it holds must be reachable without it.",
    components: { LpHoverCard, LpAvatar, LpBadge, LpButton, LpIcon, LpSwitch },
    state: () => reactive({ arrow: true, open: false }),
    template: `<div class="flex w-96 flex-col gap-4 text-sm text-muted">
  <label class="flex items-center gap-2"><LpSwitch v-model="arrow" /> Arrow</label>
  <p>
    Reviewed by
    <LpHoverCard v-model:open="open" :arrow="arrow">
      <template #trigger>
        <a href="#ada" class="font-medium text-brand underline-offset-2 hover:underline focus-visible:rounded-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" @click.prevent>@ada</a>
      </template>
      <div class="flex gap-3">
        <LpAvatar alt="Ada Lovelace" identicon size="lg" />
        <div class="flex min-w-0 flex-col gap-1">
          <div class="flex items-center gap-2 font-semibold text-ink">Ada Lovelace <LpBadge tone="action" size="sm">Online</LpBadge></div>
          <div class="text-xs text-muted">@ada · moderator since 2024</div>
          <p class="mt-1 text-muted">Writes the first program for an engine that does not exist yet.</p>
          <div class="mt-2 flex gap-4 text-xs text-muted"><span><b class="text-ink">412</b> reviews</span><span><b class="text-ink">38</b> servers</span></div>
        </div>
      </div>
    </LpHoverCard>
    and merged into
    <LpHoverCard side="top" :open-delay="300">
      <template #trigger>
        <a href="#main" class="font-mono text-ink underline decoration-line underline-offset-2" @click.prevent>main</a>
      </template>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2 font-semibold text-ink"><LpIcon name="lucide:git-branch" :size="14" /> main</div>
        <div class="text-xs text-muted">Protected · 1,204 commits · updated 2 hours ago</div>
      </div>
    </LpHoverCard>.
  </p>
  <p class="text-xs">Card is {{ open ? "open" : "closed" }}. Tab to the link to open it from the keyboard.</p>
</div>`,
    thumb: `<div class="flex flex-col items-start gap-2 text-sm text-muted">
  <span>Reviewed by <span class="font-medium text-brand underline underline-offset-2">@ada</span></span>
  <div class="flex w-64 gap-3 rounded-card border border-line bg-surface-overlay p-3 shadow-panel">
    <LpAvatar alt="Ada Lovelace" identicon size="lg" />
    <div class="flex min-w-0 flex-col gap-1">
      <div class="flex items-center gap-2 font-semibold text-ink">Ada Lovelace <LpBadge tone="action" size="sm">Online</LpBadge></div>
      <div class="text-xs text-muted">@ada · moderator</div>
    </div>
  </div>
</div>`,
  },
]

export const looksMotion: ComponentEntry[] = [
  {
    id: "collapse",
    name: "Collapse",
    description:
      "Content that comes and goes by folding open and shut, with no chrome of its own: fields that a switch reveals, a details row, a toolbar group sliding out sideways (`axis=\"width\"`). Toggling mid-way reverses from where it is. `keepMounted` keeps a closed body in the DOM so its state survives, `lazy` delays mounting it until first opened. Reduced motion: instant.",
    components: { LpCollapse, LpSwitch, LpInput, LpButton, LpIcon },
    state: () => reactive({ proxy: true, tools: false, log: [] as string[] }),
    template: `<div class="flex w-96 flex-col gap-5">
  <div class="flex flex-col rounded-card border border-line bg-surface-soft p-4">
    <label class="flex items-center gap-2 text-sm text-ink"><LpSwitch v-model="proxy" /> Use a proxy</label>
    <LpCollapse v-model:open="proxy" keep-mounted @opened="log.unshift('opened')" @closed="log.unshift('closed')">
      <div class="grid gap-3 pt-4">
        <LpInput placeholder="Host" />
        <LpInput placeholder="Port" />
      </div>
    </LpCollapse>
  </div>
  <div class="flex items-center gap-2">
    <LpButton size="sm" variant="soft" @click="tools = !tools">
      <LpIcon :name="tools ? 'lucide:chevron-left' : 'lucide:chevron-right'" :size="14" /> Tools
    </LpButton>
    <LpCollapse v-model:open="tools" axis="width">
      <div class="flex gap-2 whitespace-nowrap">
        <LpButton size="sm" variant="ghost">Bold</LpButton>
        <LpButton size="sm" variant="ghost">Italic</LpButton>
        <LpButton size="sm" variant="ghost">Link</LpButton>
      </div>
    </LpCollapse>
  </div>
  <p class="text-xs text-muted">Events: {{ log.slice(0, 4).join(", ") || "—" }}</p>
</div>`,
    thumb: `<div class="flex w-64 flex-col rounded-card border border-line bg-surface-soft p-3">
  <div class="flex items-center gap-2 text-sm text-ink"><LpSwitch :model-value="tOpen" /> Use a proxy</div>
  <LpCollapse :open="tOpen">
    <div class="grid gap-2 pt-3">
      <div class="h-7 rounded-control border border-line bg-surface"></div>
      <div class="h-7 rounded-control border border-line bg-surface"></div>
    </div>
  </LpCollapse>
</div>`,
    thumbLoop: { every: 1600, frames: [{ tOpen: true }, { tOpen: false }] },
  },
  {
    id: "shader-backdrop",
    name: "ShaderBackdrop",
    description:
      "A slowly moving background drawn with WebGL in the theme's colours: aurora, silk, grain or dots. A CSS still of the same look sits underneath and takes over where WebGL is missing, software-only or too slow (WebKitGTK), under reduced motion, or with `still`. Draws only while visible, caps its frame rate, blends to a new theme's colours, and frees its GL context on unmount.",
    components: { LpShaderBackdrop, LpSegmented, LpSlider, LpSwitch },
    state: () => reactive({ presets: presetOptions, preset: "aurora", intensity: 0.7, speed: 1, paused: false, still: false, mode: "" }),
    template: `<div class="flex w-[34rem] max-w-full flex-col gap-4">
  <LpSegmented v-model="preset" :options="presets" size="sm" />
  <div class="relative h-64 overflow-hidden rounded-card border border-line">
    <LpShaderBackdrop :preset="preset" :intensity="intensity" :speed="speed" :paused="paused" :still="still" @fallback="mode = 'still (' + $event + ')'" />
    <div class="relative flex h-full flex-col items-center justify-center gap-1 text-center">
      <div class="text-xl font-semibold text-ink">Welcome back</div>
      <div class="text-sm text-muted">Text stays readable over every look.</div>
    </div>
  </div>
  <div class="grid grid-cols-2 gap-4 text-sm text-muted">
    <label class="flex flex-col gap-2">Intensity <LpSlider v-model="intensity" :min="0" :max="1" :step="0.05" /></label>
    <label class="flex flex-col gap-2">Speed <LpSlider v-model="speed" :min="0" :max="3" :step="0.1" /></label>
    <label class="flex items-center gap-2"><LpSwitch v-model="paused" /> Paused</label>
    <label class="flex items-center gap-2"><LpSwitch v-model="still" /> CSS still only</label>
  </div>
  <p v-if="mode" class="text-xs text-muted">WebGL not used: {{ mode }}</p>
</div>`,
    thumb: `<div class="relative h-40 w-72 overflow-hidden rounded-card border border-line">
  <LpShaderBackdrop :preset="tPreset" />
  <div class="relative flex h-full items-end p-3 text-xs font-medium capitalize text-ink">{{ tPreset }}</div>
</div>`,
    thumbLoop: { every: 2600, frames: SHADER_PRESETS.map((tPreset) => ({ tPreset })) },
  },
]

