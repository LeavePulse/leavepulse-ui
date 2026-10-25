import type { MeterTone } from "./meter"

/*
 * The states a service, a bot or a person can be in, and what each one looks
 * like. Named by meaning so a table of servers and a header pill agree on what
 * "degraded" is without each picking a colour.
 */
export type StatusKind =
  | "online"
  | "offline"
  | "degraded"
  | "down"
  | "maintenance"
  | "starting"
  | "unknown"

export interface StatusLook {
  tone: MeterTone
  /**
   * Whether the light breathes. Reserved for states that are LIVE (online:
   * something is answering right now) or IN MOTION (starting: it will not stay
   * like this) or demand attention (down). A pulse on every row would make the
   * pulse mean nothing, so steady states stay still.
   */
  pulse: boolean
}

export const STATUS_LOOK: Record<StatusKind, StatusLook> = {
  online: { tone: "ok", pulse: true },
  offline: { tone: "neutral", pulse: false },
  degraded: { tone: "warning", pulse: false },
  down: { tone: "danger", pulse: true },
  maintenance: { tone: "brand", pulse: false },
  starting: { tone: "brand", pulse: true },
  unknown: { tone: "neutral", pulse: false },
}

export const STATUS_LABELS: Record<StatusKind, string> = {
  online: "Online",
  offline: "Offline",
  degraded: "Degraded",
  down: "Down",
  maintenance: "Maintenance",
  starting: "Starting",
  unknown: "Unknown",
}
