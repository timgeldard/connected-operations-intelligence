#!/usr/bin/env python3
"""Generate data_dictionary.md from schema_documentation.md."""

import re

INPUT_FILE = "schema_documentation.md"
OUTPUT_FILE = "data_dictionary.md"

# SAP table → module mapping
SAP_MODULE_MAP = {
    # FI - Financial Accounting
    "BKPF": "FI", "BSEG": "FI", "FAGLFLEXA": "FI", "FAGLFLEXT": "FI",
    "SKA1": "FI", "SKB1": "FI", "SKAT": "FI", "T001": "FI",
    "RBKP": "FI", "RSEG": "FI", "OPTVIM_1HEAD": "FI", "OPTVIM_PO_WIH": "FI",
    "OPTVIM": "FI", "FDM_DCOBJ": "FI", "UDMCASEATTR00": "FI",
    "UKMBP_CMS_SGM": "FI", "UKMCRED_SGM0C": "FI",
    # CO - Controlling
    "CSKS": "CO", "CSKA": "CO", "CSKB": "CO", "CEPC": "CO", "CEPCT": "CO",
    "COOI": "CO", "PRPS": "CO", "ONRKS": "CO",
    # MM - Material Master / Inventory
    "MARA": "MM", "MARC": "MM", "MARD": "MM", "MAKT": "MM", "MARM": "MM",
    "MBEW": "MM", "MBEWH": "MM", "MLGN": "MM", "MLGT": "MM", "MVKE": "MM",
    "MKAL": "MM", "MLAN": "MM", "MCHB": "MM", "MCH1": "MM", "MCHA": "MM",
    "CHVW": "MM", "MKPF": "MM", "MSEG": "MM", "RESB": "MM",
    "IKPF": "MM", "ISEG": "MM", "MSKA": "MM", "MSSL": "MM",
    "MKOL": "MM", "MSLB": "MM", "MSKU": "MM", "S031": "MM",
    # MM - Purchasing
    "EKKO": "MM", "EKPO": "MM", "EKET": "MM", "EKKN": "MM", "EKPA": "MM",
    "EKPV": "MM", "EKBE": "MM", "EKAB": "MM", "EBAN": "MM", "EBKN": "MM",
    "EINA": "MM", "EINE": "MM", "EORD": "MM", "EKES": "MM",
    "RKWA": "MM", "A017": "MM", "S066": "MM", "S067": "MM",
    # PP - Production Planning & MRP
    "AUFK": "PP", "AFKO": "PP", "AFPO": "PP", "AFVC": "PP", "AFVV": "PP",
    "AFVU": "PP", "AFRU": "PP", "AUFM": "PP",
    "CRHD": "PP", "CRTX": "PP", "CRCA": "PP",
    "KAKO": "PP", "KAPA": "PP", "KBKO": "PP",
    "PLAS": "PP", "PLKO": "PP", "PLPO": "PP", "PLSC": "PP", "PROW": "PP",
    "MDKP": "PP", "MDTB": "PP", "PLAF": "PP", "PBED": "PP", "PBIM": "PP",
    "T246": "PP", "T426": "PP", "T430": "PP", "T438R": "PP", "T438T": "PP",
    "T438X": "PP", "T439J": "PP", "T458A": "PP", "T458B": "PP", "MAPR": "PP",
    # PM - Plant Maintenance
    "AFIH": "PM", "ILOA": "PM", "MPOS": "PM", "MPLA": "PM", "MHIS": "PM",
    "MAPL": "PM", "CAUFV": "PM",
    # SD - Sales & Distribution
    "VBAK": "SD", "VBAP": "SD", "VBEP": "SD", "VBFA": "SD", "VBKD": "SD",
    "VBPA": "SD", "VBUK": "SD", "VBUP": "SD", "VBUV": "SD",
    "LIKP": "SD", "LIPS": "SD", "VEPVG": "SD", "VETVG": "SD",
    "VFKK": "SD", "VFKP": "SD", "VTTK": "SD", "VTTP": "SD", "VTTS": "SD",
    "VEKP": "SD", "VEPO": "SD", "VBLB": "SD",
    "KNA1": "SD", "KNB1": "SD", "KNVV": "SD", "KNVP": "SD", "KNVH": "SD",
    "KNMT": "SD", "KNKK": "SD", "KNVK": "SD",
    "TVFST": "SD", "TVFKT": "SD", "TVLS": "SD", "TVLST": "SD",
    "TVSB": "SD", "TVSBT": "SD", "TVST": "SD", "TVSTT": "SD",
    "TVROT": "SD", "TVRO": "SD", "TVRAB": "SD", "TROLZ": "SD",
    "TVGRT": "SD", "TVKBT": "SD", "TVAKO": "SD", "TVAKT": "SD",
    "TVAK": "SD", "TVAPT": "SD", "TVAUT": "SD", "TVAGT": "SD",
    "TVKO": "SD", "TVKOT": "SD", "TINCT": "SD",
    "WYT3": "SD", "T356": "SD", "T356_T": "SD",
    "KONA": "SD", "A142": "SD", "KONP": "SD", "KONV": "SD",
    "NAST": "SD", "STXH": "SD",
    # QM - Quality Management
    "QALS": "QM", "QAMR": "QM", "QAMV": "QM", "QAPP": "QM", "QASE": "QM",
    "QASR": "QM", "QAVE": "QM", "QPCD": "QM", "QPAC": "QM", "QPGR": "QM",
    "QMIH": "QM", "QMMA": "QM", "QMUR": "QM", "QMFE": "QM", "QMSM": "QM",
    "QMEL": "QM", "QAMB": "QM", "QDSV": "QM", "QDSVT": "QM", "PLMK": "QM",
    # WM - Warehouse Management
    "LAGP": "WM", "LQUA": "WM", "LTAK": "WM", "LTAP": "WM",
    "LTBK": "WM", "LTBP": "WM",
    "T300": "WM", "T301": "WM", "T301T": "WM", "T302": "WM", "T302T": "WM",
    "T303": "WM", "T303T": "WM", "T304": "WM", "T304T": "WM",
    "T305": "WM", "T305T": "WM", "T307": "WM", "T307T": "WM",
    "T320": "WM", "T330": "WM", "T330T": "WM", "T331": "WM",
    "T333": "WM", "T334B": "WM", "T334E": "WM", "T334P": "WM",
    "T334T": "WM", "T334U": "WM", "T337A": "WM", "T337B": "WM",
    "T337Z": "WM", "T338": "WM", "T338T": "WM", "T343": "WM",
    "T343J": "WM", "T30A": "WM", "T30AT": "WM",
    # Status / Classification
    "JEST": "CS", "JCDS": "CS",
    "CABN": "CA", "CABNT": "CA", "CAWN": "CA", "CAWNT": "CA",
    "AUSP": "CA", "INOB": "CA",
    # Basis / Org data
    "ADRC": "BC", "ADRP": "BC", "ADR6": "BC",
    "T001L": "OM", "T001W": "OM", "T001K": "OM",
    "SWWWIHEAD": "BC", "SWW_CONTOB": "BC",
    "TSTCT": "BC", "DD03L": "BC", "DD04L": "BC", "DD02L": "BC",
    "DD07T": "BC", "T002T": "BC", "T003T": "BC",
    "T005": "BC", "T005T": "BC", "T005S": "BC", "T005U": "BC",
    "T006": "BC", "T006A": "BC", "T006D": "BC",
    "T009B": "BC", "TFACD": "BC", "TFACS": "BC", "THOC": "BC", "THOL": "BC",
    "TVARVC": "BC", "USR02": "BC", "USR21": "BC", "USER_ADDR": "BC",
    "TCURF": "BC", "TCURT": "BC", "TCURR": "BC", "TCURV": "BC", "TCURW": "BC",
    "TCURX": "BC",
    # Logistics general
    "T024": "OM", "T024B": "OM", "T024D": "OM", "T024E": "OM",
    "T157D": "MM", "T023T": "MM", "T134T": "MM",
    "EIKP": "LE", "DGTMD": "MM",
    # Customer Hierarchy / MDG
    "EBEW": "SD",
    # Document
    "DRAD": "DMS",
    # AFI (formerly FI)
    "AFIDOC_HISTORY": "FI", "AFIDOC_VB": "FI", "AFIHISTORY": "FI",
    "AFIDOC_VB_PART": "FI",
    # Procurement/Vendor
    "LFA1": "MM", "LFB1": "MM", "LFM1": "MM", "LFBK": "MM",
    "T077Y": "MM", "T042Z": "FI",
}

