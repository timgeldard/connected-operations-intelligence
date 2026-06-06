# App DEV Profile Evidence Template

This template is for future app contract validation evidence returned by a Databricks-connected executor. It is not evidence that validation has been run.

## App And Scope

| Field | Value |
|---|---|
| App |  |
| Route group |  |
| Target catalog |  |
| Target schema |  |
| Git branch |  |
| Git commit SHA |  |
| Executed by |  |
| Execution date/time |  |

## Preconditions

| Gate | Status | Notes |
|---|---|---|
| Warehouse360 DEV validation evidence accepted | Not run / Pass / Fail / N/A |  |
| Route-to-contract inventory completed | Not run / Pass / Fail |  |
| Candidate contract IDs agreed | Not run / Pass / Fail |  |
| Candidate source views agreed | Not run / Pass / Fail |  |

## Source Object Validation

Expected result: every required source object is found.

```text
Paste source object validation output here.
```

## Source Column Validation

Expected result: every adapter-selected and contract-required column is found or has an accepted documented exception.

```text
Paste source column validation output here.
```

## Candidate View Deployment

Expected result: candidate app-facing views compile in DEV. Do not deploy or validate UAT views in this step.

```text
Paste deployment output or errors here.
```

## Schema Compatibility

```text
Paste information_schema column/type output here.
```

## Grain And Key Validation

| Candidate contract | Candidate key | Duplicate count | Decision |
|---|---|---|---|
|  |  |  |  |

```text
Paste duplicate samples for any failing key here.
```

## Required-Key And Security Validation

| Candidate contract | Row-level key | Null count | Decision |
|---|---|---|---|
|  |  |  |  |

```text
Paste row-level key and entitlement findings here.
```

## Freshness And Date Typing

| Candidate contract | Freshness column | Latest value | Age | Date/time type findings |
|---|---|---|---|---|
|  |  |  |  |  |

## App Smoke Test

| Route | Expected contract_id | HTTP status | Row count | Notes |
|---|---|---|---|---|
|  |  |  |  |  |

## Blocking Issues

| Issue | Severity | Owner | Resolution required |
|---|---|---|---|
|  |  |  |  |

## Recommendation

```text
Do not migrate / Ready for limited DEV app test / Ready for UAT planning
```

Do not recommend UAT planning unless all blocking source, schema, key, security, and smoke-test gates are passed or explicitly accepted by an owner.
