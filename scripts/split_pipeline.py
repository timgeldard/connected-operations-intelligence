#!/usr/bin/env python3
import re


def main():
    with open("silver/dlt_silver_pipeline.py", "r") as f:
        content = f.read()

    # Split using the pattern of section headers starting with unicode horizontal lines
    # e.g., # ── 1. PROCESS ORDER ──
    sections = re.split(r"(# ──+ \d+\. [^\n]+)", content)

    # We should have a list of [header, content, header, content, ...]
    # Let's group them
    header_content_pairs = []

    for i in range(1, len(sections), 2):
        header = sections[i]
        body = sections[i+1] if i+1 < len(sections) else ""
        header_content_pairs.append((header, body))

    # Fast pipeline tables (Continuous)
    fast_sections = [
        "PROCESS ORDER",
        "PROCESS ORDER OPERATION",
        "PI SHEET EXECUTION",
        "GOODS MOVEMENT",
        "BATCH STOCK",
        "WAREHOUSE TRANSFER ORDER",
        "WAREHOUSE TRANSFER REQUIREMENT",
        "DOWNTIME EVENT"
    ]

    # Slow pipeline tables (Triggered reference)
    slow_sections = [
        "WAREHOUSE PLANT MAPPING",
        "STORAGE BIN",
        "MATERIAL",
        "STORAGE LOCATION",
        "WORK CENTRE",
        "CAPACITY UTILISATION",
        "MOVEMENT TYPE CLASSIFICATION"
    ]

    # Quality pipeline tables (Triggered Quality)
    quality_sections = [
        "QUALITY INSPECTION LOT"
    ]

    fast_code = []
    slow_code = []
    quality_code = []

    for header, body in header_content_pairs:
        matched = False
        header_upper = header.upper()

        for s in fast_sections:
            if s in header_upper:
                fast_code.append(header + body)
                matched = True
                break
        if matched:
            continue

        for s in slow_sections:
            if s in header_upper:
                slow_code.append(header + body)
                matched = True
                break
        if matched:
            continue

        for s in quality_sections:
            if s in header_upper:
                quality_code.append(header + body)
                matched = True
                break

        if not matched:
            print(f"Warning: Section not matched: {header}")

    # Build file contents
    imports_template = """\"\"\"
Lakeflow Spark Declarative Pipeline — Silver Layer ({tier})
\"\"\"

import dlt
from pyspark.sql import functions as F
from silver.helpers import get_spark, BRONZE, PP_PI_ORDER_TYPES, strip_zeros, sap_date, sap_datetime, sap_flag

spark = get_spark()

"""

    with open("silver/dlt_silver_fast.py", "w") as f:
        f.write(imports_template.format(tier="Fast Operational"))
        f.write("".join(fast_code))
    print("Created silver/dlt_silver_fast.py")

    with open("silver/dlt_silver_slow.py", "w") as f:
        f.write(imports_template.format(tier="Reference/Slow"))
        f.write("".join(slow_code))
    print("Created silver/dlt_silver_slow.py")

    with open("silver/dlt_silver_quality.py", "w") as f:
        f.write(imports_template.format(tier="Quality"))
        f.write("".join(quality_code))
    print("Created silver/dlt_silver_quality.py")

if __name__ == "__main__":
    main()
