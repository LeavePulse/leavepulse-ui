<script setup lang="ts">
import { ref } from "vue"
import { LpAppShell, LpModal, type NavMode, type SidebarItem } from "../../src"

const params = new URLSearchParams(location.search)
const path = ref("/a")
const modes = ref<NavMode[]>([])
const dialog = ref(false)
const items: SidebarItem[] = [
  { id: "/a", label: "Alpha", children: [{ id: "/a/one", label: "One" }, { id: "/a/two", label: "Two" }] },
  { id: "/b", label: "Beta" },
]
Object.assign(window, { shellFeatures: { path } })
</script>

<template>
  <LpAppShell
    :items="items"
    :path="path"
    :header-collapse="params.has('collapse')"
    :back-to-top="params.has('top') ? 200 : false"
    :density="params.has('density') ? 'compact' : undefined"
    :page-transition="params.has('fade')"
    :safe-area="params.has('safe')"
    :bottom-nav="params.has('bottom')"
    :adaptive-nav="params.has('adaptive') ? { compactBelow: 'xl', contextNav: true } : undefined"
    :scroll="params.has('region') ? 'region' : undefined"
    @nav-mode="(mode) => modes.push(mode)"
    @select="(item) => (path = item.id)"
  >
    <template #header-actions><button>Save</button><button @click="dialog = true">Open dialog</button></template>
    <div data-test-page style="height: 3000px">
      Page {{ path }}
      <output aria-label="Modes">{{ modes.join(",") }}</output>
    </div>
    <LpModal v-model:open="dialog" title="Dialog"><p>Dialog body</p></LpModal>
    <template v-if="params.has('aside')" #aside>
      <div data-test-aside style="height: 2000px">Side panel</div>
    </template>
  </LpAppShell>
</template>
