<script setup lang="ts">
/*
 * Tooltip for controls whose meaning is not written on them — an icon button,
 * a truncated value, a disabled action that owes an explanation.
 *
 * Why not the native `title` attribute: it is drawn by the operating system, so
 * it looks different on every platform and cannot be themed; it waits about a
 * second before appearing; it cannot wrap or hold markup; and screen-reader
 * support for it is inconsistent — it is often ignored outright.
 *
 * Accessibility contract, which is the part that is easy to get wrong:
 *
 *   `label` — the tip IS the control's name (an icon button). The text is put
 *     on the TRIGGER as aria-label, so a screen reader announces "Delete,
 *     button" rather than "button". reka only ever wires aria-describedby,
 *     which describes a control that already has a name — it cannot name a
 *     nameless one, so naming has to happen here.
 *
 *   default — the tip merely ADDS to a control that already has a name. reka's
 *     own aria-describedby carries it, and the name is announced first.
 *
 * Either way the trigger keeps a real accessible name, which is what `title`
 * alone could not guarantee. reka opens the tip on keyboard focus as well as
 * hover and closes it on Escape, satisfying WCAG 1.4.13.
 *
 * Until it is first wanted only the trigger is rendered: the reka tooltip (its
 * provider, root, popper and portal) is stood up on the first pointer over the
 * trigger, the first focus on it or a touch hold, and stays from then on. A
 * table row carries two or three tips, nearly all of them never hovered, and
 * fifty rows of full tooltips were most of the cost of showing the rows. The
 * trigger's element is the same one before and after, so a ref to it, its
 * focus and its hover survive the switch; the label is on it from the start,
 * and the description arrives with the tip, as it always did.
 *
 * Do NOT wrap the `#trigger` of LpDropdownMenu, LpPopover or LpContextMenu:
 * those bind their handlers to the slot's direct child, so a wrapper swallows
 * them and the control stops opening. Put `aria-label` on the trigger instead.
 */
