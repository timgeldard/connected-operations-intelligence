# Copied from timgeldard/SupplyChainGraph src/supplychainpy/config/movement_types.py - single source of movement semantics.
"""
SAP movement-type semantics derived from T156-style process definitions.
"""

from typing import Set

MOVEMENT_TYPE_MAPPING = {
    # ===== GOODS RECEIPTS =====
    # Production Receipts
    "101": "GOODS_RECEIPT_PRODUCTION",
    "102": "REVERSAL_GR_PRODUCTION",
    "131": "GOODS_RECEIPT_BYPRODUCT",
    "132": "REVERSAL_GR_BYPRODUCT",
    # Purchase Order Receipts
    "103": "GOODS_RECEIPT_PURCHASE_ORDER",
    "104": "REVERSAL_GR_PURCHASE_ORDER",
    # Receipts without PO
    "501": "GOODS_RECEIPT_WITHOUT_PO",
    "502": "REVERSAL_GR_WITHOUT_PO",
    # Stock Transport Orders (STO)
    "105": "GOODS_RECEIPT_STO_PLANT_TO_PLANT",
    "106": "REVERSAL_GR_STO",
    # ===== GOODS ISSUES =====
    # Production Consumption
    "261": "GOODS_ISSUE_PRODUCTION",
    "262": "REVERSAL_GI_PRODUCTION",
    # Sales Order Deliveries
    "601": "GOODS_ISSUE_DELIVERY",
    "602": "REVERSAL_GI_DELIVERY",
    # Scrapping
    "551": "GOODS_ISSUE_SCRAPPING",
    "552": "REVERSAL_GI_SCRAPPING",
    # Cost Center Consumption
    "201": "GOODS_ISSUE_COST_CENTER",
    "202": "REVERSAL_GI_COST_CENTER",
    # Sampling
    "221": "GOODS_ISSUE_SAMPLING",
    "222": "REVERSAL_GI_SAMPLING",
    # Returns to Vendor
    "122": "GOODS_ISSUE_RETURN_TO_VENDOR",
    "123": "REVERSAL_GI_RETURN_TO_VENDOR",
    # ===== TRANSFER POSTINGS =====
    # Storage Location to Storage Location
    "311": "TRANSFER_POSTING_STORAGE_LOC",
    "312": "REVERSAL_TRANSFER_STORAGE_LOC",
    # Plant to Plant (One Step)
    "301": "TRANSFER_POSTING_PLANT_ONE_STEP",
    "302": "REVERSAL_TRANSFER_PLANT_ONE_STEP",
    # Plant to Plant (Two Step)
    "303": "TRANSFER_POSTING_PLANT_TWO_STEP_ISSUE",
    "304": "REVERSAL_TRANSFER_PLANT_TWO_STEP_ISSUE",
    "305": "TRANSFER_POSTING_PLANT_TWO_STEP_RECEIPT",
    "306": "REVERSAL_TRANSFER_PLANT_TWO_STEP_RECEIPT",
    # Storage Type Changes (WM)
    "309": "TRANSFER_POSTING_STORAGE_TYPE",
    "310": "REVERSAL_TRANSFER_STORAGE_TYPE",
    # Stock Type Changes (Quality, Blocked, etc.)
    "321": "TRANSFER_POSTING_QUALITY_TO_UNRESTRICTED",
    "322": "REVERSAL_TRANSFER_QUALITY_TO_UNRESTRICTED",
    "323": "TRANSFER_POSTING_BLOCKED_TO_UNRESTRICTED",
    "324": "REVERSAL_TRANSFER_BLOCKED_TO_UNRESTRICTED",
    "325": "TRANSFER_POSTING_UNRESTRICTED_TO_QUALITY",
    "326": "REVERSAL_TRANSFER_UNRESTRICTED_TO_QUALITY",
    "343": "TRANSFER_POSTING_UNRESTRICTED_TO_BLOCKED",
    "344": "REVERSAL_TRANSFER_UNRESTRICTED_TO_BLOCKED",
    # ===== STOCK IN TRANSIT (SIT) =====
    "641": "TRANSFER_POSTING_STO_ISSUE",
    "642": "REVERSAL_TRANSFER_STO_ISSUE",
    "107": "GOODS_ISSUE_TO_SIT_VALUATED",
    "108": "REVERSAL_GI_TO_SIT",
    "109": "GOODS_RECEIPT_FROM_SIT_VALUATED",
    "110": "REVERSAL_GR_FROM_SIT",
    # ===== INVENTORY ADJUSTMENTS =====
    # Physical Inventory
    "701": "GOODS_RECEIPT_PHYSICAL_INVENTORY",
    "702": "GOODS_ISSUE_PHYSICAL_INVENTORY",
    "703": "REVERSAL_PHYSICAL_INVENTORY_GR",
    "704": "REVERSAL_PHYSICAL_INVENTORY_GI",
    # Cycle Count Adjustments
    "711": "GOODS_RECEIPT_CYCLE_COUNT",
    "712": "GOODS_ISSUE_CYCLE_COUNT",
    # ===== CUSTOMER RETURNS =====
    "651": "GOODS_RECEIPT_CUSTOMER_RETURN",
    "652": "REVERSAL_GR_CUSTOMER_RETURN",
    # ===== SUBCONTRACTING =====
    "541": "GOODS_RECEIPT_SUBCONTRACTING",
    "542": "REVERSAL_GR_SUBCONTRACTING",
    "543": "GOODS_ISSUE_SUBCONTRACTING_COMPONENT",
    "544": "REVERSAL_GI_SUBCONTRACTING_COMPONENT",
    # ===== CUSTOM Z-MOVEMENTS =====
    # TODO: Confirm these site-specific custom codes against this SAP configuration.
    "Z01": "CUSTOM_BULK_DROP",
    "Z61": "DUV_STOCK_WRITE_OFF",
    "Z62": "DUV_STOCK_WRITE_ON",
    "Z09": "TRANSFER_POSTING_STORAGE_TYPE",
    "Z11": "CUSTOM_QUALITY_RELEASE",
}

