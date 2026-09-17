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
  /**
   * Hide this image behind a cover until someone asks for it — a spoiler, a
   * screenshot of something not everyone in the channel has reached yet, a
   * picture that should not appear in a scroll past.
   *
   * A property of the ITEM rather than of the grid showing it: which images are
   * spoilers is a fact about the images, and the usual set is a mixed one, with
   * a marked picture sitting beside plain ones.
   */
  spoiler?: boolean
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