import { clamp } from "../composables/clamp"
import {
  injectTooltipProviderContext,
  injectTooltipRootContext,
  Slot,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui"
import {
  computed,
  defineComponent,
  mergeProps,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  shallowRef,
  useAttrs,
  watch,
  type ComponentPublicInstance,
  type FunctionalComponent,
} from "vue"
import {
  springSettled,
  springStep,
  type SpringState,
} from "../composables/usePillTransition"
import { PANEL_SURFACE, TOOLTIP_ANIM } from "./dropdown"
import { useTouchHold } from "../composables/useTouchHold"
import { prefersReducedMotion } from "../composables/easing"
import { useOutsideGuard, usePortalTarget, useView, viewWindow } from "../composables/useView"

const props = withDefaults(
  defineProps<{
    content?: string
    sideOffset?: number
    /** Which edge to prefer; flips automatically when there is no room. */
    side?: "top" | "right" | "bottom" | "left"
    /**
     * The tip names the control rather than describing it — for a trigger with
     * no visible text of its own. Sets the accessible name instead of only
     * adding a description.
     */
    label?: boolean
    /** Milliseconds before the tip appears on hover. Unset follows the provider, else 200. */
    delay?: number
    /**
     * Show on any focus, not just keyboard focus. Off by default: a tip that
     * pops up after every mouse click on the trigger is noise.
     */
    showOnPointerFocus?: boolean
    /**
     * Track the pointer instead of anchoring to the trigger's edge.
     *
     * For a trigger that is large or oddly shaped — a chart slice, a canvas, a
     * map region — where the element's bounding box says little about what the
     * pointer is actually over: anchored to the box, the tip can appear far from
     * the thing it describes. Following the cursor keeps it next to the reading.
     */
    followCursor?: boolean
    /**
     * Suppress the tip. For a trigger whose tip only applies to part of it — a
     * chart wrapper where the pointer may be over a mark or over empty canvas —
     * so an empty panel never opens over the gaps.
     *
     * This also FORCES CLOSED a tip that is already showing. reka's own
     * `disabled` does not: it stops managing the tooltip where it stands, so one
     * that was open when the flag flipped stayed on screen for good — outliving
     * the pointer, letting a second chart open its own beside it, and surviving
     * a scroll that should have dismissed it.
     */
    disabled?: boolean
    /**
     * Touch has no hover, and a tap is the control's own. With `hold` a
     * press-and-hold shows the tip (and that press does not also press the
     * control); the next touch anywhere, or Escape, hides it. `none` leaves
     * touch to the trigger. A followed tip (`followCursor`) never holds: its
     * trigger is a chart or canvas with its own touch reading.
     */
    touch?: "hold" | "none"
  }>(),
  { side: "top", touch: "hold" },
)

/*
 * Follow mode. reka positions the tip against the trigger's BOX and exposes no
 * virtual anchor for tooltips (PopperAnchor isn't part of its public surface),
 * so the tip is placed as usual and then offset to the cursor.
 *
 * Both axes are followed. Following x alone left the tip pinned to the vertical
 * middle of the trigger, which for a tall target — a pie 180px across, a canvas,
 * a map — parks it a long way from the pointer. The offset is measured from the
 * box's centre on each axis, and reka's own side placement still decides which
 * way the tip sits relative to that point.
 *
 * The tip TRAILS the cursor on a spring rather than being pinned to it: chasing
 * the pointer exactly reads as jitter, while a slight lag reads as following.
 * Same reasoning, and the same shared "float" feel, as LpChart's readout.
 */
/*
 * A provider of its own only when none is above. Each tip in its own provider
 * meant moving along a toolbar waited the full delay at every button; under a
 * shared one (LpTooltipProvider at the root) the next tip opens at once.
 */
const shared = injectTooltipProviderContext(null)
/*
 * Under a shared provider the tip renders straight into it. `Fragment` cannot
 * stand in for the wrapper: given through `<component :is>` it takes slots,
 * not children, and rendered nothing at all, so every tip inside an
 * LpTooltipProvider vanished together with its trigger.
 */
const PassThrough: FunctionalComponent = (_, { slots }) => slots.default?.()

const target = { x: 0, y: 0 }
const offset = ref({ x: 0, y: 0 })
const tipBody = ref<HTMLElement | null>(null)

/* How long a finger rests on the trigger before the tip shows. */
const HOLD_MS = 450

/* reka's own collision padding, which the follow offset would otherwise undo. */
const EDGE = 8

/*
 * reka keeps the tip inside the window for the box it was placed against; the
 * follow offset is added after that, so near the right edge a wide tip (an
 * uptime slice with its breakdown) slid half off screen. The offset is held to
 * the room the window has on each side of where reka put the tip.
 */
function inView(x: number, y: number): { x: number; y: number } {
  const panel = tipBody.value?.parentElement
  if (!panel) return { x, y }
  const rect = panel.getBoundingClientRect()
  const win = panel.ownerDocument.defaultView ?? window
  return {
    x: withinRoom(x, rect.left - offset.value.x, rect.width, win.innerWidth),
    y: withinRoom(y, rect.top - offset.value.y, rect.height, win.innerHeight),
  }
}

function withinRoom(value: number, placed: number, size: number, room: number): number {
  const min = EDGE - placed
  const max = room - EDGE - size - placed
  return max < min ? value : clamp(value, min, max)
}

/*
 * The spring constants come from the kit's shared "float" feel — the same ones
 * LpChart hands to motion-v for its readout. Only the mechanism differs: this
 * panel is portalled and positioned by reka, so there is no absolute target for
 * a declarative animation to own and the spring is integrated by hand.
 */
let sx: SpringState = { value: 0, velocity: 0 }
let sy: SpringState = { value: 0, velocity: 0 }
let frame = 0
let lastFrame = 0
/* The last reading, so the tip can be placed again when the window changes under it. */
let pointer: { el: HTMLElement; x: number; y: number } | null = null

function stopSpring() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  lastFrame = 0
}

/* Straight to the target, with no spring left over to pull it back. */
function jumpToTarget() {
  stopSpring()
  offset.value = { x: target.x, y: target.y }
  sx = { value: target.x, velocity: 0 }
  sy = { value: target.y, velocity: 0 }
}

