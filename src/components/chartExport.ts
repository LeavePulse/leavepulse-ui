/*
 * LpChart's exports: the data as CSV and the plot as a PNG, in the theme it is
 * shown in; offering the download is the component's. Every series goes out,
 * hidden ones included: what a reader toggled off for a closer look is still
 * part of the data they asked to take away.
 */
import { nodeWindow } from "../composables/useView"
import { backgroundOf, resolveCssColor, svgToPng, toCsv, type CsvOptions } from "./exportData"

export interface ChartExportOptions {
  /** File name without extension. Defaults to the title. */
  filename?: string
  /** Return the data without offering a download. */
  download?: boolean
}

export interface ChartCsvSource {
  labels: readonly string[]
  series: readonly { id: string; name: string; values: readonly (number | null)[] }[]
  /** Header of the label column. */
  xColumn: string
}

/** The data as CSV: a label column, then one column per series. */
export function chartCsv(source: ChartCsvSource, options: CsvOptions = {}): string {
  const rows = source.labels.map((label, i) => ({ label, i }))
  return toCsv(rows, [
    { key: "label", label: source.xColumn },
    ...source.series.map((s) => ({ key: s.id, label: s.name, value: (r: { i: number }) => s.values[r.i] })),
  ], options)
}

export interface ChartPngSource {
  svg: SVGSVGElement
  /** The chart's root, whose computed style gives the font, colours and background. */
  root: HTMLElement | null
  title?: string
  /** The legend painted above the plot; empty for none. */
  legend: readonly { name: string; color: string }[]
}

/*
 * The plot as a picture, in the theme it is shown in. The legend and title are
 * HTML, so they are painted onto the canvas separately, in the page's font; the
 * SVG travels with its computed colours inlined, because an SVG drawn as an
 * image cannot see the page's custom properties.
 */
export function chartPng(
  source: ChartPngSource,
  options: { scale?: number; background?: string } = {},
): Promise<Blob> {
  const { svg, root, title, legend } = source
  const style = nodeWindow(svg).getComputedStyle(root ?? svg)
  const font = style.fontFamily
  const ink = style.getPropertyValue("--color-ink").trim() || style.color
  const muted = style.getPropertyValue("--color-muted-strong").trim() || style.color
  return svgToPng(svg, {
    scale: options.scale,
    padding: 16,
    background: options.background ?? backgroundOf(root),
    header: (ctx) => {
      let y = 0
      if (title) {
        ctx.font = `500 14px ${font}`
        ctx.fillStyle = ink
        ctx.textBaseline = "top"
        ctx.fillText(title, 0, y)
        y += 22
      }
      if (legend.length) {
        ctx.font = `12px ${font}`
        ctx.textBaseline = "middle"
        let x = 0
        for (const s of legend) {
          ctx.fillStyle = resolveCssColor(s.color, root ?? svg)
          ctx.beginPath()
          ctx.arc(x + 4, y + 8, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = muted
          ctx.fillText(s.name, x + 14, y + 8)
          x += 14 + ctx.measureText(s.name).width + 16
        }
        y += 24
      }
      return y ? y + 8 : 0
    },
  })
}