SAP_MODULE_NAMES = {
    "FI": "Financial Accounting",
    "CO": "Controlling",
    "MM": "Materials Management",
    "PP": "Production Planning",
    "PM": "Plant Maintenance",
    "SD": "Sales & Distribution",
    "QM": "Quality Management",
    "WM": "Warehouse Management",
    "CS": "Status Management",
    "CA": "Classification",
    "BC": "Basis / Cross-Application",
    "OM": "Organisation Management",
    "LE": "Logistics Execution",
    "DMS": "Document Management",
    "APO": "SAP APO",
    "BW": "Business Warehouse",
    "MDG": "Master Data Governance",
    "CUSTOM": "Custom / Z-Table",
    "NON-SAP": "Non-SAP / Custom Integration",
}


def derive_sap_info(raw_name):
    """Return (sap_table, source_type, module) for a raw BQ table name."""
    name = raw_name

    # Strip temp_ prefix
    is_temp = name.startswith("temp_")
    if is_temp:
        name = name[5:]
        name = re.sub(r"_\d{12}$", "", name)   # remove long timestamp
        name = re.sub(r"_\d{1,2}$", "", name)  # remove short _1 suffix

    # Strip _orig suffix
    if name.endswith("_orig"):
        name = name[:-5]

    parts = name.split("_")

    # WM prefix: wm_[description]_[SAP_TABLE]
    if parts[0] == "wm" and len(parts) >= 3:
        sap = parts[-1].upper()
        mod = SAP_MODULE_MAP.get(sap, "WM")
        return sap, "SAP Standard", mod

    # BW prefix: reconstruct the BW object/query name
    if parts[0] == "bw":
        # Pattern: bw_[description]_[INFOPROVIDER]_[QNNN]
        # If last segment looks like a query suffix (q + digits), combine with prior segment
        last = parts[-1]
        if re.match(r"^q\d+$", last) and len(parts) >= 3:
            sap = (parts[-2] + "/" + last).upper()
        else:
            sap = last.upper()
        return sap, "SAP BW", "BW"

    # APO prefix
    if parts[0] == "apo":
        # Find first segment starting with 'sapapo'
        for i, p in enumerate(parts):
            if p.startswith("sapapo"):
                sap = "_".join(parts[i:]).upper()
                # Format as /SAPAPO/... for clarity
                sap_readable = "/SAPAPO/" + sap[6:].lstrip("_")
                return sap_readable, "SAP APO", "APO"
        # No SAPAPO segment → APO planning extract
        return None, "APO Planning Extract", "APO"

    # Non-SAP integrations
    if parts[0] in ("beacon", "servicenow"):
        return None, "Non-SAP Integration", "NON-SAP"
    if parts[0] in ("gold", "master", "date", "portfolio", "vw",
                    "lead", "business", "zz"):
        return None, "Custom Reporting / View", "NON-SAP"
    if raw_name in ("portfolio",):
        return None, "Custom Reporting / View", "NON-SAP"

    # MDG prefix (mdg_ with underscore after mdg)
    if parts[0] == "mdg" and len(parts) > 1:
        # Look for a Z-table starting segment
        for i in range(1, len(parts)):
            if parts[i].startswith("z"):
                sap = "_".join(parts[i:]).upper()
                return sap, "SAP Custom Z-Table", "MDG"
        # Check if last segment looks like a short code (≤6 chars)
        last = parts[-1].upper()
        if len(last) <= 6 and re.match(r"^[A-Z][A-Z0-9]+$", last):
            return last, "SAP Standard", SAP_MODULE_MAP.get(last, "MDG")
        return None, "MDG Custom Table", "MDG"

    # Z-table: find first segment (from index 1) starting with 'z'
    for i in range(1, len(parts)):
        if parts[i].startswith("z"):
            sap = "_".join(parts[i:]).upper()
            return sap, "SAP Custom Z-Table", "CUSTOM"

    # Standard SAP: scan all suffix combinations against known module map first
    if len(parts) > 1:
        for i in range(1, len(parts)):
            candidate = "_".join(parts[i:]).upper()
            if candidate in SAP_MODULE_MAP:
                return candidate, "SAP Standard", SAP_MODULE_MAP[candidate]

        # Fall back: use last segment with special combination rules
        last = parts[-1].upper()
        # SAP text-table convention: name ends in _T (e.g. t356_t → T356T)
        if len(last) == 1 and last.isalpha() and len(parts) >= 3:
            sap = (parts[-2] + parts[-1]).upper()
        # Last segment starts with digit (e.g. optvim_1head → OPTVIM_1HEAD)
        elif last[0].isdigit() and len(parts) >= 3:
            sap = (parts[-2] + "_" + parts[-1]).upper()
        else:
            sap = last
        if re.match(r"^[A-Z][A-Z0-9_]{1,29}$", sap):
            mod = SAP_MODULE_MAP.get(sap, "")
            source = "SAP Standard"
            if not mod:
                # Inherit module from base table (text tables end in T)
                base = sap.rstrip("T")
                mod = SAP_MODULE_MAP.get(base, "MM")
            return sap, source, mod

    # No underscores → custom/non-SAP table
    return None, "Custom Reporting / View", "NON-SAP"


