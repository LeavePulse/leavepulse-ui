<script setup lang="ts">
import { computed, defineComponent, h, ref } from "vue"
import { createRouter, createWebHistory, RouterLink, RouterView, useRoute, useRouter } from "vue-router"
import { getCurrentInstance } from "vue"
import { LpButton, LpConfirmHost, LpDrawer, LpModal, LpTabs, provideOverlayHistory } from "../../src"

const stats = { navigations: 0, homeSetups: 0 }

const tabs = [
  { value: "one", label: "One" },
  { value: "two", label: "Two" },
  { value: "three", label: "Three" },
]

const outer = ref(false)
const inner = ref(false)
const reopenable = ref(false)
const routed = ref(false)
const drawer = ref(false)
const guarded = ref(false)
const tab = ref("one")
const pageTab = ref("one")

const Home = defineComponent({
  setup() {
    stats.homeSetups++
    const route = useRoute()
    const nav = useRouter()
    const item = computed({
      get: () => (typeof route.query.item === "string" ? route.query.item : ""),
      set: (value: string) => {
        const { item: _, ...rest } = route.query
        void nav.replace({ query: value ? { ...rest, item: value } : rest })
      },
    })
    return () =>
      h("div", { class: "p-4 flex flex-col gap-2" }, [
        h("p", "Home page"),
        h(LpTabs, { items: tabs, modelValue: pageTab.value, "onUpdate:modelValue": (v: string) => (pageTab.value = v), label: "Page tabs" }),
        h(LpButton, { onClick: () => (outer.value = true) }, () => "Open outer"),
        h(LpButton, { onClick: () => (reopenable.value = true) }, () => "Open reopenable"),
        h(LpButton, { onClick: () => (routed.value = true) }, () => "Open routed"),
        h(LpButton, { onClick: () => (drawer.value = true) }, () => "Open drawer"),
        h(LpButton, { onClick: () => (guarded.value = true) }, () => "Open guarded"),
        h(LpButton, { onClick: () => (item.value = "7") }, () => "Open in query"),
        h(
          LpModal,
          { open: Boolean(item.value), "onUpdate:open": (v: boolean) => !v && (item.value = ""), title: `Item ${item.value}` },
          () => h("p", "Lives in the route query"),
        ),
        h(
          LpModal,
          { open: guarded.value, "onUpdate:open": (v: boolean) => (guarded.value = v), title: "Guarded", guard: true },
          () => h("p", "Unsaved work"),
        ),
        h(
          LpModal,
          { open: outer.value, "onUpdate:open": (v: boolean) => (outer.value = v), title: "Outer" },
          () => [
            h(LpTabs, { items: tabs, modelValue: tab.value, "onUpdate:modelValue": (v: string) => (tab.value = v), label: "Modal tabs" }),
            h("p", `Tab is ${tab.value}`),
            h(LpButton, { onClick: () => (inner.value = true) }, () => "Open inner"),
            h(LpButton, { onClick: () => (outer.value = false) }, () => "Close outer"),
            h(RouterLink, { to: "/other" }, () => "Go to other page"),
            h(
              LpModal,
              { open: inner.value, "onUpdate:open": (v: boolean) => (inner.value = v), title: "Inner" },
              () => h("p", "Inner body"),
            ),
          ],
        ),
        h(
          LpModal,
          { open: reopenable.value, "onUpdate:open": (v: boolean) => (reopenable.value = v), title: "Reopenable", history: "reopen" },
          () => h("p", "Comes back on Forward"),
        ),
        h(
          LpModal,
          { open: routed.value, "onUpdate:open": (v: boolean) => (routed.value = v), title: "Routed", history: false },
          () => h("p", "Kept out of history"),
        ),
        h(
          LpDrawer,
          { open: drawer.value, "onUpdate:open": (v: boolean) => (drawer.value = v), title: "Drawer" },
          () => h("p", "Drawer body"),
        ),
      ])
  },
})

const Other = defineComponent({ setup: () => () => h("p", { class: "p-4" }, "Other page") })

const router = createRouter({
  history: createWebHistory("/tests/browser/"),
  routes: [
    { path: "/", component: Home },
    { path: "/other", component: Other },
  ],
})
router.afterEach(() => stats.navigations++)
getCurrentInstance()!.appContext.app.use(router)
provideOverlayHistory(true, { router })

Object.assign(window, {
  overlayStats: stats,
  overlayRouter: router,
  setOuter: (v: boolean) => (outer.value = v),
})
</script>

<template>
  <RouterView />
  <LpConfirmHost />
</template>
