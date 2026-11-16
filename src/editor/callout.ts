export type CalloutTone = "info" | "success" | "warning" | "danger"

/** Name of each tone, as the tone picker lists it. */
export type CalloutLabels = Record<CalloutTone, string>

export interface CalloutToneRow {
  id: CalloutTone
  icon: string
  box: string
  ink: string
}

export const CALLOUT_TONES: CalloutToneRow[] = [
  { id: "info", icon: "lucide:info", box: "border-brand/30 bg-brand-soft", ink: "text-brand" },
  { id: "success", icon: "lucide:lightbulb", box: "border-action/30 bg-action-soft", ink: "text-action" },
  { id: "warning", icon: "lucide:triangle-alert", box: "border-accent/30 bg-accent-soft", ink: "text-accent" },
  { id: "danger", icon: "lucide:octagon-alert", box: "border-danger/30 bg-danger-soft", ink: "text-danger" },
]
