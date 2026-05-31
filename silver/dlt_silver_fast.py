"""
Lakeflow Spark Declarative Pipeline — Silver Layer (Fast Operational)
"""

# Import the modules containing the table and view definitions to register them with the DLT runtime.
import silver.tables.process_order  # noqa: F401
import silver.tables.warehouse  # noqa: F401
