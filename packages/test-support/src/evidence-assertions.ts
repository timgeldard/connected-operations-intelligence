import { expect } from 'vitest'

export const FORBIDDEN_CLAIMS = [
  'safe',
  'approved',
  'released',
  'low risk',
  'in control',
  'recall not required',
  'no issue found',
  'healthy',
  'complete',
  'on time',
  'fully contained',
]

export function expectNoForbiddenClaims(container: HTMLElement, allowedExceptions: string[] = []) {
  const content = container.textContent?.toLowerCase() || ''
  const forbidden = FORBIDDEN_CLAIMS.filter((claim) => !allowedExceptions.includes(claim))

  for (const claim of forbidden) {
    expect(content, `Found forbidden claim "${claim}" in rendered output`).not.toContain(claim)
  }
}
