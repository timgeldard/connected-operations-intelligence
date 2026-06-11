# ConnectIO-RAD V2 — One Pager

**Audience:** Domain leads, programme sponsors, site leadership  
**Date:** 2026-05-15

---

## What V2 Is

ConnectIO-RAD V2 is the replacement for Kerry's collection of separate operational applications — Intelex, LabWare, PhaseManager, Manhattan Warehouse Management — with a single, unified workspace model. V2 is delivered as a Rapid Application Design (RAD) prototype to validate the product model before committing to full engineering build.

The goal is not to rebuild the same apps in a new UI. The goal is to change how users navigate: by the job they need to do, not by which system owns the data.

---

## Why the App-Centric Model Is Changing

The current Kerry operational landscape requires users to:

- Log into separate systems for trace, quality, operations, warehouse, and maintenance data
- Context-switch between systems to assemble a complete picture of a batch, order, or risk event
- Accept that cross-domain workflows (e.g. batch release decisions that require trace, SPC, and environmental data) require multiple logins and manual data assembly

This creates cognitive overhead, slows decision-making, and means that the data a user needs is visible in full only after visiting three or four systems.

---

## What "Unified Operational Workspace" Means

A workspace is a purpose-built view for a specific business task — "Release this batch", "Investigate this trace event", "Assess today's plan risk". The workspace assembles the relevant evidence panels from whichever source systems own the data, presents them in a single layout, and provides the actions needed to complete the task.

The user never needs to know which system owns which panel. They navigate by intent, not by system.

---

## How Roles See Different Cockpits

The home screen and workspace navigation are role-aware. A Quality Lead sees quality-focused priority items and workspaces. An Operations Supervisor sees plan risk and staging readiness. A Plant Manager sees a cross-domain overview with priority items from all domains.

Nine workspaces are in the pilot, covering six roles: Food Safety Lead, Quality Lead, QA Technician, Operations Supervisor, Warehouse Manager, Maintenance Lead, and Plant Manager. Each role has a tailored starting point.

---

## How Evidence Panels Work

Each evidence panel is a reusable data card owned by a domain team. Panels carry:
- **Owner badge** — which domain is accountable for the data
- **Freshness indicator** — how recently the data was updated from its source
- **Confidence indicator** — how reliable the data is

A workspace can include panels from multiple domains. A batch release workspace can show quality inspection results (owned by Quality), SPC signals (owned by Quality), trace exposure (owned by Traceability), and warehouse hold status (owned by Warehouse) in a single view. No cross-system navigation required.

---

## How Source Ownership Is Preserved

Despite assembling cross-domain data in one workspace, source ownership is explicit. Each panel's `ownerDomain` field identifies the accountable team. Panels can only appear in workspaces that have been explicitly approved by the owning domain (`allowedConsumerWorkspaces`). Domain teams retain ownership of their data contracts, adapters, and panel implementations.

---

## What Is Included in the Pilot

The controlled pilot runs at Kerry Listowel (IE10) using a mix of adapter-backed and mock data. Nine workspaces are in scope:

- **Live lifecycle (5):** Trace Investigation, Quality Batch Release, Operations Plan Risk, Environmental Monitoring, Production Staging
- **Pilot lifecycle (4):** SPC Monitoring, Process Order Review, Warehouse 360 Overview, Maintenance & Reliability

Six validation scenarios cover the key user journeys across these workspaces. Three have passed or passed-with-observations; three are in-progress or not yet started.

---

## What Remains Out of Scope

The following are not part of the V2 pilot:

- Live data for SPC Monitoring and Maintenance & Reliability (both remain on mock data pending source contracts)
- Multi-site scope switching (pilot is scoped to IE10)
- Backend persistence of action outcomes (actions log to console only; no write-back to ERP, LIMS, or MES)
- Training completion records (training is scenario-guided but not LMS-integrated in the pilot)
- Server-side role and permission enforcement (the pilot uses a client-only auth model)

---

## How Success Will Be Measured

Pilot success is assessed against 12 exit criteria and 10 release gates. Key measures:

- At least 80% of 6 validation scenarios pass or pass-with-observations
- All required domain stakeholder sign-offs approved or conditionally approved
- Zero unresolved accessibility blockers
- All action flows have validation and telemetry
- Pilot support model validated through the controlled pilot

---

## What Stakeholders Need to Validate

Each domain stakeholder is asked to:

1. Review the pilot workspace pack for their domain
2. Run or observe the training scenarios relevant to their team's roles
3. Submit feedback on data accuracy, missing evidence, and workflow fit
4. Document any conditions for formal sign-off
5. Provide formal sign-off (or document blockers) for their domain workspaces

See the Pilot Review Guide (`docs/stakeholders/pilot-review-guide.md`) for step-by-step instructions.
