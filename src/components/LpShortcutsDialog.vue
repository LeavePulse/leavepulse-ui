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
 * split on "+" into one <kbd> each.
 */
import { computed } from "vue"
import LpModal from "./LpModal.vue"
import {
  activeShortcuts,
  appleModifierLabel,
  mergeShortcutGroups,
  useAppleKeyboard,
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
  }>(),
  { open: false, groups: () => [], live: false, title: undefined, glass: undefined },
)

const text = useLabels("shortcuts", { title: "Keyboard shortcuts" })
const apple = useAppleKeyboard()

/*
 * One key per "+", except a "+" that is the key itself: "Ctrl++" is Ctrl and
 * plus, not Ctrl and two blanks.
 */
function keysOf(combo: string): string[] {
  return combo.split(/\+(?!$)/)
}

const shown = computed(() => (props.live ? mergeShortcutGroups(props.groups, activeShortcuts.value) : props.groups))

const emit = defineEmits<{ (e: "update:open", value: boolean): void }>()
</script>

<template>
  <LpModal
    :glass="props.glass"
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
            <dt>{{ entry.label }}</dt>
            <dd>
              <kbd v-for="(key, index) in keysOf(entry.combo)" :key="`${key}-${index}`">
                {{ appleModifierLabel(key.trim(), apple) }}
              </kbd>
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

.shortcut-row dd {
  display: flex;
  flex-shrink: 0;
  gap: 3px;
  margin: 0;
}

kbd {
  display: inline-flex;
  min-width: 20px;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: 1px solid var(--color-line-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--color-ink) 6%, transparent);
  color: var(--color-muted-strong);
  font-family: inherit;
  font-size: 0.7rem;
  line-height: 1.5;
}
</style>