def parse_file(filepath):
    schemas = {}
    current_schema = None
    current_table = None
    columns_list = None

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")

            # Top-level schema heading
            if re.match(r"^# [^#]", line):
                title = line[2:].strip()
                if title == "Schema Documentation":
                    continue
                current_schema = title
                schemas[current_schema] = {"tables": {}}
                current_table = None
                columns_list = None
                continue

            # Table heading
            if line.startswith("## ") and current_schema is not None:
                current_table = line[3:].strip()
                schemas[current_schema]["tables"][current_table] = {
                    "column_count": 0,
                    "columns": [],
                }
                columns_list = schemas[current_schema]["tables"][current_table]["columns"]
                continue

            # Column count
            if current_table and line.startswith("**Columns:**"):
                try:
                    cnt = int(line.split("**Columns:**")[1].strip())
                    schemas[current_schema]["tables"][current_table]["column_count"] = cnt
                except (ValueError, IndexError):
                    pass
                continue

            # Table rows — skip header and separator
            if current_table and line.startswith("|") and columns_list is not None:
                cells = [c.strip() for c in line.split("|")]
                cells = [c for c in cells if c != ""]
                if len(cells) < 3:
                    continue
                # Skip header row or separator
                if cells[0] == "#" or all(c in "- " for c in cells[0]):
                    continue
                try:
                    num = int(cells[0])
                    col_name = cells[1].strip("`")
                    col_type = cells[2].strip("`")
                    col_desc = cells[3].strip() if len(cells) > 3 else ""
                    columns_list.append({
                        "num": num,
                        "name": col_name,
                        "type": col_type,
                        "description": col_desc,
                    })
                except (ValueError, IndexError):
                    pass

    return schemas


