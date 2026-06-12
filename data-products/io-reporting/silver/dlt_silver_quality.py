"""
Lakeflow Spark Declarative Pipeline — Silver Layer (Quality)
"""

# Import the modules containing the table and view definitions to register them with the DLT runtime.
import silver.tables.quality  # noqa: F401
import silver.tables.quality_lab  # noqa: F401
