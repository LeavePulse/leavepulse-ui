export type ImageLayout = "center" | "left" | "right" | "wrapLeft" | "wrapRight"

/** What the layout picker calls each placement. */
export type ImageLabels = Record<ImageLayout, string> & { caption: string; resize: string }

export interface ImageLayoutRow {
  value: ImageLayout
  icon: string
  /** Classes on the image's box: how it sits in the line and whether text runs around it. */
  box: string
}

export const IMAGE_LAYOUTS: ImageLayoutRow[] = [
  { value: "center", icon: "lucide:align-center", box: "mx-auto" },
  { value: "left", icon: "lucide:align-left", box: "mr-auto" },
  { value: "right", icon: "lucide:align-right", box: "ml-auto" },
  { value: "wrapLeft", icon: "lucide:panel-left", box: "float-left mr-5 mb-2 max-w-[60%]" },
  { value: "wrapRight", icon: "lucide:panel-right", box: "float-right ml-5 mb-2 max-w-[60%]" },
]

export const MIN_IMAGE_WIDTH = 15
