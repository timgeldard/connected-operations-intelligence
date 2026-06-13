# Connected Operations Intelligence — Comprehensive UX Evaluation Report

This document provides a UX evaluation of the **Connected Operations Intelligence** frontend application (`apps/web/`). It assesses design system adherence, visual aesthetics, information hierarchy, layout density for shop-floor operators, and outlines a concrete remediation backlog to transition the UI from pilot-grade to production-grade.

---

## 1. Executive Summary

The frontend application uses a clean, modular structure built on Vite and React. The navigation shell is clean, and the application targets a good industrial color palette based on conformed CSS variables. 

However, the user experience currently faces several critical limitations:
1. **Design System Bypass (Technical Debt)**: The primary landing views (e.g. [RoleAwareHome.tsx](file:///home/timgeldard/github/connected-operations-intelligence/apps/web/src/pages/RoleAwareHome.tsx)) bypass the conformed design system package (`@connectio/design-system`), relying on raw HTML tags with heavy inline styles (`style={{ ... }}`).
2. **"Pilot-Grade" Mock Constraints**: The landing page relies on static, hardcoded arrays for critical widgets (Quality Releases, SPC Signals, Warehouse Holds), creating a disconnect when users navigate from live pages to a static homepage.
3. **Lack of Visual Polish**: The interface is flat and static, lacking smooth micro-animations, loading skeletons, and interactive hover feedbacks.

---

## 2. Design System Adherence & Theme Portability

### The Inline Style Problem
Throughout the page components, layout and styling are defined inline:
```typescript
// Example from RoleAwareHome.tsx
<div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
  <button style={{ padding: '5px 12px', background: 'none', border: '1px solid var(--shell-line)' }}>
     Help & Training
  </button>
</div>
```
* **Impact**:
  * **No Media Queries**: Inline styles cannot natively handle media queries, making responsive layouts (e.g. tablet views for walking warehouse operators) extremely difficult to maintain.
  * **No Pseudo-classes**: Cursors, hover states (`:hover`), active states (`:active`), and focus states (`:focus`) cannot be styled cleanly inline, degrading interactive feedback.
  * **Theme Fragility**: Standardizing or overriding the theme (like introducing a dark mode or updating corporate branding colors) requires refactoring hundreds of style properties instead of editing a single global stylesheet or Tailwind configuration.

---

## 3. Visual Aesthetics, Polish & Micro-interactions

The UI is functional but visually flat, failing to match modern Web design aesthetics:

* **Static Transitions**: Changing workspaces or opening dialog modals happens instantly with no transitional easing. Adding subtle ease-in/ease-out animations makes the UI feel smooth and premium.
* **Absence of Skeleton Loaders**: When fetching data from the Databricks Statement API (which can take 1–3 seconds), pages remain blank or freeze. Integrating `<Skeleton>` components (from `packages/ui/src/components/ui/skeleton.tsx`) improves perceived performance by indicating that data is loading.
* **Low Depth and Contrast**: The UI lacks visual depth. Using subtle gradients, card drop-shadows, and glassmorphism elements would make key cards and headers stand out.

---

## 4. Information Density & Operator Usability

### The Shop-Floor Environment
Manufacturing operators and warehouse pickers interact with dashboards in high-glare, fast-paced environments, often on handheld terminals or mounted wallboards.

```
+-----------------------------------------------------------+
| [Plant Code] [Location] [Date Range]          [Filters]   |  <-- High density controls
+-----------------------------------------------------------+
| [ ] Material ID | Batch ID  | Staging % | Status          |
| [ ] MAT-018274  | B-8274    | === [60%] | [Awaiting Pick] |  <-- Dense data grids
| [ ] MAT-018231  | B-0091    | ======90% | [Staged]        |
+-----------------------------------------------------------+
```

* **Grid Density**: The tabular layouts in Warehouse360 and SPC are correctly optimized for high density, displaying a large volume of data without wasteful padding.
* **Filter Visibility Gaps**: When filtering data grids, there are no visual indicators of active filters other than the state of the dropdown. Adding clear "filter chips" allows operators to quickly see what criteria are active.
* **Touch-Target Sizing**: Many button controls in the cockpit pages are small (less than the standard `44px × 44px` touch target), which causes input mistakes when operators use ruggedized tablets or wear gloves on the warehouse floor.

---

## 5. Concrete Remediation Backlog

### **Quick Wins (1-3 Days)**
1. **Erase Landing Page Mock Data**: Replace the hardcoded arrays (`MOCK_PRIORITY_RELEASE_ITEMS`, `MOCK_SPC_SIGNALS`, `MOCK_WAREHOUSE_HOLDS`) in `RoleAwareHome.tsx` with React Query hooks calling conformed endpoints.
2. **Add Skeleton Placeholders**: Mount the shared `<Skeleton />` component during loading states on all domain cockpit tables.
3. **Inject Gzip & orjson**: Activate payload compression and the faster JSON library (see [api_frontend_caching_spec.md](file:///home/timgeldard/github/connected-operations-intelligence/docs/review/api_frontend_caching_spec.md)) to reduce network load times.

### **Medium Term (2-4 Weeks)**
1. **Refactor Inline Styles to Tailwind**: Convert the inline style properties in `RoleAwareHome.tsx` and core page layouts into Tailwind utility classes using the conformed tokens defined in the design system.
2. **Uplift Touch targets**: Increase button and row padding in touch-critical lists (like staging confirmations) to a minimum height of `40px` to support shop-floor usability.
3. **Add Hover & Active States**: Update buttons to use subtle CSS transitions (`transition-all duration-200`) and scaling hover states (`hover:scale-102`) to make the interface feel responsive and modern.
