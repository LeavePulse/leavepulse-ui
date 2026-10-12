import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, watch, type PropType } from "vue"
import {
  LpButton,
  LpModal,
  provideLpConfig,
  useField,
  useHotkeys,
  useModalLayer,
  type LabelScope,
} from "../../src"
import { href, navigate, parse } from "./router"

/*
 * Helpers for live examples that need setup code a template string cannot hold:
 * a config scope, a custom control, a custom overlay, a screen with hotkeys.
 */

/** The preview's client-side link: navigates through the preview router instead of reloading. */
export const PreviewLink = defineComponent({
  name: "PreviewLink",
  props: { to: { type: String, required: true } },
  setup(props, { slots, attrs }) {
    return () =>
      h(
        "a",
        {
          ...attrs,
          href: href(parse(props.to)),
          onClick: (event: MouseEvent) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
            event.preventDefault()
            navigate(parse(props.to))
          },
        },
        slots.default?.(),
      )
  },
})

/** Provides kit labels to its subtree, the way an app does once at its root. */
export const ConfigScope = defineComponent({
  name: "ConfigScope",
  props: {
    labels: { type: Object as PropType<Partial<Record<string, Partial<LabelScope>>>>, default: undefined },
  },
  setup(props, { slots }) {
    provideLpConfig(() => ({ labels: props.labels }))
    return () => h("div", { class: "contents" }, slots.default?.())
  },
})

/**
 * A control the kit does not ship, placed inside LpFormField: it reads the
 * field context for its label, description and states like a kit control does.
 */
export const RatingControl = defineComponent({
  name: "RatingControl",
  props: { modelValue: { type: Number, default: 0 } },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const field = useField()
    return () => {
      const f = field?.value
      return h(
        "div",
        {
          role: "radiogroup",
          "aria-labelledby": f?.labelId,
          "aria-describedby": f?.describedBy,
          "aria-invalid": f?.invalid || undefined,
          "aria-required": f?.required || undefined,
          class: "flex gap-1",
        },
        [1, 2, 3, 4, 5].map((n) =>
          h(
            "button",
            {
              type: "button",
              role: "radio",
              "aria-checked": props.modelValue === n,
              "aria-label": `${n} of 5`,
              disabled: f?.disabled,
              class: [
                "grid size-8 place-items-center rounded-md border text-sm transition-colors",
                n <= props.modelValue ? "border-action bg-action-soft text-ink" : "border-line text-muted",
                f?.invalid ? "border-danger" : "",
                "disabled:opacity-50",
              ],
              onClick: () => emit("update:modelValue", n),
            },
            String(n),
          ),
        ),
      )
    }
  },
})

/**
 * An overlay that is not a kit component but joins the kit's modal stack: a
 * kit modal opened from it lands above it, scrim included, and Escape closes
 * only the topmost surface.
 */
export const CustomSheet = defineComponent({
  name: "CustomSheet",
  props: { open: { type: Boolean, default: false } },
  emits: ["update:open"],
  setup(props, { emit, slots }) {
    const panel = ref<HTMLElement | null>(null)
    const layer = useModalLayer({ element: () => panel.value })
    watch(
      () => props.open,
      (open) => (open ? layer.claim() : layer.release()),
      { immediate: true },
    )
    onBeforeUnmount(layer.release)
    const close = () => emit("update:open", false)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && props.open && layer.top.value) close()
    }
    window.addEventListener("keydown", onKey)
    onBeforeUnmount(() => window.removeEventListener("keydown", onKey))
    return () =>
      props.open
        ? h("div", [
            h("div", {
              class: "fixed inset-0 bg-black/40",
              style: { zIndex: layer.layer.value.scrim },
              onClick: close,
            }),
            h(
              "section",
              {
                ref: panel,
                role: "dialog",
                "aria-modal": "true",
                "aria-label": "Custom sheet",
                class:
                  "fixed inset-x-0 bottom-0 mx-auto flex max-w-lg flex-col gap-3 rounded-t-2xl border border-line bg-surface-raised p-5 shadow-xl",
                style: { zIndex: layer.layer.value.panel },
              },
              slots.default?.(),
            ),
          ])
        : null
  },
})

/** A screen with two page-level keys: one yields to an open modal, one does not. */
export const LayerKeys = defineComponent({
  name: "LayerKeys",
  setup() {
    const counts = reactive({ j: 0, k: 0 })
    const open = ref(false)
    useHotkeys([
      { key: "j", code: "KeyJ", help: { group: "Demo", label: "Count J" }, handler: () => void counts.j++ },
      {
        key: "k",
        code: "KeyK",
        overLayers: true,
        help: { group: "Demo", label: "Count K (over layers)" },
        handler: () => void counts.k++,
      },
    ])
    const summary = computed(() => `J pressed ${counts.j} times · K pressed ${counts.k} times`)
    return () =>
      h("div", { class: "flex flex-col items-start gap-3 text-sm" }, [
        h("p", { class: "text-muted" }, "Press J and K, then open the dialog and press them again."),
        h("p", { class: "font-mono text-ink" }, summary.value),
        h(LpButton, { variant: "outline", onClick: () => (open.value = true) }, () => "Open a dialog"),
        h(
          LpModal,
          { open: open.value, "onUpdate:open": (v: boolean) => (open.value = v), title: "Page keys are paused" },
          () =>
            h("div", { class: "flex flex-col gap-2 text-sm" }, [
              h("p", { class: "text-muted" }, "J is declared outside this dialog, so it stays quiet here."),
              h("p", { class: "text-muted" }, "K sets overLayers, so it still counts."),
              h("p", { class: "font-mono text-ink" }, summary.value),
            ]),
        ),
      ])
  },
})
