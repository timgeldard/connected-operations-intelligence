#!/usr/bin/env python3
"""
One-shot helper: generates metadata YAML skeleton files for silver and gold base tables.

This script is run ONCE to produce the P0 skeletons under metadata/silver/ and
metadata/gold/. After that, the skeletons are hand-filled (backfill phase) and
maintained manually — this script is not part of CI.

Usage (from data-products/io-reporting/):
    python scripts/_gen_metadata_skeletons.py
"""
import pathlib
import re

# Map source file -> metadata YAML filename
SILVER_FILE_TO_YAML = {
    "process_order.py": "process_order.metadata.yml",
    "warehouse_fast.py": "warehouse_fast.metadata.yml",
    "warehouse_flow.py": "warehouse_flow.metadata.yml",
    "warehouse_reference.py": "warehouse_reference.metadata.yml",
    "inbound.py": "inbound.metadata.yml",
    "reference.py": "reference.metadata.yml",
    "quality.py": "quality.metadata.yml",
    "quality_lab.py": "quality_lab.metadata.yml",
    "traceability.py": "traceability.metadata.yml",
}

GOLD_FILE_TO_YAML = {
    "dlt_gold_pipeline.py": "dlt_gold_pipeline.metadata.yml",
    "freshness.py": "freshness.metadata.yml",
    "quality_lab.py": "quality_lab.metadata.yml",
    "readiness_validation.py": "readiness_validation.metadata.yml",
    "trace_gold.py": "trace_gold.metadata.yml",
    "warehouse_exceptions.py": "warehouse_exceptions.metadata.yml",
    "warehouse_flow_gold.py": "warehouse_flow_gold.metadata.yml",
    "warehouse_inbound_gold.py": "warehouse_inbound_gold.metadata.yml",
    "warehouse_kpi_snapshot.py": "warehouse_kpi_snapshot.metadata.yml",
    "warehouse_kpis.py": "warehouse_kpis.metadata.yml",
    "wm_operations_gold.py": "wm_operations_gold.metadata.yml",
    "spc_gold.py": "spc_gold.metadata.yml",
    "servicenow.py": "servicenow.metadata.yml",
}

EXCL_COLS = {"record_activity", "__START_AT", "__END_AT", "_storage_bin_occupancy_key"}