const settle = (now: number) => {
  const dt = lastFrame ? (now - lastFrame) / 1000 : 1 / 60
  lastFrame = now
  frame = 0

  sx = springStep(sx, target.x, "float", dt)
  sy = springStep(sy, target.y, "float", dt)

  // Close enough to have arrived: snap and stop, so an idle tooltip isn't
  // holding a rAF loop open forever.
  if (springSettled(sx, target.x) && springSettled(sy, target.y)) {
    sx = { value: target.x, velocity: 0 }
    sy = { value: target.y, velocity: 0 }
    offset.value = { x: target.x, y: target.y }
    lastFrame = 0
    return
  }

  offset.value = { x: sx.value, y: sy.value }
  frame = requestAnimationFrame(settle)
}

const onPointerMove = (e: PointerEvent) => {
  if (!props.followCursor) return
  const el = e.currentTarget as HTMLElement | null
  if (!el) return
  pointer = { el, x: e.clientX, y: e.clientY }
  follow()
}

function follow() {
  if (!pointer) return
  const { el, x: clientX, y: clientY } = pointer
  const rect = el.getBoundingClientRect()
  const halfX = props.side === "left" || props.side === "right" ? rect.width / 2 : 0
  const dirX = props.side === "right" ? -1 : 1
  target.x = clientX - (rect.left + rect.width / 2) + halfX * dirX
  /*
   * reka clears the tip past the whole box's EDGE, not past the pointer, so on
   * a tall trigger it ends up half the box above the cursor — measured at 96px
   * on a 180px circle. Adding the half-height back re-references the placement
   * to the pointer itself; `side` then keeps its meaning (the tip still sits
   * above for "top"), now relative to the cursor rather than the box.
   */
  const half = props.side === "top" || props.side === "bottom" ? rect.height / 2 : 0
  const dir = props.side === "bottom" ? -1 : 1
  target.y = clientY - (rect.top + rect.height / 2) + half * dir
  Object.assign(target, inView(target.x, target.y))
  // Without motion the tip goes straight to the reading instead of trailing.
  if (prefersReducedMotion()) {
    jumpToTarget()
    return
  }
  if (!frame) frame = requestAnimationFrame(settle)
}

/*
 * Open state is held here rather than left to reka, so that `disabled` can shut
 * a tip that is already showing. Left to reka, disabling only detaches its
 * handlers — whatever was on screen stayed there.
 */
const open = ref(false)
/* What reka last asked for, regardless of whether it was allowed at the time. */
const wanted = ref(false)

/*
 * A tip opened by a touch hold stays until the next touch or Escape. reka
 * would close it as soon as the finger lifts (a touch leaves the trigger
 * then), so while it is held its own requests to close are not taken.
 */
const heldOpen = ref(false)
const hold = useTouchHold({
  enabled: () => props.touch === "hold" && !props.followCursor && !props.disabled,
  delay: () => HOLD_MS,
  onHold: () => {
    armed.value = true
    heldOpen.value = true
    wanted.value = true
    open.value = true
  },
})

function release() {
  heldOpen.value = false
  wanted.value = false
  open.value = false
}

const onOpenChange = (next: boolean) => {
  if (!next && heldOpen.value) return
  // What reka wants, kept apart from what is currently allowed.
  wanted.value = next
  open.value = next && !props.disabled
  if (!open.value || !props.followCursor) return
  // A fresh open starts at the cursor instead of flying in from wherever the
  // last one came to rest.
  jumpToTarget()
}

/*
 * `disabled` is driven by what the pointer is over, and that is resolved a tick
 * AFTER reka decides to open — so an open request could arrive while the flag
 * was still true from the last gap and be dropped on the floor. The tooltip then
 * refused to appear until the pointer moved again, which read as "hovering does
 * nothing any more".
 *
 * Remembering that a request was made, and honouring it once the obstacle
 * clears, closes that race in the only direction that matters: enabling shows
 * what was asked for, disabling still hides immediately.
 */
watch(
  () => props.disabled,
  (off) => {
    if (off) {
      hold.cancel()
      heldOpen.value = false
      open.value = false
    } else if (wanted.value) open.value = true
  },
)

