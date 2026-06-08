# ADR-0001: Applications use governed consumption views only

## Status

Accepted.

> [!NOTE]
> Warehouse360 is still in migration and has not yet been cut over to governed contracts.

## Context

Application code historically depended on legacy runtime views such as `wh360_*`.

To improve stability, security, and lifecycle management, the target architecture requires all application-facing data access to be contract-backed and governed.

## Decision

Application code must not directly query:
* Raw SAP tables (`connected_plant_*.sap.*`)
* Bronze objects
* Silver objects
* Internal Gold objects
* Legacy `wh360` objects

Instead, application code must query approved contract-backed views:
* `vw_consumption_*`
* `vw_genie_*`

## Consequences

* Contracts become the stable interface between data products and applications.
* Internal Gold models may change or be refactored without breaking application code.
* Application cutover must wait until governed views are live-validated in target environments.
* Legacy `wh360` access remains only as a temporary migration path during transition.
