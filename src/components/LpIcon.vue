<script setup lang="ts">
/*
 * Icon — wrapper over @iconify/vue. Names follow iconify convention
 * (e.g. "lucide:check"), matching the frontend's icon usage. lucide is bundled
 * offline (see icons.ts) so it works without network — important for Tauri.
 *
 * SSR-safe: when the icon is already registered (it is, offline), we render the
 * inline <svg> synchronously from getIcon() so the server and client produce
 * identical markup. The <Icon> component only resolves icons after mount, which
 * left empty SSR placeholders and caused hydration mismatches. We fall back to
 * <Icon> only for icons that aren't registered yet (e.g. fetched on demand).
 */
import { computed } from "vue"
import { Icon, getIcon } from "@iconify/vue"
import "../icons" // registers the lucide collection offline

const props = defineProps<{
  /** iconify name, e.g. "lucide:check". Bare names assume the lucide set. */
  name: string
  size?: number | string
}>()

function resolve(name: string): string {
  return name.includes(":") ? name : `lucide:${name}`
}

const fullName = computed(() => resolve(props.name))
const data = computed(() => getIcon(fullName.value))
const dim = computed(() => props.size ?? "1em")
</script>

<template>
  <svg
    v-if="data"
    xmlns="http://www.w3.org/2000/svg"
    :width="dim"
    :height="dim"
    :viewBox="`0 0 ${data.width} ${data.height}`"
    aria-hidden="true"
    v-html="data.body"
  />
  <Icon
    v-else
    :icon="fullName"
    :width="dim"
    :height="dim"
    aria-hidden="true"
  />
</template>
