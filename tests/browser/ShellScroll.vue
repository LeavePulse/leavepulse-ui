<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"
import { LpAppShell, type SidebarSection } from "../../src"

const LATE_MS = 300

const sections: SidebarSection[] = [{ items: [{ id: "a", label: "Page A" }, { id: "b", label: "Page B" }] }]

function read() {
  const params = new URLSearchParams(location.search)
  return { page: params.get("page") ?? "a", hash: location.hash }
}

const path = ref(read().page)
const hash = ref(read().hash)
const late = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function show(page: string, next: string) {
  path.value = page
  hash.value = next
  late.value = false
  clearTimeout(timer)
  timer = setTimeout(() => (late.value = true), LATE_MS)
}

function go(page: string, next = "") {
  history.pushState({}, "", `?scenario=shell-scroll&page=${page}${next}`)
  show(page, next)
}

const onPop = () => show(read().page, read().hash)
onMounted(() => {
  window.addEventListener("popstate", onPop)
  show(path.value, hash.value)
})
onBeforeUnmount(() => window.removeEventListener("popstate", onPop))

Object.assign(window, { shellGo: go })
</script>

<template>
  <LpAppShell :sections="sections" :path="path" :hash="hash" @select="(item) => go(item.id)">
    <div v-if="path === 'a'" data-page="a">
      <p v-for="n in 60" :key="n" class="py-4">Paragraph A{{ n }}</p>
      <h2 id="a-deep" class="scroll-mt-6">Deep in A</h2>
      <p v-for="n in 40" :key="`t${n}`" class="py-4">Tail A{{ n }}</p>
    </div>
    <div v-else data-page="b">
      <p v-for="n in 60" :key="n" class="py-4">Paragraph B{{ n }}</p>
      <template v-if="late">
        <h2 id="b-late" class="scroll-mt-6">Late in B</h2>
        <p v-for="n in 40" :key="`t${n}`" class="py-4">Tail B{{ n }}</p>
      </template>
    </div>
  </LpAppShell>
</template>
