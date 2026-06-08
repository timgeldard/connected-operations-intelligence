# Design System Compliance Report — ConnectIO-RAD V2

**Audit date:** 2026-05-16

---

## Design system summary

The `@connectio/design-system` package (`packages/design-system/src/`) is a CSS-token layer combined with:
- Wrapped shadcn/radix-ui primitives (Button, Badge, Card, Skeleton, Separator, Tabs, Tooltip, Dialog, DropdownMenu)
- Manufacturing-domain components (StatusBadge, LifecycleBadge, OwnerBadge, ConfidenceIndicator, FreshnessIndicator, DrillThroughButton, EmptyState, ErrorState, LoadingState, CommandPalette)
- CSS token layer: `packages/design-system/src/tokens/tokens.css`

The design system boundary is enforced by documented import prohibitions in `workspace-runtime` and `evidence-panel-runtime`.

---

## Compliance assessment

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Design system package exists and is well-structured | Compliant | 24 files; proper barrel export; CSS token foundation |
| `workspace-runtime` uses design-system, not shadcn directly | Compliant | `packages/workspace-runtime/src/index.ts` documents explicit prohibition |
| `evidence-panel-runtime` uses design-system, not shadcn directly | Compliant | `packages/evidence-panel-runtime/src/index.ts` documents explicit prohibition and no circular import from workspace-runtime |
| CSS custom properties used for semantic colors | Mostly compliant | Shell components and card containers use `var(--shell-surface)`, `var(--shell-line)`, etc. |
| Domain panel components use CSS tokens for status colors | Non-compliant | 3 panels use hardcoded hex literals instead of token references |
| Typography scale defined via tokens | Not verified | Token file not fully read; assumed from existing token coverage |

---

## Non-compliance findings

### NC-001: Hardcoded hex colors in ControlChartPanel

**File:** `domain-integrations/spc/src/panels/control-chart-panel.tsx`  
**Severity:** Low  
**Finding:** `STATUS_COLOR` map uses raw hex values:

```typescript
const STATUS_COLOR: Record<string, string> = {
  'out-of-control': '#D32F2F',
  'warning': '#D97706',
  'in-control': '#388E3C',
}
```

**Required:** Replace with CSS custom properties:

```typescript
const STATUS_COLOR: Record<string, string> = {
  'out-of-control': 'var(--status-bad)',
  'warning': 'var(--status-warn)',
  'in-control': 'var(--status-good)',
}
```

---

### NC-002: Mixed token/hex colors in TraceGraphPanel

**File:** `domain-integrations/traceability/src/panels/trace-graph-panel.tsx`  
**Severity:** Low  
**Finding:** `riskColour` map mixes token references and bare hex:

```typescript
const riskColour: Record<string, string> = {
  critical: 'var(--sunset, #F24A00)',   // uses token with hex fallback
  high: '#D97706',                       // bare hex — non-compliant
  medium: '#D4A017',                     // bare hex — non-compliant
  low: 'var(--sage, #289BA2)',           // uses token with hex fallback
  none: 'var(--shell-fg-3)',             // compliant
}
```

**Required:** Replace bare hex values with token references (add the tokens if missing from tokens.css).

---

### NC-003: Hardcoded hex colors in EnvMonHeatmapPanel

**File:** `domain-integrations/envmon/src/panels/envmon-heatmap-panel.tsx`  
**Severity:** Low  
**Finding:** `riskColor()` function returns hardcoded hex:

```typescript
function riskColor(score: number): string {
  if (score >= 70) return '#D32F2F'
  if (score >= 40) return '#F57C00'
  if (score >= 15) return '#D97706'
  return '#2E7D32'
}
```

**Required:** Replace with CSS token references or inline custom property lookups.

---

## Observations

| Item | Finding |
|------|---------|
| `cn()` utility | Correctly implemented (`clsx` + `twMerge`) in `design-system/src/lib/utils.ts` |
| Token coverage | Tokens defined for: brand, background, foreground, accent, status (good/warn/bad/info/neutral), lifecycle states, confidence, freshness |
| shadcn import prohibition | Enforced via code comment; no automated lint rule observed (no ESLint rule seen for this) |
| Manufacturing component completeness | All commonly needed manufacturing-context components are present |
| `DesignSystemCompliancePage` in router | The page exists but its data is a hardcoded snapshot, not derived from a live compliance scan |

---

## Recommendations

| Priority | Action |
|----------|--------|
| Low | Fix 3 hardcoded hex violations in ControlChartPanel, TraceGraphPanel, EnvMonHeatmapPanel |
| Low | Add ESLint rule to enforce no-direct-shadcn-import (replace comment-only prohibition with automated check) |
| Low | Add `--sunset` and `--sage` tokens to tokens.css if not already present; remove hex fallbacks |
| Low | Replace `DesignSystemCompliancePage` hardcoded findings with a real eslint-driven compliance scan, or move the page to docs |
