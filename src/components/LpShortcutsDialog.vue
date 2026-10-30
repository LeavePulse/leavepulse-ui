<script setup lang="ts">
/*
 * A keyboard reference, conventionally opened with F1.
 *
 * Two sources, used together or apart. `groups` is the written list: keys
 * that are not bindings at all (arrows inside a list, Backspace in a palette)
 * and the ones worth knowing before their screen is open. `live` adds every
 * mounted `useHotkeys` binding that carries `help`, so a screen with its own
 * keys documents them while it is open and drops them when it closes. Groups
 * of the same title merge, and a combo is listed once.
 *
 * Combos are written the way they read ("Ctrl+Shift+M", "Ctrl++", "←→↑↓") and
 * split on "+" into one <kbd> each; spaces separate the steps of a sequence
 * ("G I" reads "G then I"). In `live` mode an entry whose keys another mounted
 * binding also answers carries a marker, so a clash shows up where people
 * look for keys rather than only in the console.
 */
import { computed } from "vue"
import LpKeys from "./LpKeys.vue"
import LpModal from "./LpModal.vue"
import type { OverlayHistoryMode } from "../composables/useOverlayHistory"
import {
  activeShortcuts,
  mergeShortcutGroups,
  useHotkeys,
  type ShortcutGroup,
} from "../composables/useHotkeys"
import { useLabels } from "../composables/useLpConfig"

const props = withDefaults(
  defineProps<{
    open?: boolean
    groups?: ShortcutGroup[]
    /** Also list the bindings mounted right now (`useHotkeys` with `help`). */
    live?: boolean
    title?: string
    description?: string
    /** Frosted glass panel, passed to LpModal. Follows `provideGlass` when unset. */
    glass?: boolean
    /** Browser history for the dialog, passed to LpModal. Follows `provideOverlayHistory` when unset. */
    history?: OverlayHistoryMode
    /**
     * A key that toggles the reference, e.g. "F1". Bound only while the dialog
     * is mounted, also inside inputs and over other overlays, and the browser's
     * own use of the key (Chrome opens its help page on F1) is suppressed.
     */
    hotkey?: string
  }>(),
  { open: false, groups: () => [], live: false, title: undefined, glass: undefined, history: undefined },
)

const text = useLabels("shortcuts", {
  title: "Keyboard shortcuts",
  conflict: "Also bound elsewhere: only one of them runs",
  group: "General",
})

const shown = computed(() => (props.live ? mergeShortcutGroups(props.groups, activeShortcuts.value) : props.groups))

const emit = defineEmits<{ (e: "update:open", value: boolean): void }>()

useHotkeys(() =>
  props.hotkey
    ? [
        {
          key: props.hotkey,
          allowInInput: true,
          overLayers: true,
          repeat: false,
          help: { group: text.value.group, label: props.title ?? text.value.title },
          handler: () => emit("update:open", !props.open),
        },
      ]
    : [],
)
</script>

<template>
  <LpModal
    :glass="props.glass"
    :history="props.history"
    :open="props.open"
    size="lg"
    :title="props.title ?? text.title"
    :description="props.description"
    @update:open="(value: boolean) => emit('update:open', value)"
  >
    <div class="shortcut-groups">
      <section v-for="group in shown" :key="group.title" class="shortcut-group">
        <h3>{{ group.title }}</h3>
        <dl>
          <div v-for="entry in group.entries" :key="entry.combo" class="shortcut-row">
            <dt>
              {{ entry.label }}
              <span
                v-if="entry.conflict"
                class="shortcut-conflict"
                role="img"
                :aria-label="text.conflict"
                :title="text.conflict"
              >!</span>
            </dt>
            <dd>
              <LpKeys :combo="entry.combo" />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </LpModal>
</template>

<style scoped>
/* Two columns where there is room: the list is long enough that one column
   pushes the last group off a laptop screen. */
.shortcut-groups {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.shortcut-group h3 {
  margin: 0 0 6px;
  color: var(--color-muted);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.shortcut-group dl {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 0;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
}

.shortcut-row dt {
  color: var(--color-ink);
  font-size: 0.82rem;
  min-width: 0;
}

.shortcut-conflict {
  display: inline-flex;
  width: 14px;
  height: 14px;
  margin-left: 6px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.6rem;
  font-weight: 700;
  vertical-align: middle;
  cursor: help;
}

.shortcut-row dd {
  display: flex;
  flex-shrink: 0;
  gap: 3px;
  margin: 0;
}
</style>
