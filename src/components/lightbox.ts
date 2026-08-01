/*
 * Shared lightbox types. Its own module so LpLightbox and anything building a
 * gallery around it can import the item shape without a component cycle.
 */

export interface LightboxItem {
  /** Full-size source. */
  src: string
  /** Smaller source for the filmstrip; falls back to `src`. */
  thumb?: string
  /** Caption under the image, and the img alt text. */
  title?: string
  /** Secondary line under the title (size, date, resolution…). */
  description?: string
  /** Filename used when downloading; derived from `src` when absent. */
  filename?: string
}

/** Last path segment of a URL, or a fallback — used to name a download. */
export function fileNameOf(item: LightboxItem, fallback = "image"): string {
  if (item.filename) return item.filename
  try {
    // Works for blob:/data: too — those just have no useful tail, hence the
    // fallback below.
    const path = new URL(item.src, "http://x").pathname
    const tail = decodeURIComponent(path.split("/").pop() ?? "")
    if (tail) return tail
  } catch {
    // Not a parseable URL; fall through.
  }
  return fallback
}
