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

/** Read the pending deep link WITHOUT clearing it — safe to call during render
 * (no side effect, so abandoned/re-run concurrent renders cannot drop the link). */
export function peekWorklistDeepLink(): WorklistDeepLink | null {
  return pending
}

/** Clear the pending deep link. Call from an effect after the consumer has committed. */
export function clearWorklistDeepLink(): void {
  pending = null
}
