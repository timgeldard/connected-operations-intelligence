"""Unit tests for the route response-model guard.

Exercises four cases mandated by the spec:
  1. missing-field FAIL    -- adapter emits a key not on the model -> failure
  2. extra-on-forbid FAIL  -- model has extra='forbid'; undeclared key -> hard failure
  3. all-aligned PASS      -- every adapter key has a matching model field
  4. camelCase alias PASS  -- snake_case column maps to camelCase alias via _camel()

No vacuous assertions: the failing cases are verified to fail WITHOUT the guard's
key-presence check returning an empty list.
"""
import ast
import textwrap

from check_route_response_models import (  # Import functions under test (no app import, AST-only)
    _camel,
    _check_keys,
    _extract_mapper_functions,
    _extract_models,
    _extract_route_response_models,
    _extract_simple_datasets,
)

# ── Helpers ─────────────────────────────────────────────────────────────────

def _parse(src: str) -> ast.Module:
    return ast.parse(textwrap.dedent(src))


# ── _camel() tests ───────────────────────────────────────────────────────────

def test_camel_single_word():
    assert _camel("plant") == "plant"


def test_camel_two_words():
    assert _camel("plant_id") == "plantId"


def test_camel_three_words():
    assert _camel("wm_component_count") == "wmComponentCount"


def test_camel_already_no_underscore():
    assert _camel("uom") == "uom"


# ── Model extraction tests ───────────────────────────────────────────────────

_SIMPLE_MODEL_SRC = """
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class MyItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    order_id: str = Field(..., alias='orderId')
    uom: Optional[str] = None
"""

_ALLOW_MODEL_SRC = """
from pydantic import BaseModel, Field
from typing import Optional

class LooseItem(BaseModel):
    plant_id: str = Field(..., alias='plantId')
    uom: Optional[str] = None
"""


def test_model_extraction_forbid():
    tree = _parse(_SIMPLE_MODEL_SRC)
    models = _extract_models(tree)
    assert "MyItem" in models
    m = models["MyItem"]
    assert m.extra_forbid is True


def test_model_extraction_no_forbid():
    tree = _parse(_ALLOW_MODEL_SRC)
    models = _extract_models(tree)
    assert "LooseItem" in models
    m = models["LooseItem"]
    assert m.extra_forbid is False


def test_model_accepts_both_snake_and_alias():
    tree = _parse(_SIMPLE_MODEL_SRC)
    m = _extract_models(tree)["MyItem"]
    # snake_case field names accepted (populate_by_name=True)
    assert "plant_id" in m.accepted_keys
    assert "order_id" in m.accepted_keys
    # camelCase aliases also accepted
    assert "plantId" in m.accepted_keys
    assert "orderId" in m.accepted_keys


def test_model_no_alias_field_accepted_by_snake():
    tree = _parse(_SIMPLE_MODEL_SRC)
    m = _extract_models(tree)["MyItem"]
    assert "uom" in m.accepted_keys


# ── Case 1: missing field FAIL ───────────────────────────────────────────────

def test_missing_field_produces_failure():
    """Adapter emits 'extraKey' which is not on the model -> failure recorded."""
    tree = _parse(_ALLOW_MODEL_SRC)
    m = _extract_models(tree)["LooseItem"]
    # LooseItem accepts: plant_id, plantId, uom
    failures = _check_keys("test_route", ["plantId", "uom", "extraKey"], m)
    assert len(failures) == 1
    assert failures[0].key == "extraKey"
    assert failures[0].forbid is False


def test_missing_field_failure_is_not_empty_without_guard():
    """Regression: confirm the list is genuinely non-empty (no vacuous pass)."""
    tree = _parse(_ALLOW_MODEL_SRC)
    m = _extract_models(tree)["LooseItem"]
    all_keys = ["plantId", "uom", "ghostField"]
    raw_missing = [k for k in all_keys if k not in m.accepted_keys]
    assert raw_missing == ["ghostField"], "fixture must genuinely fail without the guard"


# ── Case 2: extra-on-forbid FAIL ────────────────────────────────────────────

def test_extra_on_forbid_is_hard_failure():
    """Model has extra='forbid'; undeclared key -> Failure with forbid=True."""
    tree = _parse(_SIMPLE_MODEL_SRC)
    m = _extract_models(tree)["MyItem"]
    assert m.extra_forbid is True
    failures = _check_keys("my_route", ["plantId", "orderId", "uom", "unknownField"], m)
    assert len(failures) == 1
    f = failures[0]
    assert f.key == "unknownField"
    assert f.forbid is True  # hard failure -> would cause runtime 500


def test_forbid_failure_str_mentions_500():
    """The failure's string representation mentions runtime 500 for extra=forbid models."""
    tree = _parse(_SIMPLE_MODEL_SRC)
    m = _extract_models(tree)["MyItem"]
    failures = _check_keys("my_route", ["unknownField"], m)
    assert "500" in str(failures[0])


# ── Case 3: all-aligned PASS ────────────────────────────────────────────────