# Stage gate inventory tags (seeded from source-contracts/silver_stage_gate_inventory.yml)
SILVER_TAGS = {
    "goods_movement": {"product_area": "ioreporting", "gating_category": "A", "current_status": "ENFORCED", "source_tables": "inventorymovement_mseg,materialdocument_mkpf"},
    "batch_stock": {"product_area": "stock", "gating_category": "A", "current_status": "ENFORCED", "source_tables": "batchstock_mchb,materialmaster_mara"},
    "warehouse_transfer_order": {"product_area": "warehouse", "gating_category": "B", "current_status": "ENFORCED", "source_tables": "transferorderobjects_ltak,transferorderobjects_ltap"},
    "warehouse_transfer_order_header_delete": {"product_area": "warehouse", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "transferorderobjects_ltak"},
    "warehouse_transfer_requirement": {"product_area": "warehouse", "gating_category": "B", "current_status": "ENFORCED", "source_tables": "transferrequirementobjects_ltbk,transferrequirementobjects_ltbp"},
    "quality_inspection_lot": {"product_area": "trace_lot", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "inspection_qals"},
    "quality_inspection_usage_decision": {"product_area": "trace_lot", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "inspection_qave,inspection_qals"},
    "quality_inspection_characteristic": {"product_area": "spc", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "inspection_qamv,inspection_qals"},
    "quality_inspection_result": {"product_area": "spc", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "inspection_qamr,inspection_qals"},
    "quality_inspection_sample_result": {"product_area": "spc", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "inspection_qasr,inspection_qals"},
    "quality_inspection_individual_result": {"product_area": "spc", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "inspection_qase,inspection_qals"},
    "reservation_requirement": {"product_area": "ioreporting", "gating_category": "A", "current_status": "ENFORCED", "source_tables": "reservationrequirement_resb"},
    "outbound_delivery": {"product_area": "ioreporting", "gating_category": "A", "current_status": "ENFORCED", "source_tables": "deliveryobjects_likp,deliveryobjects_lips"},
    "outbound_delivery_header_delete": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "deliveryobjects_likp"},
    "purchase_order": {"product_area": "ioreporting", "gating_category": "A", "current_status": "ENFORCED", "source_tables": "procurementorderobject_ekko,procurementorderobject_ekpo"},
    "purchase_order_header_delete": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "procurementorderobject_ekko"},
    "handling_unit": {"product_area": "warehouse360", "gating_category": "A", "current_status": "ENFORCED", "source_tables": "handlingunit_vekp,handlingunit_vepo"},
    "physical_inventory_document": {"product_area": "stock", "gating_category": "A", "current_status": "ENFORCED", "source_tables": "header_physical_inventory_doc_ikpf,physical_inventory_doc_items_iseg"},
    "stock_at_location": {"product_area": "stock", "gating_category": "A", "current_status": "ENFORCED", "source_tables": "storagelocationmaterial_mard"},
    "process_order": {"product_area": "process_order", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "ordermaster_aufk,productionorderobject_afko,recipe_process_line"},
    "process_order_operation": {"product_area": "process_order", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "processorderobject_afvc,dbstructureoperationquantitydatevalues_afvv,productionorderobject_afko"},
    "pi_sheet_execution": {"product_area": "process_order", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "actualpistartenddatetime_zmanpex_e04_002"},
    "downtime_event": {"product_area": "process_order", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "downtime_zpexpm_dwnt"},
    "capacity_utilisation": {"product_area": "process_order", "gating_category": "A", "current_status": "NEEDS_MAPPING", "source_tables": "shiftparametersavailablecapacity_kapa,capacityheadersegment_kako"},
    "work_centre": {"product_area": "process_order", "gating_category": "A", "current_status": "ENFORCED", "source_tables": "workcenterheader_crhd,workcentertext_crtx"},
    "storage_bin": {"product_area": "warehouse", "gating_category": "B", "current_status": "ENFORCED", "source_tables": "storagebin_lagp,quant_lqua,warehouse_plant_mapping"},
    "storage_type": {"product_area": "warehouse", "gating_category": "B", "current_status": "NEEDS_MAPPING", "source_tables": "wm_storagetypes_t301,wm_storagetypesdescription_t301t"},
    "warehouse_plant_mapping": {"product_area": "warehouse", "gating_category": "A", "current_status": "NEEDS_MAPPING", "source_tables": "warehouseforplant_t320"},
    "warehouse_storage_location_mapping": {"product_area": "warehouse", "gating_category": "A", "current_status": "NEEDS_MAPPING", "source_tables": "warehouseforplant_t320"},
    "movement_type_classification": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "movementtype_t156,movementtypetext2_t156t"},
    "plant": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "plantcode_t001w"},
    "warehouse_master": {"product_area": "warehouse", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "warehousemaster_t300"},
    "customer": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "customermaster_kna1"},
    "material_valuation": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "materialvaluation_mbew"},
    "vendor": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "vendormaster_lfa1"},
    "recipe_process_line": {"product_area": "process_order", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "internalnumberobjectlink_inob,objectcharacteristics_ausp,characteristicvaluedescription_cawnt"},
    "material_uom_conversion": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "materialconversion_marm"},
    "storage_type_role_mapping": {"product_area": "warehouse", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "storage_role_config_seed"},
    "material": {"product_area": "ioreporting", "gating_category": "A", "current_status": "NEEDS_MAPPING", "source_tables": "materialmaster_mara,materialforplant_marc,materialdescription_makt"},
    "material_allergen": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "objectcharacteristics_ausp,characteristicvaluedescription_cawnt"},
    "batch_master": {"product_area": "stock", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "crossplantbatch_mch1"},
    "storage_location": {"product_area": "ioreporting", "gating_category": "A", "current_status": "NEEDS_MAPPING", "source_tables": "storagelocation_t001l"},
    "batch_where_used": {"product_area": "traceability", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "batchwhereusedlist_chvw"},
    "quality_lab_inspection_result": {"product_area": "spc", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "inspection_qamr,inspection_qals,inspection_qamv"},
    "quality_lab_characteristic_spec": {"product_area": "spc", "gating_category": "DIRECT_PLANT", "current_status": "ENFORCED", "source_tables": "inspection_qamv,inspection_qals"},
    "site_config_plant": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "site_config_plant_seed"},
    "site_config_warehouse": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "site_config_warehouse_seed"},
    "site_config_storage_type_role": {"product_area": "warehouse", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "site_config_storage_type_role_seed"},
    "site_config_movement_type_classification": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "site_config_movement_type_classification_seed"},
    "site_config_staging_method": {"product_area": "warehouse", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "site_config_staging_method_seed"},
    "site_config_kpi_enablement": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "site_config_kpi_enablement_seed"},
    "site_lifecycle": {"product_area": "ioreporting", "gating_category": "D", "current_status": "EXEMPT", "source_tables": "site_lifecycle_config_seed"},
}


