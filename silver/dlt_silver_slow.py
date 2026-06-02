"""
Lakeflow Spark Declarative Pipeline — Silver Layer (Reference/Slow)
"""

# Import the modules containing the table and view definitions to register them with the DLT runtime.
import silver.tables.inbound  # noqa: F401
import silver.tables.reference  # noqa: F401
import silver.tables.warehouse_reference  # noqa: F401
