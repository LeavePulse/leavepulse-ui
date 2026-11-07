declare const process: { env: { NODE_ENV?: string } }

/*
 * Written as the literal `process.env.NODE_ENV` so the consumer's bundler
 * replaces it (Vite and webpack both do for dependencies); where nothing
 * replaces it and no `process` exists, warnings simply stay off.
 */
export function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== "production"
  } catch {
    return false
  }
}

/** A warning for the developer only. */
export function devWarn(message: string): void {
  if (isDev()) console.warn(`[@leavepulse/ui] ${message}`)
}