def get_func_src(src_lines, func_name):
    start_idx = None
    pattern = re.compile(r'^\s*def\s+' + re.escape(func_name) + r'\s*\(')
    for i, line in enumerate(src_lines):
        if pattern.match(line):
            start_idx = i
            break
    if start_idx is None:
        return ''
    first_line = src_lines[start_idx]
    base_indent = len(first_line) - len(first_line.lstrip())
    func_lines = [first_line]
    for line in src_lines[start_idx + 1:]:
        stripped = line.strip()
        if not stripped:
            func_lines.append(line)
            continue
        curr_indent = len(line) - len(line.lstrip())
        if curr_indent <= base_indent and (
            stripped.startswith('def ')
            or stripped.startswith('class ')
            or stripped.startswith('@dlt.')
            or (stripped.startswith('if ') and curr_indent < base_indent + 4)
            or (stripped.startswith('# ──') and curr_indent <= base_indent)
        ):
            break
        func_lines.append(line)
    return '\n'.join(func_lines)


def get_output_cols(func_src):
    sel_positions = [m.start() for m in re.finditer(r'\.select\s*\(', func_src)]
    if not sel_positions:
        # No select block — fall back to all aliases (handles .groupBy().agg() patterns)
        block = func_src
    else:
        block = func_src[sel_positions[-1]:]
    aliases = re.findall(r'\.alias\s*\(\s*["\'](\w+)["\']\s*\)', block)
    return list(dict.fromkeys([a for a in aliases if not a.startswith('_') and a not in EXCL_COLS]))


def extract_comment_from_region(region):
    # Try multi-line comment=(...)
    m = re.search(r'comment\s*=\s*\(', region)
    if m:
        start = m.end()
        depth = 1
        i = start
        while i < len(region) and depth > 0:
            if region[i] == '(':
                depth += 1
            elif region[i] == ')':
                depth -= 1
            i += 1
        inner = region[start:i-1]
        parts = re.findall(r'"(.*?)"', inner, re.DOTALL)
        comment = ' '.join(p for p in parts if p.strip())
        return re.sub(r'\s+', ' ', comment).strip()
    # Single-string comment="..."
    m = re.search(r'comment\s*=\s*"(.*?)"(?:\s*,|\s*\))', region, re.DOTALL)
    if m:
        return re.sub(r'\s+', ' ', m.group(1)).strip()
    return ''


def find_dlt_tables(src, src_lines):
    """Find all @dlt.table -> def func patterns (handles @dlt.expect_* between them)."""
    results = []
    pos = 0
    while True:
        m = re.search(r'@dlt\.table\s*\(', src[pos:])
        if not m:
            break
        abs_pos = pos + m.start()
        # Find next 'def' after this @dlt.table (handles indented defs inside if-blocks)
        def_m = re.search(r'\n\s*def\s+(\w+)\s*\(', src[abs_pos:])
        if not def_m:
            break
        func_name = def_m.group(1)
        decorator_region = src[abs_pos:abs_pos + def_m.start()]
        name_m = re.search(r'\bname\s*=\s*["\'](\w+)["\']', decorator_region)
        table_name = name_m.group(1) if name_m else func_name
        comment = extract_comment_from_region(decorator_region)
        results.append((table_name, func_name, comment, abs_pos))
        pos = abs_pos + 1
    return results


def extract_silver_tables(filepath):
    src = filepath.read_text(encoding='utf-8')
    src_lines = src.split('\n')
    tables = {}

    # 1. Streaming tables (stg_ -> create_streaming_table + apply_changes)
    for m in re.finditer(r'dlt\.create_streaming_table\s*\(\s*name\s*=\s*["\'](\w+)["\']', src):
        table_name = m.group(1)
        if not re.search(r'apply_changes\w*\s*\(.*?target\s*=\s*["\']' + re.escape(table_name), src, re.DOTALL):
            continue
        # Also check for comment in create_streaming_table (some have it)
        create_region = src[m.start():m.start()+800]
        comment = extract_comment_from_region(create_region)
        func_src = get_func_src(src_lines, 'stg_' + table_name)
        cols = get_output_cols(func_src)
        tables[table_name] = {'cols': cols, 'comment': comment}

    # 2. Batch @dlt.table tables
    for table_name, func_name, comment, _pos in find_dlt_tables(src, src_lines):
        if func_name.startswith('stg_'):
            continue
        if table_name in tables:
            continue
        func_src = get_func_src(src_lines, func_name)
        cols = get_output_cols(func_src)
        tables[table_name] = {'cols': cols, 'comment': comment}

    return tables


def extract_gold_tables(filepath):
    src = filepath.read_text(encoding='utf-8')
    src_lines = src.split('\n')
    tables = {}

    for table_name, func_name, comment, _pos in find_dlt_tables(src, src_lines):
        if func_name.startswith('stg_') or table_name.endswith('_gate'):
            continue
        # Skip views (gold_freshness_gate etc.)
        if 'freshness_gate' in table_name:
            continue
        func_src = get_func_src(src_lines, func_name)
        cols = get_output_cols(func_src)
        tables[table_name] = {'cols': cols, 'comment': comment}

    return tables