def test_aligned_produces_no_failures():
    """All adapter keys present on the model -> empty failure list."""
    tree = _parse(_SIMPLE_MODEL_SRC)
    m = _extract_models(tree)["MyItem"]
    # All keys in accepted_keys: plant_id/plantId, order_id/orderId, uom
    failures = _check_keys("my_route", ["plantId", "orderId", "uom"], m)
    assert failures == []


def test_aligned_with_snake_name_also_passes():
    """pydantic populate_by_name=True means snake_case is also accepted."""
    tree = _parse(_SIMPLE_MODEL_SRC)
    m = _extract_models(tree)["MyItem"]
    failures = _check_keys("my_route", ["plant_id", "order_id", "uom"], m)
    assert failures == []


# ── Case 4: camelCase alias PASS ────────────────────────────────────────────

_CAMEL_TEST_ADAPTER_SRC = """
SIMPLE_DATASETS: dict = {
    "my_dataset": dict(
        contract="x.y",
        endpoint="/api/wm-operations/my-dataset",
        columns="plant_id, wm_component_count, uom",
        order_by="plant_id ASC",
        numeric=(),
        integer=("wm_component_count",),
        boolean=(),
        has_warehouse=False,
    ),
}
"""

_CAMEL_TEST_MODEL_SRC = """
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class MyDatasetItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    wm_component_count: Optional[int] = Field(None, alias='wmComponentCount')
    uom: Optional[str] = None
"""


def test_camel_transform_matches_alias():
    """snake_case column names from SIMPLE_DATASETS -> camelCase via _camel() -> match alias."""
    adapter_tree = _parse(_CAMEL_TEST_ADAPTER_SRC)
    datasets = _extract_simple_datasets(adapter_tree)
    assert "my_dataset" in datasets
    cols = datasets["my_dataset"]
    camel_keys = [_camel(c) for c in cols]
    assert camel_keys == ["plantId", "wmComponentCount", "uom"]

    route_tree = _parse(_CAMEL_TEST_MODEL_SRC)
    model = _extract_models(route_tree)["MyDatasetItem"]
    failures = _check_keys("my_dataset", camel_keys, model)
    # All three keys are declared on the model -> no failures
    assert failures == []


def test_missing_camel_alias_fails():
    """If camelCase key is not aliased on the model, the check fails.

    This is the regression: adapter emits 'wmComponentCount' but the model
    only has 'wm_component_count' with no alias -> NOT in accepted_keys as camelCase.
    """
    no_alias_src = """
from pydantic import BaseModel, ConfigDict
from typing import Optional

class BrokenItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str
    wm_component_count: Optional[int] = None
    uom: Optional[str] = None
"""
    adapter_tree = _parse(_CAMEL_TEST_ADAPTER_SRC)
    cols = _extract_simple_datasets(adapter_tree)["my_dataset"]
    camel_keys = [_camel(c) for c in cols]

    route_tree = _parse(no_alias_src)
    model = _extract_models(route_tree)["BrokenItem"]
    failures = _check_keys("my_dataset", camel_keys, model)
    # wmComponentCount not in accepted_keys (no alias) -> failure
    missing = [f.key for f in failures]
    assert "wmComponentCount" in missing


# ── Mapper extraction tests ─────────────────────────────────────────────────

_MAPPER_SRC = """
def map_my_rows(rows):
    return [{
        "plantId": rows[0].get("plant_id"),
        "orderId": rows[0].get("order_id"),
    }]
"""


def test_mapper_key_extraction():
    tree = _parse(_MAPPER_SRC)
    mappers = _extract_mapper_functions(tree)
    assert "map_my_rows" in mappers
    assert set(mappers["map_my_rows"]) == {"plantId", "orderId"}


# ── Route response_model extraction tests ───────────────────────────────────

_ROUTE_SRC = """
from fastapi import APIRouter
router = APIRouter()

class MyItem:
    pass

@router.get("/wm-operations/my-route", response_model=list[MyItem])
async def my_handler():
    pass

@router.get("/wm-operations/open-route")
async def open_handler():
    pass
"""


def test_route_response_model_extraction():
    tree = _parse(_ROUTE_SRC)
    mapping = _extract_route_response_models(tree)
    assert mapping.get("/wm-operations/my-route") == "MyItem"
    assert "/wm-operations/open-route" not in mapping


def test_open_route_not_in_response_models():
    tree = _parse(_ROUTE_SRC)
    mapping = _extract_route_response_models(tree)
    assert "/wm-operations/open-route" not in mapping


# ── SIMPLE_DATASETS extraction tests ────────────────────────────────────────

_SD_SRC = """
SIMPLE_DATASETS: dict = {
    "myds": dict(
        contract="x.y",
        endpoint="/api/wm-operations/myds",
        columns="plant_id, some_count, flag_val",
        order_by="plant_id ASC",
        numeric=(),
        integer=("some_count",),
        boolean=("flag_val",),
        has_warehouse=False,
    ),
}
"""


def test_simple_datasets_extraction():
    tree = _parse(_SD_SRC)
    datasets = _extract_simple_datasets(tree)
    assert "myds" in datasets
    assert datasets["myds"] == ["plant_id", "some_count", "flag_val"]
