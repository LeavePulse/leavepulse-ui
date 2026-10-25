import { reactive } from "vue"
import {
  LpButton,
  LpCard,
  LpInput,
  LpScramble,
  LpSegmented,
  LpShinyText,
  LpSwitch,
  LpTextReveal,
  LpTypewriter,
} from "../../../src"
import type { ComponentEntry } from "./shared"

// Text effects: components built from ideas seen in other kits, written from scratch.
// Each array lands in the section it is named after (see registry.ts).
export const textBasics: ComponentEntry[] = []
export const textForms: ComponentEntry[] = []
export const textData: ComponentEntry[] = []
export const textOverlays: ComponentEntry[] = []

const options = (values: string[]) => values.map((value) => ({ value, label: value }))

const KEYS = ["lp_live_7Q2X-9KTA-M4ZD", "lp_live_H8RC-2WPN-6YEB", "lp_live_V3JF-K7SQ-1LUD"]

export const textMotion: ComponentEntry[] = [
  {
    id: "text-reveal",
    name: "TextReveal",
    description:
      "Text that arrives word by word or letter by letter: each piece fades in, rises a little and comes into focus. For the one line a screen is about (a hero heading, an empty state, a fresh result), not body copy. Plays the first time it is on screen; `play` hands the moment to the app and a new `replay-key` plays it again. A changed `text` only moves the words that changed: the gone ones fade, the new ones arrive in their place. Screen readers get the whole string once; it wraps like ordinary text.",
    components: { LpTextReveal, LpSegmented, LpButton, LpInput, LpCard },
    state: () =>
      reactive({
        by: "word",
        units: options(["word", "letter"]),
        replay: 0,
        text: "Your server is ready to take players",
        status: "3 builds running",
        statuses: options(["3 builds running", "4 builds running", "All builds passed"]),
      }),
    template: `<div class="flex w-[28rem] flex-col gap-4">
  <div class="flex items-center gap-2">
    <LpSegmented v-model="by" :options="units" size="sm" />
    <LpButton size="sm" variant="outline" @click="replay++">Replay</LpButton>
  </div>
  <LpCard>
    <LpTextReveal :text="text" :by="by" :replay-key="replay" as="h2" class="m-0 text-2xl font-semibold text-ink" />
  </LpCard>
  <LpInput v-model="text" placeholder="Type a heading" />

  <!-- A changing line: only the words that change move. -->
  <div class="flex items-center gap-2">
    <LpSegmented v-model="status" :options="statuses" size="sm" />
  </div>
  <LpTextReveal :text="status" class="text-sm text-muted" />
</div>`,
    thumb: `<div class="flex w-64 flex-col gap-2">
  <LpTextReveal :text="tHead" :replay-key="tKey" as="p" class="m-0 text-xl font-semibold leading-snug text-ink" />
  <LpTextReveal :text="tLine" by="letter" class="text-sm text-muted" />
</div>`,
    thumbLoop: {
      every: 2400,
      frames: [
        { tHead: "Your server is ready", tKey: 0, tLine: "3 builds running" },
        { tHead: "Your server is ready", tKey: 0, tLine: "4 builds running" },
        { tHead: "Your server is ready", tKey: 1, tLine: "All builds passed" },
      ],
    },
  },
  {
    id: "shiny-text",
    name: "ShinyText",
    description:
      "Accent text with light moving through it, pure CSS. `shine` keeps the tone and sweeps a band across it now and then: a \"New\" tag, a plan name, a status still at work. `gradient` paints the word with the theme's brand, accent and action colours drifting across it, for a display headline. The band moves toward the theme's ink, so it lightens on dark and darkens on light and never washes the word out. Pauses off screen and in hidden tabs; stands still under reduced motion.",
    components: { LpShinyText, LpSegmented, LpSwitch },
    state: () => reactive({ tone: "brand", tones: options(["brand", "accent", "action", "ink"]), speed: 3, paused: false }),
    template: `<div class="flex w-[28rem] flex-col gap-5">
  <LpSegmented v-model="tone" :options="tones" size="sm" />
  <LpShinyText :tone="tone" :speed="speed" :paused="paused" class="text-3xl font-bold">Deploying to eu-west</LpShinyText>
  <LpShinyText variant="gradient" :speed="6" :paused="paused" as="h2" class="m-0 text-4xl font-extrabold tracking-tight">Leave Pulse</LpShinyText>
  <p class="m-0 text-sm text-muted">
    Upgrade to <LpShinyText :tone="tone" class="font-semibold">Pro</LpShinyText> for longer log history.
  </p>
  <label class="flex items-center gap-2 text-sm"><LpSwitch v-model="paused" /> Paused</label>
</div>`,
    thumb: `<div class="flex flex-col items-start gap-2">
  <LpShinyText :speed="2.4" class="text-2xl font-bold">Deploying…</LpShinyText>
  <LpShinyText variant="gradient" :speed="5" class="text-3xl font-extrabold tracking-tight">Leave Pulse</LpShinyText>
</div>`,
  },
  {
    id: "typewriter",
    name: "Typewriter",
    description:
      "Text typed a character at a time, optionally cycling strings: type, hold, erase, next. For a line that suggests rather than states (what a search can find, a hero line, a terminal-style empty state), never for text the reader has to wait for. Keystrokes are uneven and pause after punctuation; erasing stops at what the next string shares. The box reserves the longest string's size so the line around it holds still (`reserve` off to flow in a sentence). Screen readers hear each whole string once it is typed, never characters. Starts on sight, pauses off screen; under reduced motion whole strings swap.",
    components: { LpTypewriter, LpSwitch, LpInput },
    state: () => reactive({ loop: true, log: "", items: ["servers", "logs", "people", "invoices"] }),
    template: `<div class="flex w-[28rem] flex-col gap-4">
  <p class="m-0 text-2xl font-semibold text-ink">
    Search <LpTypewriter :text="items" :loop="loop" class="text-brand" @typed="(i, s) => (log = s)" />
  </p>
  <p class="m-0 font-mono text-sm text-muted">
    <span class="text-action">$</span> <LpTypewriter text="docker compose up -d --wait" :start-delay="600" />
  </p>
  <label class="flex items-center gap-2 text-sm"><LpSwitch v-model="loop" /> Loop</label>
  <p class="m-0 text-xs text-muted">Last typed: {{ log || '…' }}</p>
</div>`,
    thumb: `<div class="flex w-64 flex-col gap-3">
  <p class="m-0 text-xl font-semibold text-ink">Search <LpTypewriter :text="['servers', 'logs', 'people']" loop :hold="1200" class="text-brand" /></p>
  <p class="m-0 font-mono text-xs text-muted"><span class="text-action">$</span> <LpTypewriter text="make deploy" loop :hold="1600" /></p>
</div>`,
  },
  {
    id: "scramble",
    name: "Scramble",
    description:
      "A value that decrypts into place: each character churns through random glyphs and settles, left to right (`sequential`) or in one burst (`together`). For values that were just produced: a new API key, a hash a job returned, an invite code. Plays on sight, at mount, on hover or only when `value` changes. Each position is sized by the character it will land on, so the width holds still even in a proportional font, and a length change eases. Screen readers get the value once. The clock is `useScramble`, for a component that wants the effect on its own markup.",
    components: { LpScramble, LpButton, LpSegmented, LpCard },
    state: () => reactive({ keys: KEYS, i: 0, order: "sequential", orders: options(["sequential", "together"]) }),
    template: `<div class="flex w-[28rem] flex-col gap-4">
  <LpSegmented v-model="order" :options="orders" size="sm" />
  <LpCard class="flex items-center justify-between gap-3">
    <LpScramble :value="keys[i]" :order="order" class="font-mono text-sm text-ink" />
    <LpButton size="sm" variant="outline" @click="i = (i + 1) % keys.length">Regenerate</LpButton>
  </LpCard>
  <p class="m-0 text-lg font-semibold text-ink">
    <LpScramble value="ACCESS GRANTED" trigger="hover" order="together" class="font-mono" />
    <span class="ml-2 text-xs font-normal text-muted">← hover</span>
  </p>
  <p class="m-0 text-sm text-muted">Proportional text holds its width too: <LpScramble value="Release notes" trigger="hover" class="text-ink" /></p>
</div>`,
    thumb: `<div class="flex w-64 flex-col gap-2">
  <LpCard><LpScramble :value="tKey" class="font-mono text-sm text-ink" /></LpCard>
  <LpScramble :value="tWord" order="together" class="font-mono text-lg font-semibold text-brand" />
</div>`,
    thumbLoop: {
      every: 2200,
      frames: [
        { tKey: KEYS[0], tWord: "ACCESS GRANTED" },
        { tKey: KEYS[1], tWord: "KEY ROTATED" },
        { tKey: KEYS[2], tWord: "ACCESS GRANTED" },
      ],
    },
  },
]
