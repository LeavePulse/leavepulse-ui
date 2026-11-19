import { ref, watch } from "vue"

/*
 * On a phone the palette is a sheet over the whole screen, and the on-screen
 * keyboard takes the bottom of it without resizing the layout viewport: the
 * last rows would sit under the keys. The visible part is tracked instead and
 * handed to the CSS, so the list ends where the keyboard begins.
 *
 * Returns the CSS variables (--lp-cmd-vh, -vw, -vx, -vy) for the dialog's
 * style, kept current while `open` holds.
 */
export function usePaletteViewport(open: () => boolean | undefined) {
  const viewport = ref<Record<string, string>>({})
  function trackViewport() {
    const vv = typeof window === "undefined" ? undefined : window.visualViewport
    // The whole visible rectangle, not only its height: a page wider than the
    // phone is zoomed out to fit, and a fixed sheet then measures the wider
    // layout instead of the screen the person is looking at.
    viewport.value = vv
      ? {
          "--lp-cmd-vh": `${vv.height}px`,
          "--lp-cmd-vw": `${vv.width}px`,
          "--lp-cmd-vx": `${vv.offsetLeft}px`,
          "--lp-cmd-vy": `${vv.offsetTop}px`,
        }
      : {}
  }
  watch(
    open,
    (isOpen, _, onCleanup) => {
      const vv = typeof window === "undefined" ? undefined : window.visualViewport
      if (!isOpen || !vv) return
      trackViewport()
      vv.addEventListener("resize", trackViewport)
      vv.addEventListener("scroll", trackViewport)
      onCleanup(() => {
        vv.removeEventListener("resize", trackViewport)
        vv.removeEventListener("scroll", trackViewport)
      })
    },
    { immediate: true },
  )
  return viewport
}
