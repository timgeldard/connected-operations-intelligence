# ADR-015: Phase 6 Accessibility Landmark Hardening

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

ConnectIO is being rolled out at Kerry manufacturing sites across Europe. Kerry's IT deployment policy requires compliance with WCAG 2.1 AA for software used at unionised sites, where health and safety regulations extend to accessibility of digital tools. This requirement becomes binding at the point of production rollout (Phase 6 go-live).

Prior to Phase 6, the ConnectIO shell had three accessibility gaps:

1. **No `<main>` landmark.** The main content area in `MainBody.tsx` was rendered as a set of conditional `<div>` branches (one per workspace route). Screen readers could not identify the primary content region.

2. **No skip-to-content link.** Keyboard users had to tab through the navigation rail on every page load before reaching workspace content. For workspaces with long nav structures, this is a significant burden.

3. **Static document title.** The browser tab always showed "ConnectIO RAD V2" regardless of which workspace was active. Screen readers announce the document title on navigation — a static title means users cannot confirm which workspace they have navigated to.

---

## Decision

Three accessibility changes are made in Phase 6:

### 1. Single `<main>` landmark in MainBody

`MainBody.tsx` is refactored from per-branch `<div>` wrappers to a single `<main id="connectio-main-content">` element that wraps all workspace content branches. The `id` is stable across workspace navigations so that the skip-to-content link target remains valid.

### 2. Skip-to-content link in ShellLayout

A visually hidden `<a href="#connectio-main-content">` link is added as the first focusable element in `ShellLayout.tsx`. It is rendered off-screen by default and becomes visible on keyboard focus (using a CSS translate transform). This allows keyboard users to bypass the navigation rail without tabbing through it.

### 3. Dynamic `document.title` per workspace

Each workspace sets `document.title` reactively based on the active workspace's `displayName`. The pattern is:

```
{workspaceDisplayName} — ConnectIO
```

For pages that do not map to a workspace registration (admin pages, error states), the title is set explicitly in the page component. This ensures that screen reader route announcements include a meaningful workspace name.

---

## Rationale

### Why a single `<main>` rather than per-branch landmarks?

The HTML specification permits exactly one `<main>` landmark per page. Multiple `<main>` elements (one per workspace branch) would be invalid HTML and cause screen reader behaviour to be unpredictable. A single `<main>` with a stable `id` is the correct pattern for a single-page application that swaps content within a persistent shell.

### Why a CSS-visible skip link rather than a fully hidden one?

A fully hidden skip link (using `display: none` or `visibility: hidden`) is not reachable by keyboard users, defeating its purpose. The CSS translate approach (used by GOV.UK Design System and others) makes the link visible to keyboard users on focus while keeping it out of the visual layout for pointer users.

### Why `document.title` rather than a live region announcement?

`document.title` changes are announced by screen readers on navigation in single-page applications when the focus is appropriately managed. This is the lowest-friction approach — it works without adding a visually hidden ARIA live region element and does not introduce timing dependencies on focus management.

### Why WCAG 2.1 AA and not AAA?

WCAG 2.1 AA is the threshold required by Kerry's IT deployment policy and the relevant EU accessibility directive baseline. AAA is aspirational and contains success criteria that are not consistently achievable for complex data applications.

---

## Consequences

### Positive

- ConnectIO meets WCAG 2.1 AA requirements for landmark structure, keyboard bypass, and route announcement
- The skip-to-content link improves keyboard navigation speed for power users regardless of disability status
- Dynamic document titles improve browser history readability and tab management

### Negative

- Per-page document title management adds a small amount of boilerplate — each page component is responsible for setting its own title
- The `<main>` refactor touched `MainBody.tsx` across all workspace branches, creating a wide diff

### Mitigations

- A shared `useDocumentTitle(workspaceDisplayName)` hook centralises the title-setting pattern and reduces boilerplate
- The `MainBody.tsx` refactor was limited to the landmark wrapper — no workspace-specific content logic was changed
