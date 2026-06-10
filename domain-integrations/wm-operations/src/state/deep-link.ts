/** Tiny cross-view hand-off store. Views switch via the shell URL (?view=), which
 * unmounts the source view — this carries one-shot context (e.g. "open the worklist
 * filtered to this order") across that boundary without new URL params. */
export interface WorklistDeepLink {
  reference?: string
}

let pending: WorklistDeepLink | null = null

export function setWorklistDeepLink(link: WorklistDeepLink): void {
  pending = link
}

/** Returns the pending deep link once, then clears it. */
export function consumeWorklistDeepLink(): WorklistDeepLink | null {
  const link = pending
  pending = null
  return link
}
