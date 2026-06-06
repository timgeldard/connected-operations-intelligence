# App DEV Profile

This template captures future DEV validation evidence for an app governed-contract migration. It is not evidence that validation has been run.

## Scope

| Field | Value |
|---|---|
| App |  |
| Registry status before execution |  |
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
| App approved for candidate scaffold in registry | Not run / Pass / Fail |  |
| Route-to-contract inventory completed | Not run / Pass / Fail |  |
| Candidate source views reviewed | Not run / Pass / Fail |  |
| No blocking assumptions remain | Not run / Pass / Fail |  |

## Source Object Checks

Expected result: every required source object is present in the target DEV schema.

```text
Paste source object validation output here.
```

## Source Column Checks

Expected result: every adapter-selected and contract-required column is present or has an accepted documented exception.

```text
Paste source column validation output here.
```

## Candidate View Checks

Expected result: candidate views compile in DEV. This does not authorize UAT migration.

```text
Paste view compile output here.
```

## Contract Compatibility Checks

| Candidate contract | Source view | Required fields present | Type issues | Decision |
|---|---|---|---|---|
|  |  |  |  |  |

## Grain And Key Checks

| Candidate contract | Candidate key | Duplicate count | Null key count | Decision |
|---|---|---|---|---|
|  |  |  |  |  |

## Security And Entitlement Checks

| Candidate contract | Row-level key | Null count | Entitlement path checked | Decision |
|---|---|---|---|---|
|  |  |  |  |  |

## App Smoke Test

| Route | Expected contract_id | HTTP status | Row count | Decision |
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

Do not recommend UAT planning unless source, schema, key, security, and smoke-test gates have passed or have explicitly accepted exceptions.