/*
 * A followed tip moves only with the pointer, so a window that changes under a
 * still pointer (a resize, a phone's address bar, a rotation) would leave it
 * off screen. And a tip that is gone has nothing left to animate.
 */
const view = useView()
watch(
  () => open.value && props.followCursor,
  (following, _, onCleanup) => {
    if (!following) {
      stopSpring()
      return
    }
    const win = viewWindow(view.value)
    win.addEventListener("resize", follow)
    onCleanup(() => win.removeEventListener("resize", follow))
  },
)

watch(heldOpen, (held, _, onCleanup) => {
  if (!held) return
  const win = viewWindow(view.value)
  const onKey = (event: KeyboardEvent) => event.key === "Escape" && release()
  win.addEventListener("pointerdown", release, true)
  win.addEventListener("keydown", onKey, true)
  onCleanup(() => {
    win.removeEventListener("pointerdown", release, true)
    win.removeEventListener("keydown", onKey, true)
  })
})

onBeforeUnmount(stopSpring)

// Overlays open in the window this component renders in (an LpFrame's, inside one).
const portalTo = usePortalTarget()
// What happens in another document (the page around a frame, or a frame in
// the page) is not "outside" for this layer.
const guardOutside = useOutsideGuard()

// Several roots (trigger and portal), so Vue cannot hand attributes on by
// itself and dropped them: a trigger wrapped around this one from outside (an
// LpPopover's, as-child) lost its id, ARIA state and click, and its popover
// never opened. They go to the trigger, which merges them onto the slot's element.
defineOptions({ inheritAttrs: false })
// The caller's own listeners on the trigger run beside the hold's, not instead of them.
const attrs = useAttrs()

/*
 * The tip is mounted on demand (see the header). The trigger is drawn by this
 * component itself rather than by reka's TooltipTrigger, so it is the same
 * element before and after: TooltipTrigger needs the root around it, and
 * putting the root in later would have rebuilt the trigger under the pointer
 * or the focus. What TooltipTrigger does with its events is done here instead,
 * through the root's own context once it exists; reka's TooltipTrigger is
 * still mounted with the tip, as the anchor it is placed against.
 */
const armed = ref(false)
type RootContext = ReturnType<typeof injectTooltipRootContext>
type ProviderContext = ReturnType<typeof injectTooltipProviderContext>
const root = shallowRef<RootContext | null>(null)
let provider: ProviderContext | null = null

const triggerRef = ref<ComponentPublicInstance | null>(null)
const triggerEl = shallowRef<HTMLElement | undefined>()
function readTrigger() {
  const el = triggerRef.value?.$el as Node | null | undefined
  const next = el && el.nodeType === 1 ? (el as HTMLElement) : undefined
  if (next === triggerEl.value) return
  triggerEl.value = next
  root.value?.onTriggerChange(next)
}
onMounted(readTrigger)
onUpdated(readTrigger)

/* What happened before the tip existed, replayed once it does. */
let hovering = false
let focusedBy: HTMLElement | null = null
let pointerDown = false
let pointerMoveOpened = false

const live = () => (root.value && !root.value.disabled.value ? root.value : null)

function enter() {
  const tip = live()
  if (!tip || pointerMoveOpened || provider?.isPointerInTransitRef.value) return
  tip.onTriggerEnter()
  pointerMoveOpened = true
}

function focusOpen(target: HTMLElement) {
  const tip = live()
  if (!tip || pointerDown) return
  if (tip.ignoreNonKeyboardFocus.value && !target.matches?.(":focus-visible")) return
  tip.onOpen()
}

const triggerEvents = {
  onPointerenter(event: PointerEvent) {
    if (event.pointerType === "touch") return
    hovering = true
    armed.value = true
  },
  onPointermove(event: PointerEvent) {
    onPointerMove(event)
    if (event.pointerType === "touch") return
    hovering = true
    armed.value = true
    enter()
  },
  onPointerleave() {
    hovering = false
    const tip = live()
    if (!tip) return
    tip.onTriggerLeave()
    pointerMoveOpened = false
  },
  onPointerdown(event: PointerEvent) {
    const tip = live()
    if (tip?.open.value && !tip.disableClosingTrigger.value) tip.onClose()
    pointerDown = true
    const doc = (event.currentTarget as Node | null)?.ownerDocument ?? document
    doc.addEventListener("pointerup", () => setTimeout(() => (pointerDown = false), 1), { once: true })
  },
  onFocus(event: FocusEvent) {
    focusedBy = event.currentTarget as HTMLElement
    armed.value = true
    focusOpen(focusedBy)
  },
  onBlur() {
    focusedBy = null
    live()?.onClose()
  },
  onClick() {
    const tip = live()
    if (tip && !tip.disableClosingTrigger.value) tip.onClose()
  },
}

