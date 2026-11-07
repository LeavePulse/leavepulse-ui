<script setup lang="ts">
import { ref } from "vue"
import {
  LayoutCanvas,
  LpAppShell,
  LpBottomNav,
  LpDock,
  LpFrame,
  LpModal,
  LpScrollArea,
  LpSidebar,
  makeLayout,
  moveLeaf,
  type SidebarItem,
  type SidebarSection,
} from "../../src"

const mode = new URLSearchParams(location.search).get("mode") ?? "frame"

const rows: SidebarItem[] = [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }, { id: "c", label: "Gamma" }]
const shellRows: SidebarItem[] = [{ id: "/a", label: "Alpha" }, { id: "/b", label: "Beta" }]
const sections = ref<SidebarSection[]>([
  { key: "general", title: "General", collapsible: true, items: [{ id: "g", label: "Overview" }] },
  { key: "billing", title: "Billing", collapsible: true, items: [{ id: "i", label: "Invoices" }] },
])
const dock = [{ id: "one", label: "One", icon: "lucide:house" }, { id: "two", label: "Two", icon: "lucide:box" }]
const layout = makeLayout(["left", "right", "tabbed"])
moveLeaf(layout, layout.children[2]!.id, layout.children[1]!.id, "center")

const inner = ref(false)
const outer = ref(false)
const bleed = ref(false)
const compact = ref(false)
const orientation = ref<"horizontal" | "vertical">("horizontal")
const focusAt = ref<number | null>(null)

function openBoth() {
  outer.value = true
  inner.value = true
}

function dropFirstSection() {
  sections.value = sections.value.slice(1)
}

function addSheet() {
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.id = "mirrored"
  link.href = "data:text/css,%2F*first*%2F"
  document.head.appendChild(link)
}

function changeSheet() {
  const link = document.getElementById("mirrored") as HTMLLinkElement
  link.href = "data:text/css,%2F*second*%2F"
  link.media = "print"
  link.disabled = true
}

function storeWidth() {
  localStorage.setItem("lp-sidebar:wide:width", "400")
}
storeWidth()

Object.assign(window, { shell: { openBoth, dropFirstSection, addSheet, changeSheet, focusAt, orientation, bleed, inner, outer } })
</script>

<template>
  <LpAppShell v-if="mode === 'shell'" :items="shellRows" path="/a//" :full-bleed="bleed" bottom-nav>
    <p v-for="n in 60" :key="n" class="py-4">Line {{ n }}</p>
  </LpAppShell>

  <main v-else-if="mode === 'plain'" class="flex flex-col gap-4 p-4">
    <LpSidebar :items="rows" :max-width="320" resizable persist="wide" class="h-40" />
    <LpSidebar v-model:compact="compact" :items="rows" resizable persist="bound" class="h-40" />
    <LpSidebar :sections="sections" class="h-40" />
    <LpDock :items="dock" :orientation="orientation" :focus-at="focusAt" />
    <LpBottomNav :items="rows" more more-active more-expanded more-controls="the-drawer" />
  </main>

  <template v-else>
    <button data-page-button>Page button</button>
    <LpModal v-model:open="outer" title="Page modal"><p>Page body</p></LpModal>
    <LpFrame :height="640" title="Shell frame">
      <div class="flex flex-col gap-4 p-4">
        <LpSidebar :items="rows" class="h-36" />
        <LpDock :items="dock" :size="40" :magnify="80" />
        <LpScrollArea class="h-24" data-test-scroll>
          <p v-for="n in 40" :key="n">Row {{ n }}</p>
        </LpScrollArea>
        <div class="flex h-32 w-96">
          <LayoutCanvas :model-value="layout" edit>
            <template #block="{ block }"><p>{{ block }}</p></template>
          </LayoutCanvas>
        </div>
        <LpModal v-model:open="inner" title="Frame modal"><p>Frame body</p></LpModal>
      </div>
    </LpFrame>
  </template>
</template>
