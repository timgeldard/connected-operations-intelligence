"""Plant/site stage-gate helpers for Bronze -> Silver.

Bronze stays raw and unfiltered. All operational Bronze -> Silver processing is scoped to the
plants / warehouses approved by the governed site stage-gate config before data enters Silver.
Gold and serving views inherit Silver scope; user security is a separate concern and does NOT
replace this plant gate.

Source of truth:
  * Plant onboarding (which plants are active): the governed `site_config_plant` table (built by the slow
    tier from the seeded config; see reference.py), read via the `site_config_plant_table` Spark conf.
  * Plant↔warehouse relationship (LGNUM→WERKS): the SAP T320 link, already replicated to silver as
    `warehouse_storage_location_mapping`, read via the `warehouse_sloc_mapping_table` Spark conf. The
    warehouse mapping is NOT a hand-maintained seed — it is derived from SAP so it cannot drift (a prior
    seed mis-mapped C061 to warehouse 208, which is actually P817's).
These confs are set to `${var.catalog}.${var.schema}.<table>` on every pipeline that applies a gate
(see resources/*.pipeline.yml). The slow pipeline must build `site_config_plant` and
`warehouse_storage_location_mapping` BEFORE a fast-tier gate reads them.

Design rules (see source-contracts/site_stage_gate_contract.md):
  * Do NOT filter Bronze. Gates apply at the Silver transform only.
  * Do NOT hard-code plant lists. The active set comes from the config.
  * Do NOT assume LGNUM = WERKS. Warehouse-keyed flows are gated via the site_config_warehouse
    mapping (warehouse_number -> plant_code) and enriched with a governed `plant_id`, kept DISTINCT
    from any raw WERKS the source carries.
  * FAIL-LOUD, never silent. The config is read UNCONDITIONALLY (no relation_exists guard) — exactly
    like recipe_process_line — because a guard would bake an empty-gate fallback into a CONTINUOUS
    pipeline's plan for the life of the update. A missing config table raises at startup. An EMPTY
    active set (table present, 0 active plants) is a misconfiguration that produces empty operational
    output; that is NOT silent — silver_stage_gate_validation.sql asserts active_plants_in_gate > 0 and
    reports before/after row counts, so any drop-all is loud in validation evidence.
  * DEPLOY ORDER: the slow pipeline must build site_config_* BEFORE the continuous fast pipeline
    starts (same dependency as recipe_process_line). On first deploy, run slow once, then start fast.

Product-area gate semantics (DERIVED from the existing site_config_plant flags; no schema change):
  active_for_ioreporting    := is_active AND go_live_status NOT IN (blocked statuses)
  active_for_warehouse360   := <ioreporting> AND wm_enabled_flag
  active_for_stock          := <ioreporting> AND batch_managed_flag
  active_for_quality        := <ioreporting> AND qm_enabled_flag
  active_for_process_order  := <ioreporting> AND process_manufacturing_flag
technical_validated / business_validated are NOT yet first-class columns on the config (closest signal
is the deployment_mode shakedown-vs-full_validation flag + last_validated_at). They are documented in
the contract as a Phase-2 schema addition and are NOT silently assumed true here.
"""
from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from silver.helpers import get_spark

# go_live_status values that exclude a plant even when is_active (defensive; extend via the contract).
_BLOCKED_GO_LIVE_STATUSES = ["BLOCKED", "DECOMMISSIONED", "SUSPENDED"]

# product_area -> the site_config_plant boolean flag that additionally includes a plant for that area.
# None = base ioreporting gate (is_active + go_live_status only).
_PRODUCT_AREA_FLAG = {
    None: None,
    "ioreporting": None,
    "warehouse360": "wm_enabled_flag",
    "warehouse": "wm_enabled_flag",
    "stock": "batch_managed_flag",
    "quality": "qm_enabled_flag",
    "process_order": "process_manufacturing_flag",
}


def _require_conf(spark, key: str) -> str:
    value = spark.conf.get(key, None)
    if not value:
        raise ValueError(
            f"{key} configuration must be set for the plant stage-gate "
            f"(see resources/*.pipeline.yml and source-contracts/site_stage_gate_contract.md)."
        )
    return value


