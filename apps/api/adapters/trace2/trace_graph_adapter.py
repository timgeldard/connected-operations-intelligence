"""Trace graph specs + mappers (recursive graph queries).

Covers:
  - get_trace_graph_recursive_spec (Slice 2)
  - map_trace_graph
"""
from __future__ import annotations

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

from ._types import TraceGraphRequest
from ._utils import (
    _delivery_child_key,
    _make_delivery_node,
    _make_graph_edge,
    _make_graph_node,
    _node_key,
)

# ---------------------------------------------------------------------------
# Slice 2 — getTraceGraph (single WITH RECURSIVE query)
# ---------------------------------------------------------------------------

def get_trace_graph_recursive_spec(request: TraceGraphRequest) -> QuerySpec:
    """QuerySpec for trace graph — single WITH RECURSIVE server-side traversal.

    Anchor matched on material_id + batch_id only (no plant_id filter).
    Returns hop_depth (1-based) and traversal_dir per edge row; the route converts
    hop_depth to 0-based when building tagged_rows for map_trace_graph.

    Cycle detection: path column tracks visited 2-tuple keys (material_id:batch_id).
    Recursive join uses plant_id for correct edge resolution; cycle guard uses 2-tuple.

    gold_material is LEFT JOINed on the outer SELECT only (not inside the recursive CTE)
    to populate parent_material_name / child_material_name on every edge row.

    No ue dedup CTE: gold_batch_lineage is clustered on (CHILD_MATERIAL_ID, CHILD_BATCH_ID).
    Querying the table directly lets Databricks skip 99% of files per hop. A preceding
    SELECT DISTINCT over the full table caused cold-run 504s on a 479M-row table.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_lineage")
    tbl_material = resolve_domain_object("trace2", "gold_material")

    # gold_batch_lineage is clustered on (CHILD_MATERIAL_ID, CHILD_BATCH_ID).
    # Referencing the table directly in each recursive arm lets Databricks use
    # file-skipping per hop. A preceding ue CTE (SELECT DISTINCT over the full
    # table) materialised 479M rows before any recursion, causing a cold-run
    # full table scan that reliably exceeded the 30s gateway timeout.
    _null_guard = (
        "PARENT_MATERIAL_ID IS NOT NULL AND PARENT_BATCH_ID IS NOT NULL"
        " AND CHILD_MATERIAL_ID IS NOT NULL AND CHILD_BATCH_ID IS NOT NULL"
    )

    # Downstream CTE: anchor is PARENT, recurse following CHILD edges forward.
    # Anchor null guard requires only PARENT fields — CHILD may be NULL for
    # customer delivery edges (LINK_TYPE='DELIVERY') which are terminal leaf
    # nodes (no downstream batch to recurse from). The JOIN condition in the
    # recursive arm filters these out naturally (NULL = anything is never true).
    ds_cte = f"""\
  ds AS (
    SELECT
      1 AS hop_depth, 'downstream' AS traversal_dir,
      PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID,
      CHILD_MATERIAL_ID, CHILD_BATCH_ID, CHILD_PLANT_ID,
      LINK_TYPE, PROCESS_ORDER_ID, MATERIAL_DOCUMENT_NUMBER,
      PURCHASE_ORDER_ID, SUPPLIER_ID, CUSTOMER_ID, DELIVERY_ID,
      SALES_ORDER_ID, QUANTITY, BASE_UNIT_OF_MEASURE, POSTING_DATE, MOVEMENT_TYPE,
      CONCAT('|', :material_id, ':', :batch_id, '|',
             CHILD_MATERIAL_ID, ':', CHILD_BATCH_ID, ':', COALESCE(CHILD_PLANT_ID, ''), '|') AS path
    FROM {tbl}
    WHERE PARENT_MATERIAL_ID = :material_id AND PARENT_BATCH_ID = :batch_id
      AND PARENT_MATERIAL_ID IS NOT NULL AND PARENT_BATCH_ID IS NOT NULL
    UNION ALL
    SELECT
      t.hop_depth + 1, 'downstream',
      e.PARENT_MATERIAL_ID, e.PARENT_BATCH_ID, e.PARENT_PLANT_ID,
      e.CHILD_MATERIAL_ID, e.CHILD_BATCH_ID, e.CHILD_PLANT_ID,
      e.LINK_TYPE, e.PROCESS_ORDER_ID, e.MATERIAL_DOCUMENT_NUMBER,
      e.PURCHASE_ORDER_ID, e.SUPPLIER_ID, e.CUSTOMER_ID, e.DELIVERY_ID,
      e.SALES_ORDER_ID, e.QUANTITY, e.BASE_UNIT_OF_MEASURE, e.POSTING_DATE, e.MOVEMENT_TYPE,
      CONCAT(t.path, e.CHILD_MATERIAL_ID, ':', e.CHILD_BATCH_ID, ':', COALESCE(e.CHILD_PLANT_ID, ''), '|')
    FROM {tbl} e
    JOIN `ds` t
      ON e.PARENT_MATERIAL_ID = t.CHILD_MATERIAL_ID
      AND e.PARENT_BATCH_ID = t.CHILD_BATCH_ID
      AND e.PARENT_PLANT_ID <=> t.CHILD_PLANT_ID
    WHERE t.hop_depth < :max_depth
      AND t.CHILD_MATERIAL_ID IS NOT NULL AND t.CHILD_BATCH_ID IS NOT NULL
      AND (e.CHILD_MATERIAL_ID IS NULL
           OR INSTR(t.path, CONCAT('|', e.CHILD_MATERIAL_ID, ':', e.CHILD_BATCH_ID, ':', COALESCE(e.CHILD_PLANT_ID, ''), '|')) = 0)
  )"""

    # Upstream CTE: anchor is CHILD, recurse following PARENT edges backward
    us_cte = f"""\
  us AS (
    SELECT
      1 AS hop_depth, 'upstream' AS traversal_dir,
      PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID,
      CHILD_MATERIAL_ID, CHILD_BATCH_ID, CHILD_PLANT_ID,
      LINK_TYPE, PROCESS_ORDER_ID, MATERIAL_DOCUMENT_NUMBER,
      PURCHASE_ORDER_ID, SUPPLIER_ID, CUSTOMER_ID, DELIVERY_ID,
      SALES_ORDER_ID, QUANTITY, BASE_UNIT_OF_MEASURE, POSTING_DATE, MOVEMENT_TYPE,
      CONCAT('|', :material_id, ':', :batch_id, '|',
             PARENT_MATERIAL_ID, ':', PARENT_BATCH_ID, ':', COALESCE(PARENT_PLANT_ID, ''), '|') AS path
    FROM {tbl}
    WHERE CHILD_MATERIAL_ID = :material_id AND CHILD_BATCH_ID = :batch_id
      AND {_null_guard}
    UNION ALL
    SELECT
      t.hop_depth + 1, 'upstream',
      e.PARENT_MATERIAL_ID, e.PARENT_BATCH_ID, e.PARENT_PLANT_ID,
      e.CHILD_MATERIAL_ID, e.CHILD_BATCH_ID, e.CHILD_PLANT_ID,
      e.LINK_TYPE, e.PROCESS_ORDER_ID, e.MATERIAL_DOCUMENT_NUMBER,
      e.PURCHASE_ORDER_ID, e.SUPPLIER_ID, e.CUSTOMER_ID, e.DELIVERY_ID,
      e.SALES_ORDER_ID, e.QUANTITY, e.BASE_UNIT_OF_MEASURE, e.POSTING_DATE, e.MOVEMENT_TYPE,
      CONCAT(t.path, e.PARENT_MATERIAL_ID, ':', e.PARENT_BATCH_ID, ':', COALESCE(e.PARENT_PLANT_ID, ''), '|')
    FROM {tbl} e
    JOIN `us` t
      ON e.CHILD_MATERIAL_ID = t.PARENT_MATERIAL_ID
      AND e.CHILD_BATCH_ID = t.PARENT_BATCH_ID
      AND e.CHILD_PLANT_ID <=> t.PARENT_PLANT_ID
    WHERE t.hop_depth < :max_depth
      AND e.PARENT_MATERIAL_ID IS NOT NULL AND e.PARENT_BATCH_ID IS NOT NULL
      AND INSTR(t.path, CONCAT('|', e.PARENT_MATERIAL_ID, ':', e.PARENT_BATCH_ID, ':', COALESCE(e.PARENT_PLANT_ID, ''), '|')) = 0
  )"""

    # gold_material also has BASE_UNIT_OF_MEASURE, so selecting m_parent/m_child columns
    # alongside unqualified CTE columns causes an AMBIGUOUS_REFERENCE error in Databricks SQL.
    # Fix: wrap each CTE arm in a subquery (_lin) so its columns are all unambiguous, then
    # LEFT JOIN gold_material on the outer query and select _lin.* plus the two name columns.
    select_cols = """\
    hop_depth, traversal_dir,
    PARENT_MATERIAL_ID AS parent_material_id, PARENT_BATCH_ID AS parent_batch_id, PARENT_PLANT_ID AS parent_plant_id,
    CHILD_MATERIAL_ID AS child_material_id, CHILD_BATCH_ID AS child_batch_id, CHILD_PLANT_ID AS child_plant_id,
    LINK_TYPE AS link_type, PROCESS_ORDER_ID AS process_order_id, MATERIAL_DOCUMENT_NUMBER AS material_document_number,
    PURCHASE_ORDER_ID AS purchase_order_id, SUPPLIER_ID AS supplier_id, CUSTOMER_ID AS customer_id,
    DELIVERY_ID AS delivery_id, SALES_ORDER_ID AS sales_order_id, QUANTITY AS quantity,
    BASE_UNIT_OF_MEASURE AS base_unit_of_measure, POSTING_DATE AS posting_date, MOVEMENT_TYPE AS movement_type"""

    mat_select = "    m_parent.MATERIAL_NAME AS parent_material_name, m_child.MATERIAL_NAME AS child_material_name"
    # :language_id is a QuerySpec param (default 'E') so callers can override for non-English
    # environments without touching SQL. Verified live: connected_plant_uat uses 'E', not 'EN'.
    mat_joins = (
        f"LEFT JOIN {tbl_material} m_parent"
        f" ON _lin.parent_material_id = m_parent.MATERIAL_ID AND m_parent.LANGUAGE_ID = :language_id\n"
        f"LEFT JOIN {tbl_material} m_child"
        f" ON _lin.child_material_id = m_child.MATERIAL_ID AND m_child.LANGUAGE_ID = :language_id"
    )

    # P0-4: LIMIT is applied inside the _lin subquery so rows are capped before
    # gold_material JOIN executes — avoids enriching rows that will be discarded.
    # The Python loop in the route applies a second max_edges check on distinct
    # edge keys; both limits work together.
    # For UNION ALL (direction="both"), LIMIT wraps the whole union so it caps
    # the combined result, not each arm individually.
    if request.direction == "downstream":
        sql = (
            f"WITH RECURSIVE\n{ds_cte}\n"
            f"SELECT _lin.*,\n{mat_select}\n"
            f"FROM (SELECT DISTINCT\n{select_cols}\nFROM ds\nORDER BY hop_depth ASC\nLIMIT :max_rows) AS _lin\n"
            f"{mat_joins}"
        )
    elif request.direction == "upstream":
        sql = (
            f"WITH RECURSIVE\n{us_cte}\n"
            f"SELECT _lin.*,\n{mat_select}\n"
            f"FROM (SELECT DISTINCT\n{select_cols}\nFROM us\nORDER BY hop_depth ASC\nLIMIT :max_rows) AS _lin\n"
            f"{mat_joins}"
        )
    else:  # both — two independent recursive CTEs in one WITH RECURSIVE block
        # NOTE: direction="both" is never called from the route — the route splits
        # "both" into two parallel single-direction queries to avoid Databricks'
        # RECURSION_ROW_LIMIT_EXCEEDED (1M intermediate-row cap). A combined
        # UNION ALL query cannot carry per-arm LIMITs (parse error), so the route
        # handles the split. This branch is retained for direct adapter use only.
        sql = (
            f"WITH RECURSIVE\n{ds_cte},\n{us_cte}\n"
            f"SELECT _lin.*,\n{mat_select}\n"
            f"FROM (\n"
            f"SELECT * FROM (\n"
            f"SELECT DISTINCT\n{select_cols}\nFROM ds\n"
            f"UNION ALL\n"
            f"SELECT DISTINCT\n{select_cols}\nFROM us\n"
            f") AS _combined\nLIMIT :max_rows\n"
            f") AS _lin\n"
            f"{mat_joins}"
        )

    return QuerySpec(
        name="trace2.get_trace_graph",
        module="trace2",
        endpoint="/api/trace2/trace-graph",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_depth": request.max_depth,
            "max_rows": request.max_edges,
            "language_id": "E",
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage",
        tags=["trace2", "trace-graph", "lineage"],
    )


def map_trace_graph(
    tagged_rows: list[tuple[dict, int, str]],
    request: TraceGraphRequest,
    depth_reached: int,
    truncated: bool,
) -> dict:
    """Map iterative traversal results to the q.txt trace graph response shape.

    tagged_rows: list of (row_dict, hop_index, direction_str) produced by the route loop.
    Anchor node is always included even when tagged_rows is empty.
    Nodes and edges are deduped by key; leading zeros preserved (no numeric casting).
    """
    anchor_key = _node_key(request.material_id, request.batch_id, request.plant_id)

    nodes: dict[str, dict] = {
        anchor_key: {
            "id": anchor_key,
            "materialId": request.material_id,
            "materialDescription": "",  # Anchor description often unknown without extra hop
            "batchId": request.batch_id,
            "plantId": request.plant_id,
            "depth": 0,
            "directions": ["anchor"],
            "isAnchor": True,
        }
    }
    edges: dict[str, dict] = {}
    warnings: list[str] = []

    for row, hop, direction in tagged_rows:
        parent_key = _node_key(row["parent_material_id"], row["parent_batch_id"], row.get("parent_plant_id"))
        is_delivery = not row.get("child_material_id") or not row.get("child_batch_id")
        child_key = _delivery_child_key(row) if is_delivery else _node_key(row["child_material_id"], row["child_batch_id"], row.get("child_plant_id"))

        # Assign depth: for downstream the parent was found at hop, child is one step further.
        # For upstream the child was found at hop, parent is one step further.
        if direction == "downstream":
            parent_depth, child_depth = hop, hop + 1
        else:
            parent_depth, child_depth = hop + 1, hop

        if parent_key not in nodes:
            nodes[parent_key] = _make_graph_node(row, "parent", parent_depth, direction)
        else:
            if direction not in nodes[parent_key]["directions"]:
                nodes[parent_key]["directions"].append(direction)
            if not nodes[parent_key].get("materialDescription"):
                nodes[parent_key]["materialDescription"] = row.get("parent_material_name") or ""

        if child_key not in nodes:
            if is_delivery:
                nodes[child_key] = _make_delivery_node(row, child_depth)
            else:
                nodes[child_key] = _make_graph_node(row, "child", child_depth, direction)
        else:
            if direction not in nodes[child_key]["directions"]:
                nodes[child_key]["directions"].append(direction)
            if not is_delivery and not nodes[child_key].get("materialDescription"):
                nodes[child_key]["materialDescription"] = row.get("child_material_name") or ""

        link_type = row.get("link_type") or ""
        doc_num = row.get("material_document_number") or ""
        edge_key = f"{parent_key}|{child_key}|{link_type}|{doc_num}|{hop}"
        if parent_key != child_key and edge_key not in edges:
            edges[edge_key] = _make_graph_edge(
                row, parent_key, child_key, edge_key, hop, direction
            )

    if not tagged_rows:
        warnings.append("no_edges_found")
    if truncated:
        warnings.append("max_edges_reached")
    if depth_reached >= request.max_depth and tagged_rows:
        warnings.append("max_depth_reached")

    upstream_count = sum(1 for n in nodes.values() if "upstream" in n["directions"])
    downstream_count = sum(1 for n in nodes.values() if "downstream" in n["directions"])
    unresolved_count = sum(1 for n in nodes.values() if n.get("status") == "unresolved")

    return {
        "nodes": list(nodes.values()),
        "edges": list(edges.values()),
        "direction": request.direction,
        "depth": depth_reached,
        "rootBatch": f"{request.material_id}/{request.batch_id}",
        "upstreamCount": upstream_count,
        "downstreamCount": downstream_count,
        "unresolvedNodeCount": unresolved_count,
        "warnings": warnings,
        "truncated": truncated,
    }
