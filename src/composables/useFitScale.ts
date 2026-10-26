import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue"

/*
 * How much a line that must not wrap has to shrink to fit its box. Text width
 * grows in step with the font size, so the width the content would have at
 * full size is its current width over the current scale, and one measurement
 * gives the answer. The scale stops at `min`: past it the text would be too
 * small to read, and `clipped` says the caller should cut it instead.
 */
export function useFitScale(
  box: Ref<HTMLElement | null | undefined>,
  content: Ref<HTMLElement | null | undefined>,
  min = 0.6,
) {
  const scale = ref(1)
  const clipped = ref(false)
  let observer: ResizeObserver | undefined

  function measure() {
    const room = box.value?.clientWidth ?? 0
    const width = content.value?.scrollWidth ?? 0
    if (!room || !width) return
    const natural = width / scale.value
    const next = Math.max(min, Math.min(1, Math.floor((room / natural) * 100) / 100))
    if (next !== scale.value) scale.value = next
    clipped.value = natural * next > room + 0.5
  }

  function observe() {
    observer?.disconnect()
    if (typeof ResizeObserver === "undefined") return
    observer = new ResizeObserver(measure)
    if (box.value) observer.observe(box.value)
    if (content.value) observer.observe(content.value)
    measure()
  }

  onMounted(observe)
  watch([box, content], observe, { flush: "post" })
  onBeforeUnmount(() => observer?.disconnect())

  return { scale, clipped }
}