def active_plants_df(spark=None, product_area=None) -> DataFrame:
    """Distinct active `plant_code` set from the governed site_config_plant gate, for a product area.

    Read UNCONDITIONALLY (fail-loud): a missing site_config_plant table raises (slow pipeline must build
    it first). Returns one column: `plant_code`.
    """
    spark = spark or get_spark()
    if product_area not in _PRODUCT_AREA_FLAG:
        raise ValueError(
            f"Unknown product_area '{product_area}'. Allowed: {sorted(k for k in _PRODUCT_AREA_FLAG if k)}"
        )
    cfg = _require_conf(spark, "site_config_plant_table")
    df = spark.read.table(cfg)
    df = df.filter(
        F.col("is_active") & (~F.col("go_live_status").isin(_BLOCKED_GO_LIVE_STATUSES))
    )
    flag = _PRODUCT_AREA_FLAG.get(product_area)
    if flag:
        df = df.filter(F.col(flag))
    return df.select(F.col("plant_code")).distinct()


def active_warehouses_df(spark=None, product_area="warehouse") -> DataFrame:
    """The governed LGNUM -> WERKS mapping for active plants, sourced from the SAP plant↔warehouse
    relationship (T320 → `warehouse_storage_location_mapping`), restricted to plants active for
    `product_area`. Fail-loud read.

    The relationship is DEFINED by the warehouse+storage-location→plant link in SAP T320 (the authoritative
    source already replicated into silver as `warehouse_storage_location_mapping`), NOT a hand-maintained
    seed. This prevents the LGNUM↔WERKS drift that a hardcoded seed allowed (e.g. C061 mis-mapped to 208,
    P817's warehouse). Warehouse numbers are distinct per plant (C061→104, P817→208), so each warehouse
    resolves to exactly one plant.

    Defensive de-dup: should a warehouse genuinely map to multiple active plants, we still resolve a SINGLE
    governing plant (lexicographically-smallest plant_code) to avoid fact-row fan-out on the warehouse join.
    Splitting a genuinely shared warehouse across plants remains a deeper modelling decision, tracked
    separately."""
    spark = spark or get_spark()
    cfg = _require_conf(spark, "warehouse_sloc_mapping_table")
    mapping = spark.read.table(cfg).select("warehouse_number", "plant_code").distinct()
    plants = active_plants_df(spark, product_area)
    mapped = mapping.join(plants, "plant_code", "inner").select("warehouse_number", "plant_code")
    one_per_wh = Window.partitionBy("warehouse_number").orderBy(F.col("plant_code"))
    return (
        mapped.withColumn("_rn", F.row_number().over(one_per_wh))
        .filter(F.col("_rn") == 1)
        .select("warehouse_number", "plant_code")
    )


def apply_plant_gate(df: DataFrame, plant_col: str, product_area=None, spark=None) -> DataFrame:
    """Keep only rows whose `plant_col` is an active plant for `product_area`. INNER join against the
    DISTINCT active-plant set (broadcast), then drop the helper column — semantically a semi-join (the
    gate set is distinct on plant_code, so no row fan-out) but using INNER, the well-supported
    stream-static join type (same as apply_warehouse_gate). Avoids relying on left-semi stream-static
    support. Adds no business columns. Drops nothing silently — see module docstring +
    silver_stage_gate_validation.sql."""
    spark = spark or get_spark()
    plants = active_plants_df(spark, product_area).select(
        F.col("plant_code").alias("_gate_plant_code")
    )
    return df.join(
        F.broadcast(plants), df[plant_col] == F.col("_gate_plant_code"), "inner"
    ).drop("_gate_plant_code")


def apply_warehouse_gate(
    df: DataFrame,
    warehouse_col: str,
    product_area="warehouse",
    add_plant_col: str | None = "plant_id",
    spark=None,
) -> DataFrame:
    """Keep only rows whose `warehouse_col` is an active warehouse, AND enrich with the governed
    `plant_id` from the site_config_warehouse mapping (do NOT assume LGNUM = WERKS — this is the
    config-approved plant, kept distinct from any raw WERKS the source carries). Inner join =
    filter + enrich. The mapping is 1:1 per warehouse (active_warehouses_df resolves one governing
    plant per warehouse), so this join does NOT fan out fact rows. Broadcasts the tiny mapping."""
    spark = spark or get_spark()
    whs = active_warehouses_df(spark, product_area).select(
        F.col("warehouse_number").alias("_gate_warehouse"),
        F.col("plant_code").alias("_gate_plant_id"),
    )
    out = df.join(
        F.broadcast(whs), df[warehouse_col] == F.col("_gate_warehouse"), "inner"
    )
    if add_plant_col:
        out = out.withColumn(add_plant_col, F.col("_gate_plant_id"))
    return out.drop("_gate_warehouse", "_gate_plant_id")
