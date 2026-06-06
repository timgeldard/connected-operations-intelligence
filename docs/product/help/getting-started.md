# Getting Started with ConnectIO-RAD V2

**Audience:** Pilot users  
**Environment:** Kerry Listowel (IE10) pilot — 2026

---

## What is ConnectIO-RAD V2?

ConnectIO-RAD V2 replaces the old collection of separate apps — Intelex, LabWare SPC, PhaseManager, Manhattan WM — with a single unified workspace model. Instead of logging into a different application for each task, you work within domain-specific workspaces that bring together evidence from multiple source systems into one place.

The core idea is that you navigate by what you need to do (a job-to-be-done), not by which system owns the data. The system assembles the relevant evidence panels automatically.

---

## How to Navigate

**1. Start at the home screen**

The home screen shows your workspaces and priority items from each domain. It answers: What needs attention right now? Each domain section shows 1–2 priority items with a direct link into the relevant workspace and view.

**2. Select a workspace**

Click a workspace card to open it. Each workspace has views (the tabs at the top) and evidence panels (the data cards within each view). Switch between views to change the perspective on your domain.

**3. Use Ctrl+K to search**

Press Ctrl+K (or Cmd+K on Mac) to open the command palette. Search for workspaces, admin tools, and help pages by name. This is the fastest way to navigate if you know where you want to go.

**4. Use drill-throughs**

Some evidence panels offer drill-through buttons that take you to a related workspace, carrying the current context. For example, from Quality Batch Release you can drill through to Trace Investigation to see full trace detail for the batch, without having to search for it again.

---

## Pilot Workspaces in Scope

| Workspace | Roles | Lifecycle |
|---|---|---|
| Trace Investigation | Food Safety Lead, Quality Lead | live |
| Quality Batch Release | Quality Lead, QA Technician | live |
| Operations Plan Risk | Operations Supervisor, Plant Manager | live |
| Environmental Monitoring | Quality Lead, QA Technician | live |
| Production Staging | Warehouse Manager, Operations Supervisor | live |
| SPC Monitoring | Quality Lead, QA Technician | pilot |
| Process Order Review | Operations Supervisor | pilot |
| Warehouse 360 Overview | Warehouse Manager | pilot |
| Maintenance & Reliability | Maintenance Lead, Plant Manager | pilot |

Workspaces marked `live` are deployed and connected to source systems (with some adapter-backed rather than fully source-integrated data). Workspaces marked `pilot` are functional but running on mock or partially adapter-backed data.

---

## Mock vs Real Data

During the pilot, some panels show mock data (example data used for demonstration) and some show adapter-backed data (connected to a real source system, though the adapter may still return some mock values).

Look for the freshness indicator (clock icon) and confidence indicator (shield icon) on evidence panels. These tell you how current and reliable the data is. If a panel shows a "mock" label or stale indicator, it is not connected to a live source.

In practice:
- Trace Investigation and Quality Batch Release are the most source-connected workspaces
- SPC Monitoring and Maintenance & Reliability are running on mock data only
- The pilot site (IE10) data represents March 2024 plant state for mock workspaces

---

## How to Give Feedback

Use the "Feedback" button available in each workspace when you find something that does not work as expected, is confusing, or is missing. Your feedback is automatically attributed to the workspace, view, and panel you are looking at when you click it.

Fill in:
- A short title describing the issue
- A description with any detail that would help the team reproduce or understand it
- The category (usability, data-quality, defect, etc.)
- Severity (info, warning, blocker, critical)

All feedback is reviewed by the pilot team. You can see the status of submitted feedback in the Feedback Triage admin view (`?workspace=admin-pilot-feedback`).

For training scenarios that guide you through each workspace step by step, see the Scenario Review Guide (`?workspace=help-scenarios`).