/* Hands the root's context out and replays what the tip was armed by. */
const RootBridge = defineComponent({
  setup() {
    root.value = injectTooltipRootContext()
    provider = injectTooltipProviderContext()
    onMounted(() => {
      // After reka's TooltipTrigger, which reports the element it renders (none).
      root.value?.onTriggerChange(triggerEl.value)
      if (hovering) enter()
      if (focusedBy && focusedBy.ownerDocument.activeElement === focusedBy) focusOpen(focusedBy)
    })
    onBeforeUnmount(() => {
      root.value = null
      provider = null
    })
    return () => null
  },
})

const triggerProps = computed(() =>
  mergeProps(attrs, hold.handlers, triggerEvents, {
    "aria-label": props.label ? props.content : undefined,
    "aria-describedby": root.value?.open.value ? root.value.contentId : undefined,
    "data-state": root.value?.stateAttribute.value ?? "closed",
    "data-grace-area-trigger": "",
    class: props.touch === "hold" && !props.followCursor ? "[-webkit-touch-callout:none]" : undefined,
  }),
)
</script>

<template>
  <!-- The caller's own element, with the trigger's props merged onto it. -->
  <Slot ref="triggerRef" v-bind="triggerProps"><slot /></Slot>
  <component v-if="armed" :is="shared ? PassThrough : TooltipProvider" v-bind="shared ? {} : { delayDuration: delay ?? 200 }">
    <!--
      `disable-closing-trigger` in follow mode: reka dismisses a tip when its
      trigger is clicked, which is right for a button (the tip explained the
      thing you just did) and wrong for a chart, where clicking selects a mark
      and the pointer never left it — the reading would vanish mid-interaction.
    -->
    <TooltipRoot
      :open="open"
      :delay-duration="delay"
      :ignore-non-keyboard-focus="!showOnPointerFocus"
      :disable-hoverable-content="followCursor"
      :disable-closing-trigger="followCursor"
      @update:open="onOpenChange"
    >
      <!-- Renders nothing: the anchor the tip is placed against, and the id
           the trigger's aria-describedby points at. -->
      <TooltipTrigger as-child :reference="triggerEl" />
      <RootBridge />
      <TooltipPortal :to="portalTo">
        <TooltipContent
          @interact-outside="guardOutside"
          @escape-key-down="guardOutside"
          :side="side"
          :side-offset="sideOffset ?? 6"
          :collision-padding="8"
          :data-lp-follow="followCursor ? '' : undefined"
          :class="[
            PANEL_SURFACE,
            TOOLTIP_ANIM,
            'z-(--z-tooltip) max-w-[min(20rem,90vw)] px-2.5 py-1.5 text-xs text-ink',
          ]"
          :style="followCursor ? { translate: `${offset.x}px ${offset.y}px` } : undefined"
        >
          <div ref="tipBody"><slot name="content">{{ content }}</slot></div>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </component>
</template>

<style>
/*
 * Unscoped: the element that has to be made transparent is reka's own
 * positioning wrapper, which this component never renders and a scoped
 * attribute therefore never reaches.
 *
 * In follow mode the tip is placed AT the cursor, so both the panel and that
 * wrapper sit under the pointer. The panel alone being transparent was not
 * enough — the wrapper still took the events, the trigger never received its
 * pointerleave, and the tip stayed open: it lingered after the pointer left,
 * a second chart could open its own on top, and a scroll left them stranded
 * because the trigger had never been told the pointer had gone.
 */
:has(> [data-lp-follow]),
[data-lp-follow] {
  pointer-events: none;
}
</style>
