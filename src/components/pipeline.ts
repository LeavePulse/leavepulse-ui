/*
 * The state of a run of jobs, read off the jobs themselves. Pure, so the
 * rules LpPipeline draws by (which connector is filled, which step is
 * "current", what a run as a whole amounts to) are testable without a DOM.
 */
import { toEpoch } from "./timeSpan"

export type StepStatus = "pending" | "running" | "success" | "failed" | "skipped" | "cancelled"

export interface PipelineStep {
  label: string
  /** Stable id: what `expanded` and the `step` slot address. Defaults to the index. */
  key?: string
  status: StepStatus
  /** A line under the label: the command, the host, the reason it was skipped. */
  description?: string
  /** Replaces the glyph while the step is pending (a step that is "deploy" more than "3"). */
  icon?: string
  /**
   * Time the step took, in ms. When it is not known yet, `startedAt` (and
   * `finishedAt`) let the pipeline work it out — and keep a running step's
   * clock ticking without the app re-sending it every second.
   */
  duration?: number
  startedAt?: Date | string | number
  finishedAt?: Date | string | number
  /** Jobs inside this one, shown when the step is expanded (vertical layout). */
  steps?: PipelineStep[]
}

/** Done, one way or another: nothing more will happen to the step. */
export function isSettled(status: StepStatus): boolean {
  return status !== "pending" && status !== "running"
}

/**
 * Whether the line leaving a step is drawn as travelled. A step that passed
 * or was skipped hands over to the next; one that failed or was cancelled is
 * where the run stopped, so the line after it stays empty — the break in the
 * line is the place to look.
 */
export function connectorFilled(status: StepStatus): boolean {
  return status === "success" || status === "skipped"
}

/**
 * The step a viewer is following: the running one, else the first that has
 * not run yet after something has, else the last failure. -1 when the run has
 * not started or is cleanly over.
 */
export function currentStepIndex(steps: readonly Pick<PipelineStep, "status">[]): number {
  const running = steps.findIndex((s) => s.status === "running")
  if (running !== -1) return running
  const failed = steps.findIndex((s) => s.status === "failed")
  if (failed !== -1) return failed
  const started = steps.some((s) => isSettled(s.status))
  if (!started) return -1
  return steps.findIndex((s) => s.status === "pending")
}

/**
 * What the run amounts to. A failure anywhere outranks everything (one red
 * job fails the build), then work in progress, then a cancellation; a run of
 * passes and skips is a pass. Nothing started is pending.
 */
export function overallStatus(steps: readonly Pick<PipelineStep, "status">[]): StepStatus {
  if (steps.length === 0) return "pending"
  const has = (s: StepStatus) => steps.some((step) => step.status === s)
  if (has("failed")) return "failed"
  if (has("running")) return "running"
  if (has("cancelled")) return "cancelled"
  if (steps.every((s) => s.status === "skipped")) return "skipped"
  if (steps.every((s) => s.status === "success" || s.status === "skipped")) return "success"
  if (steps.some((s) => isSettled(s.status))) return "running"
  return "pending"
}

/**
 * Ms a step has taken, as of `now`. An explicit `duration` wins; otherwise
 * from `startedAt` to `finishedAt`, or to `now` while it is still running.
 * null when there is nothing to say (pending, or no times given).
 */
export function stepElapsed(step: PipelineStep, now: number): number | null {
  if (typeof step.duration === "number" && Number.isFinite(step.duration)) return Math.max(0, step.duration)
  const start = toEpoch(step.startedAt)
  if (Number.isNaN(start)) return null
  const end = toEpoch(step.finishedAt)
  if (!Number.isNaN(end)) return Math.max(0, end - start)
  return step.status === "running" ? Math.max(0, now - start) : null
}

/** "2/5": finished children out of all, for a step whose inside is folded away. */
export function childProgress(step: PipelineStep): { done: number; total: number } | null {
  if (!step.steps?.length) return null
  return { done: step.steps.filter((s) => isSettled(s.status)).length, total: step.steps.length }
}

/** The key a step is addressed by. */
export function stepKey(step: Pick<PipelineStep, "key">, index: number): string {
  return step.key ?? String(index)
}