def yaml_str(s):
    """Emit a YAML string value — quoted if it contains special chars."""
    if not s:
        return '""'
    # Check if needs quoting
    if any(c in s for c in ':{}[]|>&*!,%@`#') or s.startswith(('- ', '. ')):
        escaped = s.replace('"', '\\"').replace('\n', ' ')
        return f'"{escaped}"'
    # Check for long strings — use quoted form
    if len(s) > 100:
        escaped = s.replace('"', '\\"').replace('\n', ' ')
        return f'"{escaped}"'
    return s


def build_yaml(tables_dict, layer, tags_map):
    lines = [f"# UC metadata skeleton — {layer} base tables.", "# Generated by scripts/_gen_metadata_skeletons.py — populate comments in backfill phase.", "tables:"]

    for table_name in sorted(tables_dict.keys()):
        info = tables_dict[table_name]
        comment = info.get('comment', '')
        cols = info.get('cols', [])
        tags = tags_map.get(table_name, {})
        if not tags:
            tags = {"product_area": layer, "layer": layer}
        else:
            tags = dict(tags)
        tags["layer"] = layer

        lines.append(f"  - name: {table_name}")
        if comment:
            comment_clean = re.sub(r'\s+', ' ', comment).strip()
            lines.append(f"    comment: {yaml_str(comment_clean)}")
        else:
            lines.append("    comment: \"\"")

        lines.append("    tags:")
        for k, v in sorted(tags.items()):
            lines.append(f"      {k}: {yaml_str(str(v))}")

        if cols:
            lines.append("    columns:")
            for col in cols:
                lines.append(f"      - {{name: {col}, comment: \"\"}}")
        else:
            lines.append("    columns: []")
        lines.append("")

    return '\n'.join(lines) + '\n'


def main():
    base_dir = pathlib.Path(__file__).resolve().parent.parent
    silver_dir = base_dir / "silver" / "tables"
    gold_dir = base_dir / "gold"
    meta_silver = base_dir / "metadata" / "silver"
    meta_gold = base_dir / "metadata" / "gold"
    meta_silver.mkdir(parents=True, exist_ok=True)
    meta_gold.mkdir(parents=True, exist_ok=True)

    # Generate silver
    silver_yaml_map = {}  # yaml_filename -> {table_name: info}
    for src_file, yaml_name in SILVER_FILE_TO_YAML.items():
        filepath = silver_dir / src_file
        if not filepath.exists():
            print(f"  SKIP (not found): {filepath}")
            continue
        tables = extract_silver_tables(filepath)
        silver_yaml_map[yaml_name] = tables
        print(f"  Silver {src_file}: {list(tables.keys())}")

    for yaml_name, tables in silver_yaml_map.items():
        if not tables:
            continue
        yaml_content = build_yaml(tables, "silver", SILVER_TAGS)
        out_path = meta_silver / yaml_name
        out_path.write_text(yaml_content, encoding='utf-8')
        print(f"  Written: {out_path} ({len(tables)} tables)")

    # Generate gold
    for src_file, yaml_name in GOLD_FILE_TO_YAML.items():
        filepath = gold_dir / src_file
        if not filepath.exists():
            print(f"  SKIP gold (not found): {filepath}")
            continue
        tables = extract_gold_tables(filepath)
        if not tables:
            print(f"  SKIP gold (no tables): {src_file}")
            continue
        gold_tags = {name: {"product_area": _derive_gold_product_area(name), "layer": "gold"} for name in tables}
        yaml_content = build_yaml(tables, "gold", gold_tags)
        out_path = meta_gold / yaml_name
        out_path.write_text(yaml_content, encoding='utf-8')
        print(f"  Written: {out_path} ({len(tables)} tables)")

    print("Done.")


def _derive_gold_product_area(table_name):
    n = table_name
    if 'spc' in n or 'qm_' in n or 'quality' in n:
        return 'spc'
    if 'trace' in n:
        return 'traceability'
    if 'warehouse' in n or 'wm_' in n or 'dispensary' in n or 'lineside' in n or 'bin' in n or 'transfer' in n or 'inbound' in n or 'delivery' in n or 'stock' in n or 'pi_accuracy' in n:
        return 'warehouse'
    if 'process_order' in n or 'order_downtime' in n or 'plant_production' in n or 'shift_output' in n or 'downtime' in n:
        return 'process_order'
    if 'readiness' in n or 'freshness' in n or 'health' in n or 'validation' in n or 'coverage' in n or 'safety_status' in n or 'data_product' in n:
        return 'ioreporting'
    return 'ioreporting'


if __name__ == '__main__':
    main()
