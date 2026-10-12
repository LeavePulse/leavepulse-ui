/*
 * Data export shared by the table and the chart: CSV text, a file download,
 * and an SVG rasterised with its theme resolved.
 */

export interface CsvColumn<Row> {
  key: string
  /** Header cell. Defaults to the key. */
  label?: string
  /** The value written for a row; the row's `key` field when omitted. */
  value?: (row: Row) => unknown
}

export interface CsvOptions {
  /** Field separator. Default ",". Some locales' spreadsheets expect ";". */
  separator?: string
  /** Prefix a UTF-8 byte order mark so Excel reads non-ASCII text correctly. */
  bom?: boolean
  /**
   * Neutralise cells a spreadsheet would run as a formula (leading = + - @,
   * tab or CR) by prefixing a quote. On by default: exported data is often
   * user-supplied, and opening it is enough to trigger a formula.
   */
  guardFormulas?: boolean
  /** Line ending. Default "\r\n", as RFC 4180 specifies. */
  newline?: string
}

const FORMULA_START = /^[=+\-@\t\r]/

function cellText(value: unknown): string {
  if (value == null) return ""
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

/** One CSV field, quoted when it holds a separator, a quote or a line break. */
export function csvField(value: unknown, options: CsvOptions = {}): string {
  const separator = options.separator ?? ","
  let text = cellText(value)
  if ((options.guardFormulas ?? true) && typeof value === "string" && FORMULA_START.test(text)) {
    text = `'${text}`
  }
  const needsQuotes = text.includes(separator) || /["\r\n]/.test(text) || /^\s|\s$/.test(text)
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text
}

/** Rows as CSV text, a header line first. */
export function toCsv<Row>(rows: readonly Row[], columns: readonly CsvColumn<Row>[], options: CsvOptions = {}): string {
  const separator = options.separator ?? ","
  const newline = options.newline ?? "\r\n"
  const line = (cells: unknown[]) => cells.map((c) => csvField(c, options)).join(separator)
  const out = [line(columns.map((c) => c.label ?? c.key))]
  for (const row of rows) {
    out.push(
      line(columns.map((c) => (c.value ? c.value(row) : (row as Record<string, unknown>)[c.key]))),
    )
  }
  return (options.bom ? "﻿" : "") + out.join(newline) + newline
}

/**
 * Hand the viewer a file to save. Does nothing outside a browser, so a call
 * that runs during SSR is harmless.
 */
export function downloadFile(name: string, data: Blob | string, type = "text/plain;charset=utf-8"): void {
  if (typeof document === "undefined" || typeof URL === "undefined") return
  const blob = typeof data === "string" ? new Blob([data], { type }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.rel = "noopener"
  a.style.display = "none"
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const PAINT_PROPS = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "stop-color",
  "stop-opacity",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "visibility",
  "display",
] as const

/**
 * A standalone copy of a live SVG: every element carries its computed paint as
 * an inline style, so CSS custom properties and classes from the page's
 * stylesheet survive being rendered as an image, and running SMIL animations
 * are frozen at their end state.
 */
export function inlineSvg(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const source = [svg, ...svg.querySelectorAll("*")]
  const target = [clone, ...clone.querySelectorAll("*")]
  source.forEach((el, i) => {
    const copy = target[i]
    if (!(copy instanceof Element)) return
    const computed = getComputedStyle(el)
    const style = PAINT_PROPS.map((p) => `${p}:${computed.getPropertyValue(p)}`)
      .filter((d) => !d.endsWith(":"))
      .join(";")
    copy.setAttribute("style", style)
    copy.removeAttribute("class")
  })
  // Comment nodes (Vue leaves them in development builds) may hold "--", which
  // is invalid inside an XML comment and makes the whole image fail to load.
  const comments = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT)
  const dead: Node[] = []
  while (comments.nextNode()) dead.push(comments.currentNode)
  for (const node of dead) node.parentNode?.removeChild(node)
  for (const anim of clone.querySelectorAll("animate")) {
    const attr = anim.getAttribute("attributeName")
    const to = anim.getAttribute("to")
    if (attr && to != null) anim.parentElement?.setAttribute(attr, to)
    anim.remove()
  }
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  const { width, height } = svg.getBoundingClientRect()
  clone.setAttribute("width", String(width))
  clone.setAttribute("height", String(height))
  clone.style.overflow = "visible"
  return clone
}

export interface RasterOptions {
  /** Device pixels per CSS pixel. Default: the screen's ratio, at least 2. */
  scale?: number
  /** Fill behind the drawing; transparent when omitted. */
  background?: string
  /** Extra space around the drawing, in CSS pixels. */
  padding?: number
  /** Drawn above the SVG, in the page's own font. */
  header?: (ctx: CanvasRenderingContext2D, width: number) => number
}

/** Rasterise an SVG element to a PNG blob with its theme resolved. */
export async function svgToPng(svg: SVGSVGElement, options: RasterOptions = {}): Promise<Blob> {
  const copy = inlineSvg(svg)
  const width = Number(copy.getAttribute("width"))
  const height = Number(copy.getAttribute("height"))
  const markup = new XMLSerializer().serializeToString(copy)
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }))
  try {
    const img = new Image()
    img.decoding = "async"
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("SVG could not be rasterised"))
    })
    img.src = url
    await loaded

    const scale = options.scale ?? Math.max(2, globalThis.devicePixelRatio || 1)
    const pad = options.padding ?? 0
    const measure = document.createElement("canvas").getContext("2d")
    const headerHeight = measure && options.header ? options.header(measure, width) : 0
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil((width + pad * 2) * scale)
    canvas.height = Math.ceil((height + headerHeight + pad * 2) * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D is unavailable")
    ctx.scale(scale, scale)
    if (options.background) {
      ctx.fillStyle = options.background
      ctx.fillRect(0, 0, width + pad * 2, height + headerHeight + pad * 2)
    }
    ctx.translate(pad, pad)
    if (options.header) options.header(ctx, width)
    ctx.drawImage(img, 0, headerHeight, width, height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png"),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** The first non-transparent background at or above an element. */
export function backgroundOf(el: Element | null): string | undefined {
  for (let node = el; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor
    if (bg && bg !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(bg)) return bg
  }
  return undefined
}

/**
 * A colour as the browser resolves it where `within` sits, for APIs that cannot
 * read custom properties (canvas, an SVG drawn as an image).
 */
export function resolveCssColor(value: string, within: Element): string {
  if (!value.includes("var(") && !value.toLowerCase().includes("currentcolor")) return value
  const probe = document.createElement("span")
  probe.style.color = value
  probe.style.display = "none"
  within.append(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return resolved || value
}

/** A filesystem-safe name from a title. */
export function fileStem(title: string | undefined, fallback: string): string {
  const stem = (title ?? "").trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "").replace(/\s+/g, "-")
  return stem || fallback
}
