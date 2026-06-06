# Security and Access Review

**Phase:** 7  
**Last updated:** 2026-05-15  
**Admin view:** `?workspace=admin-pilot-security-access-review`

## Review Scope

The Security & Access Review Matrix (`SecurityAccessReviewPage.tsx`) assesses role × workspace × scope permission combinations against expected access. It covers 6 pilot roles across 17 review entries spanning the 9 pilot workspaces.

Roles covered: `quality-lead`, `qa-technician`, `food-safety-lead`, `operations-supervisor`, `warehouse-manager`, `maintenance-lead`, `plant-manager`, `admin`.

The review uses the `SecurityAccessReviewItem` type from `packages/product-model/src/types/pilot.ts`. Each item records `accessExpected`, `accessActual`, and `status` (`correct | over-permissioned | under-permissioned | not-assessed`).

---

## Summary

| Status | Count |
|---|---|
| correct | 14 |
| over-permissioned | 3 |
| under-permissioned | 0 |
| not-assessed | 0 |

---

## Over-Permissioned Findings

Three entries are flagged as `over-permissioned` in the current pilot model:

**SAR-004** — `quality-lead` / `operations-plan-risk` / `plant` scope  
Quality Lead can view Operations Plan Risk in the current mock model. This access is not expected — Quality Lead should not have visibility into the Operations Plan Risk workspace. Finding: client-only mock grants access indiscriminately. Recommendation: Restrict via role claim once server-side enforcement is active.

**SAR-010** — `operations-supervisor` / `quality-batch-release` / `plant` scope  
Operations Supervisor can view Batch Release in the current mock model. Read-only cross-domain visibility may be acceptable in some configurations, but full view access (including release actions) is not expected for this role. Recommendation: Restrict write actions via role claim in production. Read-only access may be formally approved once the role model is reviewed.

**SAR-016** — `qa-technician` / `admin-governance` / `plant` scope  
Governance dashboards (all `?workspace=admin-*` routes) are accessible to all roles in the current mock model. These should be restricted to the `admin` role. Finding: no route-level auth guard is in place in the pilot shell. Recommendation: Restrict admin routes to admin role via server-side enforcement in production.

---

## Client-Only Pilot Limitation

The current pilot runs a client-only permission model. The `hasPermission()` function in `packages/auth-scope/src/permissions.ts` checks IdP group membership from the JWT `groups` claim, but in the pilot the JWT groups are mock and the role claim is not enforced at the API or route level.

This means:
- Over-permissioned findings (SAR-004, SAR-010, SAR-016) cannot be enforced via the current implementation
- Any user with pilot access can navigate to any workspace or admin route by modifying the URL
- Role-based access is signalled in the UI (workspace visibility, action availability) but not enforced at the server

This is acceptable for a controlled pilot where users are known and trusted. It is **not acceptable for production**.

---

## What Requires Server-Side Enforcement Before Production

Before production rollout, the following must be implemented:

1. **Server-side route guards** — Admin workspace routes (`?workspace=admin-*`) must be gated by the `admin` role claim at the API level, not the client.
2. **Role claim enforcement at the API** — All data requests must validate the caller's role and scope against the workspace's `requiredPermissions` and `scopePolicy`.
3. **Write action gating** — Actions (Release Batch, Escalate, Confirm Staging, etc.) must check the calling user's role before executing. Client-side action availability checks are informational only.
4. **Workspace visibility enforcement** — `lifecycle: 'pilot'` workspaces must be gated by the `connectio.pilot-access` group at the session level, not just in the nav render.

GATE-008 (Security / Access Gate) and SO-008 (Security & Access Lead sign-off) are both blocked until a server-side enforcement design is submitted for review. These are prerequisites for production but not blocking conditions for the controlled pilot.
