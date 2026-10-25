import { onBeforeUnmount, ref } from "vue"

/*
 * A slider whose value is changed from outside (a reset, a preset, data
 * arriving) glides its thumb and range to the new place instead of jumping;
 * while the user drags, they follow the pointer with no delay, since an
 * eased thumb trailing the finger reads as lag. reka places both with inline
 * `left`/`right`, so the transition goes on those.
 */
export const SLIDER_GLIDE =
  "[&_[style*=left]]:transition-[left,right] [&_[style*=left]]:duration-(--duration-medium) [&_[style*=left]]:ease-(--ease-emphasized) data-[dragging]:[&_[style*=left]]:transition-none motion-reduce:[&_[style*=left]]:transition-none"

export function useSliderDrag() {
  const dragging = ref(false)
  let view: Window | null = null
  const end = () => {
    dragging.value = false
    view?.removeEventListener("pointerup", end)
    view?.removeEventListener("pointercancel", end)
    view = null
  }
  function onPointerDown(event: PointerEvent) {
    dragging.value = true
    view = (event.currentTarget as Element).ownerDocument.defaultView
    view?.addEventListener("pointerup", end)
    view?.addEventListener("pointercancel", end)
  }
  onBeforeUnmount(end)
  return { dragging, onPointerDown }
}
