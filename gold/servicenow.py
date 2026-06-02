"""
ServiceNow Integration Stub for Connected Plant Pipeline Alerts.
"""
import json
import os

import requests


def create_servicenow_incident(summary: str, details: str, severity: int = 3) -> str:
    """
    Creates an incident in ServiceNow when a pipeline reconciliation control or job fails.

    How to enable in Production:
      1. Store credentials in a Databricks secret scope (e.g. `service_now`).
      2. Configure environment variables in the Databricks job definition:
         - SERVICENOW_URL: e.g. https://yourinstance.service-now.com
         - SERVICENOW_USER: username
         - SERVICENOW_PASSWORD: password (reference secrets via {{secrets/service_now/api_password}})
    """
    url = os.environ.get("SERVICENOW_URL")
    user = os.environ.get("SERVICENOW_USER")
    password = os.environ.get("SERVICENOW_PASSWORD")

    # ServiceNow standard mapping: 1 (High), 2 (Medium), 3 (Low)
    # Severity inputs: 4 (Critical/Variance), 3 (High), 2 (Medium), 1 (Low)
    if severity >= 4:
        impact = "1"
        urgency = "1"
    elif severity == 3:
        impact = "2"
        urgency = "2"
    else:
        impact = "3"
        urgency = "3"

    payload = {
        "short_description": summary,
        "description": details,
        "impact": impact,
        "urgency": urgency,
        "assignment_group": "Connected Plant Operations",
        "category": "Software",
        "subcategory": "Database/Data Warehouse",
        "cmdb_ci": "Databricks Connected Plant Pipeline"
    }

    print(f"[ServiceNow Stub] Incident Payload:\n{json.dumps(payload, indent=2)}")

    if not (url and user and password):
        print("[ServiceNow Stub] Missing credentials (SERVICENOW_URL/USER/PASSWORD). Skipping HTTP call.")
        return "MOCK-INC0012345"

    endpoint = f"{url.rstrip('/')}/api/now/table/incident"
    try:
        response = requests.post(
            endpoint,
            auth=(user, password),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            data=json.dumps(payload),
            timeout=10
        )
        if response.status_code == 201:
            result = response.json().get("result", {})
            incident_number = result.get("number")
            sys_id = result.get("sys_id")
            print(f"[ServiceNow] Created Incident: {incident_number} (sys_id: {sys_id})")
            return incident_number
        else:
            print(f"[ServiceNow Error] Code {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print(f"[ServiceNow Error] Failed to connect: {str(e)}")
        return None
