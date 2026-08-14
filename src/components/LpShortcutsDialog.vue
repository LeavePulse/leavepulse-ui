<script setup lang="ts">
/*
 * A keyboard reference, conventionally opened with F1.
 *
 * Shortcuts are passed in as data rather than read off a live binding list: a
 * binding knows its key but not what to call it, and in most apps half of them
 * are only mounted in the section they belong to — a reference that lists what
 * happens to be active is not a reference.
 *
 * Combos are written the way they read ("Ctrl+Shift+M", "←→↑↓") and split on
 * "+" into one <kbd> each.
 */
import LpModal from "./LpModal.vue"
import { appleModifierLabel } from "../composables/useHotkeys"

export interface ShortcutEntry {
  /** Rendered one <kbd> per "+"-separated key, so write it the way it reads. */
  combo: string
  label: string
}

export interface ShortcutGroup {
  title: string
  entries: ShortcutEntry[]
}

const props = withDefaults(
  defineProps<{
    open?: boolean
    groups: ShortcutGroup[]
    title?: string
    description?: string
  }>(),
  { open: false, title: "Keyboard shortcuts" },
)

const emit = defineEmits<{ (e: "update:open", value: boolean): void }>()
</script>

<template>
  <LpModal
    :open="props.open"
    size="lg"
    :title="props.title"
    :description="props.description"
    @update:open="(value: boolean) => emit('update:open', value)"
  >
    <div class="shortcut-groups">
      <section v-for="group in props.groups" :key="group.title" class="shortcut-group">
        <h3>{{ group.title }}</h3>
        <dl>
          <div v-for="entry in group.entries" :key="entry.combo" class="shortcut-row">
            <dt>{{ entry.label }}</dt>
            <dd>
              <kbd v-for="(key, index) in entry.combo.split('+')" :key="`${key}-${index}`">
                {{ appleModifierLabel(key.trim()) }}
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
