# ADR-0003: Validate in DEV before UAT

## Status

Accepted.

## Context

Gold compilation and serving-view deployment issues should be caught during technical checks in the DEV environment, rather than being discovered first in UAT.

DEV is used for technical shakedown, while UAT is dedicated to business validation.

## Decision

The migration validation sequence must be strictly followed:
1. Validate that DEV Gold compiles and runs.
2. Verify that DEV secured, live, and consumption views create successfully.
3. Verify that DEV contract validation SQL passes all technical checks.
4. Execute UAT deployment and view creation.
5. Execute UAT contract and parity validation.
6. Verify entitlement and RLS rules.
7. Execute UAT application cutover to governed mode.

## Consequences

* UAT environment stability is protected from basic technical compilation and schema graph failures.
* DEV evidence is recognized as technical only.
* DEV success does not imply UAT readiness.
* Application runtime cutover must wait until both UAT validation and entitlement checks pass.