def module_label(mod):
    name = SAP_MODULE_NAMES.get(mod, mod)
    if mod and mod not in ("NON-SAP", "APO", "BW", "MDG", "CUSTOM"):
        return f"{mod} – {name}"
    return name


def build_dictionary(schemas, source_generated):
    lines = []

    lines.append("# IOReporting Data Dictionary")
    lines.append("")
    lines.append(
        "<!-- AUTO-GENERATED from schema_documentation.md by generate_data_dictionary.py — "
        "do not edit by hand. CI runs `python generate_data_dictionary.py --check` to keep it in sync. -->"
    )
    lines.append("")
    if source_generated:
        lines.append(f"**Source:** `schema_documentation.md` (source snapshot generated {source_generated})")
    else:
        lines.append("**Source:** `schema_documentation.md`")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Data source context
    lines.append("## Data Source")
    lines.append("")
    lines.append(
        "Data is replicated from **SAP ECC 6.0** into BigQuery by **Aecorsoft** "
        "at the database table level. Values are stored exactly as SAP holds them "
        "internally — not formatted for display as in the SAP GUI."
    )
    lines.append("")
    lines.append("### Field Conventions")
    lines.append("")
    lines.append(
        "Because extraction is at the database level, key identifier fields are "
        "**zero-padded** to their full SAP storage length. Apply `LTRIM(col, '0')` "
        "or equivalent when comparing with external systems or displaying to users."
    )
    lines.append("")
    lines.append("| SAP Field | Description | Padded Length | Example |")
    lines.append("|-----------|-------------|:-------------:|---------|")
    lines.append("| `MATNR` | Material Number | 18 | `000000000000012345` |")
    lines.append("| `AUFNR` | Order Number | 12 | `000000123456` |")
    lines.append("| `VBELN` | Sales / Delivery Document | 10 | `0000012345` |")
    lines.append("| `EBELN` | Purchasing Document | 10 | `0000012345` |")
    lines.append("| `KUNNR` | Customer Number | 10 | `0000012345` |")
    lines.append("| `LIFNR` | Vendor Number | 10 | `0000012345` |")
    lines.append("| `CHARG` | Batch Number | 10 | `0000000123` |")
    lines.append("")
    lines.append(
        "**Date fields** (`DATS` type in SAP) are stored as `STRING` in `YYYYMMDD` format."
    )
    lines.append("")
    lines.append("### Aecorsoft System Columns")
    lines.append("")
    lines.append(
        "The following columns are added by Aecorsoft and are **not** SAP data fields:"
    )
    lines.append("")
    lines.append("| Column | Type | Meaning |")
    lines.append("|--------|------|---------|")
    lines.append("| `AEDATTM` | `STRING` | Timestamp of last replication to BigQuery |")
    lines.append("| `AERUNID` | `INT` | Aecorsoft replication run ID |")
    lines.append("| `AERECNO` | `INT` | Record sequence number within replication run |")
    lines.append("")
    lines.append("### SAP Metadata Tables")
    lines.append("")
    lines.append(
        "The following BC tables are imported specifically to support **data enrichment** "
        "— resolving domain value descriptions, field labels, and table structures "
        "programmatically rather than hard-coding them in reports:"
    )
    lines.append("")
    lines.append("| SAP Table | BigQuery Table | Purpose |")
    lines.append("|-----------|---------------|---------|")
    lines.append("| `DD02L` | `metadata_saptable_dd02l` | Table definitions |")
    lines.append("| `DD03L` | `datadictionaryfields_dd03l` | Field definitions per table |")
    lines.append("| `DD04L` | `metadata_dataelement_dd04l` | Data element definitions |")
    lines.append("| `DD07T` | `domaintext_dd07t` | Domain fixed-value descriptions |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Overview
    lines.append("## Overview")
    lines.append("")
    lines.append("| Schema | Tables |")
    lines.append("|--------|-------:|")
    for schema, data in schemas.items():
        lines.append(f"| `{schema}` | {len(data['tables'])} |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Full Table Index
    lines.append("## Table Index")
    lines.append("")
    lines.append("| Schema | BigQuery Table | SAP Table | Module | Type | Cols |")
    lines.append("|--------|---------------|-----------|--------|------|-----:|")

    for schema, data in schemas.items():
        for tname, tdata in data["tables"].items():
            sap_table, source_type, mod = derive_sap_info(tname)
            sap_display = f"`{sap_table}`" if sap_table else "—"
            mod_display = module_label(mod) if mod else "—"
            lines.append(
                f"| `{schema}` | `{tname}` | {sap_display} | {mod_display} "
                f"| {source_type} | {tdata['column_count']} |"
            )

    lines.append("")
    lines.append("---")
    lines.append("")

    # Per-schema detailed entries
    for schema, data in schemas.items():
        lines.append(f"## Schema: `{schema}`")
        lines.append("")
        lines.append(f"**Tables:** {len(data['tables'])}")
        lines.append("")
        lines.append("---")
        lines.append("")

        for tname, tdata in data["tables"].items():
            sap_table, source_type, mod = derive_sap_info(tname)

            is_temp = tname.startswith("temp_")
            is_orig = tname.endswith("_orig")
            is_test = "_test" in tname

            # Table heading
            lines.append(f"### {tname}")
            lines.append("")

            # Metadata block
            lines.append("| Attribute | Value |")
            lines.append("|-----------|-------|")
            lines.append(f"| **BigQuery Table** | `{schema}.{tname}` |")
            if sap_table:
                lines.append(f"| **SAP Table** | `{sap_table}` |")
            lines.append(f"| **Source Type** | {source_type} |")
            if mod:
                lines.append(f"| **SAP Module** | {module_label(mod)} |")
            lines.append(f"| **Columns** | {tdata['column_count']} |")
            if is_temp:
                lines.append("| **Note** | Staging / temporary table — do not use directly in reports |")
            elif is_orig:
                lines.append("| **Note** | Original copy retained before transformation |")
            elif is_test:
                lines.append("| **Note** | Test table — not for production use |")
            lines.append("")

            # Columns
            AECORSOFT_COLS = {
                "AEDATTM": "_(Aecorsoft)_ Replication timestamp — not a SAP field",
                "AERUNID": "_(Aecorsoft)_ Replication run ID — not a SAP field",
                "AERECNO": "_(Aecorsoft)_ Record sequence within replication run — not a SAP field",
            }
            PADDED_COLS = {
                "MATNR": "18-char zero-padded",
                "AUFNR": "12-char zero-padded",
                "VBELN": "10-char zero-padded",
                "EBELN": "10-char zero-padded",
                "KUNNR": "10-char zero-padded",
                "LIFNR": "10-char zero-padded",
                "CHARG": "10-char zero-padded",
            }
            if tdata["columns"]:
                lines.append("| # | Column | Type | Description |")
                lines.append("|--:|--------|------|-------------|")
                for col in tdata["columns"]:
                    cname = col["name"]
                    if cname in AECORSOFT_COLS:
                        desc = AECORSOFT_COLS[cname]
                    elif col["description"]:
                        pad = PADDED_COLS.get(cname, "")
                        desc = col["description"] + (f" _{pad}_" if pad else "")
                    else:
                        desc = "—"
                    lines.append(
                        f"| {col['num']} | `{cname}` | `{col['type']}` | {desc} |"
                    )
            else:
                lines.append("_No column details available._")

            lines.append("")
            lines.append("---")
            lines.append("")

    return "\n".join(lines) + "\n"


def parse_generated_date(filepath):
    """Read the 'Generated: <date>' line from the source schema dump, if present, so the
    dictionary's date tracks the source snapshot deterministically (no wall-clock — keeps the
    --check drift comparison stable)."""
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            m = re.match(r"^Generated:\s*(.+?)\s*$", line.strip())
            if m:
                return m.group(1)
            if line.startswith("# ") and "Schema Documentation" not in line:
                break
    return None


def main():
    import argparse
    import os
    import sys

    # Always operate relative to the repo root (this script lives there), so it runs the same
    # locally and in CI regardless of the caller's working directory.
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    parser = argparse.ArgumentParser(
        description="Generate data_dictionary.md from schema_documentation.md."
    )
    parser.add_argument(
        "--check", action="store_true",
        help="Verify the committed data_dictionary.md is in sync with schema_documentation.md "
             "and exit non-zero if stale (used by CI). Does not write.",
    )
    args = parser.parse_args()

    schemas = parse_file(INPUT_FILE)
    source_generated = parse_generated_date(INPUT_FILE)
    content = build_dictionary(schemas, source_generated)

    total_tables = sum(len(d["tables"]) for d in schemas.values())
    total_cols = sum(
        sum(t["column_count"] for t in d["tables"].values()) for d in schemas.values()
    )

    if args.check:
        existing = ""
        if os.path.exists(OUTPUT_FILE):
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                existing = f.read()
        if existing.strip() != content.strip():
            print(
                f"ERROR: {OUTPUT_FILE} is out of date with {INPUT_FILE}. "
                f"Regenerate with: python generate_data_dictionary.py",
                file=sys.stderr,
            )
            sys.exit(1)
        print(f"{OUTPUT_FILE} is up to date ({total_tables} tables, {total_cols} columns).")
        return

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Written: {OUTPUT_FILE} ({total_tables} tables, {total_cols} columns).")


if __name__ == "__main__":
    main()
