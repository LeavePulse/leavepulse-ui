<script setup lang="ts">
/*
 * The menu for useWorkspaces: which layout is showing, the others, and making,
 * copying, renaming and deleting them.
 *
 *   const spaces = useWorkspaces({ initial: ["logs", "chart"], persist: "main" })
 *   <LpWorkspaceSwitcher :workspaces="spaces" />
 *   <LayoutCanvas v-model="spaces.controller.layout.value" :blocks="blocks" />
 *
 * Only the menu: an app with its own place for this (the palette, a settings
 * page) calls useWorkspaces directly and leaves this out.
 */
import { computed, nextTick, ref } from "vue"
import { useLabels } from "../composables/useLpConfig"
import type { UseWorkspaces } from "../layout/useWorkspaces"
import LpButton from "./LpButton.vue"
import LpDropdownMenu, { type MenuItem } from "./LpDropdownMenu.vue"
import LpInput from "./LpInput.vue"
import LpModal from "./LpModal.vue"

const props = defineProps<{
  workspaces: UseWorkspaces
  labels?: Partial<{
    menu: string
    create: string
    duplicate: string
    rename: string
    remove: string
    name: string
    save: string
    cancel: string
    required: string
  }>
}>()

const text = useLabels(
  "workspaces",
  {
    menu: "Workspaces",
    create: "New workspace",
    duplicate: "Duplicate",
    rename: "Rename",
    remove: "Delete",
    name: "Name",
    save: "Save",
    cancel: "Cancel",
    required: "Enter a name",
  },
  () => props.labels,
)

const activeName = computed(() => {
  const { workspaces, activeId } = props.workspaces
  return workspaces.value.find((space) => space.id === activeId.value)?.name ?? ""
})

const naming = ref<"create" | "rename" | null>(null)
const draft = ref("")
const tried = ref(false)
const nameError = computed(() => (tried.value && !draft.value.trim() ? text.value.required : undefined))

async function ask(mode: "create" | "rename") {
  // After the menu has let go of focus, so the dialog's own focus is the one that stays.
  await nextTick()
  draft.value = mode === "rename" ? activeName.value : ""
  tried.value = false
  naming.value = mode
}

function confirm() {
  tried.value = true
  const name = draft.value.trim()
  if (!name) return
  if (naming.value === "create") props.workspaces.create(name)
  else props.workspaces.rename(props.workspaces.activeId.value, name)
  naming.value = null
}

const items = computed<MenuItem[]>(() => {
  const spaces = props.workspaces
  return [
    ...spaces.workspaces.value.map((space) => ({
      label: space.name,
      icon: space.id === spaces.activeId.value ? "lucide:check" : undefined,
      onSelect: () => spaces.switchTo(space.id),
    })),
    { label: text.value.create, icon: "lucide:plus", separatorBefore: true, onSelect: () => void ask("create") },
    { label: text.value.duplicate, icon: "lucide:copy", onSelect: () => void spaces.duplicate() },
    { label: text.value.rename, icon: "lucide:pencil", onSelect: () => void ask("rename") },
    {
      label: text.value.remove,
      icon: "lucide:trash-2",
      danger: true,
      disabled: spaces.workspaces.value.length <= 1,
      onSelect: () => spaces.remove(spaces.activeId.value),
    },
  ]
})
</script>

<template>
  <LpDropdownMenu :items="items" :palette="false">
    <template #trigger>
      <LpButton variant="ghost" size="sm" :aria-label="`${text.menu}: ${activeName}`">{{ activeName }}</LpButton>
    </template>
  </LpDropdownMenu>
  <LpModal :open="naming !== null" :title="naming === 'create' ? text.create : text.rename" size="sm" @update:open="naming = null">
    <form id="lp-workspace-name" @submit.prevent="confirm">
      <LpInput v-model="draft" :label="text.name" :error="nameError" />
    </form>
    <template #footer>
      <LpButton variant="ghost" @click="naming = null">{{ text.cancel }}</LpButton>
      <LpButton type="submit" form="lp-workspace-name">{{ text.save }}</LpButton>
    </template>
  </LpModal>
</template>
