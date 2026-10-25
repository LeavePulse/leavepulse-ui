/*
 * Dev only: a full reload by Vite (an edit it cannot hot-swap, such as the
 * kit's index) brings the page back where it was. The page scrolls inside the
 * shell's region, not the window, so the browser's own restoration never
 * applies and every reload landed at the top.
 */
const KEY = "lp-preview-scroll"

const scroller = () =>
  document.querySelector<HTMLElement>("main [data-reka-scroll-area-viewport]") ??
  (document.scrollingElement as HTMLElement | null)

export function keepScrollAcrossReloads(): void {
  if (!import.meta.hot) return
  import.meta.hot.on("vite:beforeFullReload", () => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ path: location.pathname, top: scroller()?.scrollTop ?? 0 }))
    } catch {}
  })

  let saved: { path: string; top: number } | null = null
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null")
    sessionStorage.removeItem(KEY)
  } catch {}
  if (!saved || saved.path !== location.pathname || !saved.top) return

  // The page grows as its examples mount: wait until it is tall enough to
  // hold the old position, and give up after a few seconds.
  const { top } = saved
  const started = performance.now()
  const restore = () => {
    const box = scroller()
    if (box && box.scrollHeight - box.clientHeight >= top) {
      box.scrollTo({ top, behavior: "instant" })
      return
    }
    if (performance.now() - started < 4000) requestAnimationFrame(restore)
    else box?.scrollTo({ top, behavior: "instant" })
  }
  requestAnimationFrame(restore)
}
