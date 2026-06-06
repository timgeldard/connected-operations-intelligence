# App Contract Migration Evidence

This folder is reserved for future Databricks-connected validation evidence. It is not populated by offline planning work and does not imply that validation has run.

Use this structure for app validation evidence:

```text
data-products/io-reporting/evidence/
  <app>/
    dev/
      README.md or execution notes
      source_object_check.*
      source_column_check.*
      view_compile_check.*
      key_validation.*
      security_validation.*
      app_smoke_test.*
      validation_summary.md
```

Evidence files should include:

- Git branch and commit SHA used for execution.
- Databricks catalog and schema.
- Execution timestamp and executor.
- Raw result output where practical.
- Blocking issues and accepted exceptions.

Do not claim DEV, UAT, or production validation in docs unless the corresponding evidence is present and accepted.