MOVEMENT_CATEGORIES = {
    "PRODUCTION": [
        "101",
        "102",
        "131",
        "132",
        "261",
        "262",
    ],
    "PROCUREMENT": [
        "103",
        "104",
        "501",
        "502",
        "122",
        "123",
        "541",
        "542",
    ],
    "SALES": [
        "601",
        "602",
        "651",
        "652",
    ],
    "TRANSFER": [
        "301",
        "302",
        "303",
        "304",
        "305",
        "306",
        "311",
        "312",
        "309",
        "Z09",
        "310",
        "641",
        "642",
        "107",
        "108",
        "109",
        "110",
    ],
    "QUALITY": [
        "321",
        "322",
        "323",
        "324",
        "325",
        "326",
        "343",
        "344",
    ],
    "INVENTORY_ADJUSTMENT": [
        "701",
        "702",
        "703",
        "704",
        "711",
        "712",
        "Z61",
        "Z62",
    ],
    "CONSUMPTION": [
        "201",
        "202",
        "221",
        "222",
        "551",
        "552",
    ],
}

T156_REVERSAL_MAPPING: Set[str] = {
    k for k, v in MOVEMENT_TYPE_MAPPING.items() if "REVERSAL" in v
}

RECEIPT_MOVEMENT_TYPES: Set[str] = {
    "101",
    "102",
    "103",
    "104",
    "105",
    "106",
    "109",
    "110",
    "131",
    "132",
    "501",
    "502",
    "541",
    "542",
    "651",
    "652",
}

ISSUE_MOVEMENT_TYPES: Set[str] = {
    "107",
    "108",
    "122",
    "123",
    "201",
    "202",
    "221",
    "222",
    "261",
    "262",
    "543",
    "544",
    "551",
    "552",
    "601",
    "602",
}

TRANSFER_MOVEMENT_TYPES: Set[str] = {
    "107",
    "108",
    "109",
    "110",
    "301",
    "302",
    "303",
    "304",
    "305",
    "306",
    "309",
    "310",
    "311",
    "312",
    "321",
    "322",
    "323",
    "324",
    "325",
    "326",
    "343",
    "344",
    "641",
    "642",
    "Z09",
}

STOCK_WRITE_ON_MOVEMENT_TYPES: Set[str] = {"701", "703", "711", "Z62"}
STOCK_WRITE_OFF_MOVEMENT_TYPES: Set[str] = {"702", "704", "712", "Z61"}
INITIAL_ENTRY_MOVEMENT_TYPES: Set[str] = {"561", "562"}


def get_movement_category(movement_type: str) -> str:
    """
    Returns the business category for a movement type.
    """
    for category, types in MOVEMENT_CATEGORIES.items():
        if movement_type in types:
            return category
    return "OTHER"


def get_movement_event_category(movement_type: str) -> str:
    """
    Returns the physical inventory event family for a movement type.
    """
    if movement_type in RECEIPT_MOVEMENT_TYPES:
        return "GOODS_RECEIPT"
    if movement_type in ISSUE_MOVEMENT_TYPES:
        return "GOODS_ISSUE"
    if movement_type in TRANSFER_MOVEMENT_TYPES:
        return "TRANSFER"
    if movement_type in STOCK_WRITE_ON_MOVEMENT_TYPES:
        return "STOCK_WRITE_ON"
    if movement_type in STOCK_WRITE_OFF_MOVEMENT_TYPES:
        return "STOCK_WRITE_OFF"
    if movement_type in INITIAL_ENTRY_MOVEMENT_TYPES:
        return "INITIAL_ENTRY"
    return "OTHER"


def is_reversal(movement_type: str) -> bool:
    """
    Checks if a movement type is a reversal using T156 authoritative mapping.
    """
    return movement_type in T156_REVERSAL_MAPPING


def get_movement_direction(
    movement_type: str, signed_quantity: float | None = None
) -> str:
    """
    Returns the net inventory direction for the posting.

    Transfers remain INTERNAL regardless of sign. All other event families use
    signed quantity when available so reversals land in the opposite direction
    of their original event.
    """
    if movement_type in TRANSFER_MOVEMENT_TYPES:
        return "INTERNAL"

    if signed_quantity is not None:
        return "INBOUND" if signed_quantity >= 0 else "OUTBOUND"

    category = get_movement_event_category(movement_type)
    if category in {"GOODS_RECEIPT", "STOCK_WRITE_ON", "INITIAL_ENTRY"}:
        return "INBOUND"
    if category in {"GOODS_ISSUE", "STOCK_WRITE_OFF"}:
        return "OUTBOUND"
    return "UNKNOWN"
