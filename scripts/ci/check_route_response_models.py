#!/usr/bin/env python3
"""CI guard: adapter-emitted columns must be declared on the route's pydantic response model.

Closes the failure class that produced a runtime 500 on the order-readiness route:
WmOrderReadinessItem had extra='forbid' and was missing fields the adapter mapped,
so FastAPI raised ResponseValidationError at request time.

## What this checks

For every named dataset/route in wm_operations where an adapter maps rows to a pydantic
response model:

1. Every key the adapter emits is declared on the response model (as a field name OR alias).
2. If the model sets extra='forbid', an adapter output key NOT on the model is a HARD failure
   (the exact runtime-500 condition).

## Snake->camel matching rule

Adapter `columns` in SIMPLE_DATASETS are snake_case DB column names; the adapter applies
`_camel(col)` before yielding camelCase keys (via map_rows_generic):

    def _camel(s: str) -> str:
        parts = s.split("_")
        return parts[0] + "".join(p.title() for p in parts[1:])

This guard replicates that transform verbatim to compare against pydantic model aliases.
The function is copied, not imported, to keep this guard side-effect-free (no app import).

## Scope

- SIMPLE_DATASETS entries: the routes registered via _make_simple_route intentionally omit
  response_model= (they return list[dict]). A mismatch here cannot fire
  ResponseValidationError. These are skipped and logged.
- Explicit mapper functions (map_wm_worklist_rows etc.) + @router.get with
  response_model=list[X]: fully checked.
- Routes with no response_model= (delivery-picks, movements): skipped with a log.
- Routes in other adapter modules: out of scope; extend if needed.

Exit 0 = clean; exit 1 = failure(s) detected.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ADAPTER_PATH = REPO_ROOT / "apps/api/adapters/wm_operations/wm_operations_databricks_adapter.py"
ROUTE_PATH = REPO_ROOT / "apps/api/routes/wm_operations.py"

# Both FunctionDef and AsyncFunctionDef must be handled — route handlers are async.
_FUNC_TYPES = (ast.FunctionDef, ast.AsyncFunctionDef)


# ── snake->camel converter ──────────────────────────────────────────────────
# Verbatim copy of _camel() from the adapter module (used by map_rows_generic).
# This is the canonical matching rule.  Do not change without also changing the adapter.
def _camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


# ── AST helpers ─────────────────────────────────────────────────────────────

def _const_str(node: ast.expr | None) -> str | None:
    """Return the string value of an AST Constant node, or None."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _extract_dict_kv(node: ast.expr) -> "dict[str, ast.expr]":
    """Return key->value-node for dict(...) call (keywords) and ast.Dict literals.

    Supports the two ways a SIMPLE_DATASETS entry value can be written:
      - dict(endpoint="/api/...", columns="...", ...)   -> ast.Call with keywords
      - {"endpoint": "/api/...", "columns": "...", ...} -> ast.Dict
    Returns an empty dict for any other node type.
    """
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "dict":
        return {kw.arg: kw.value for kw in node.keywords if kw.arg}
    if isinstance(node, ast.Dict):
        result: dict[str, ast.expr] = {}
        for k, v in zip(node.keys, node.values):
            if isinstance(k, ast.Constant) and isinstance(k.value, str) and v is not None:
                result[k.value] = v
        return result
    return {}

# ── Model extraction ────────────────────────────────────────────────────────

class ModelInfo:
    """Pydantic model fields extracted from AST."""

    def __init__(self, name: str) -> None:
        self.name = name
        # All keys the model accepts: both snake_case field names and camelCase aliases.
        # (populate_by_name=True is set on all WM models, so both are valid.)
        self.accepted_keys: set[str] = set()
        self.extra_forbid: bool = False

    def __repr__(self) -> str:
        return f"ModelInfo({self.name!r}, forbid={self.extra_forbid}, keys={len(self.accepted_keys)})"


def _extract_models(tree: ast.Module) -> dict[str, ModelInfo]:
    """Parse pydantic BaseModel subclasses from an AST tree."""
    models: dict[str, ModelInfo] = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        base_names = {
            (b.id if isinstance(b, ast.Name) else (b.attr if isinstance(b, ast.Attribute) else ""))
            for b in node.bases
        }
        if "BaseModel" not in base_names:
            continue
        info = ModelInfo(node.name)

        for stmt in node.body:
            # -- extra=forbid detection -----------------------------------------
            # Handles both:
            #   model_config = ConfigDict(extra=forbid)              (ast.Assign)
            #   model_config: ConfigDict = ConfigDict(extra=forbid)  (ast.AnnAssign)
            if isinstance(stmt, ast.Assign):
                for t in stmt.targets:
                    if isinstance(t, ast.Name) and t.id == "model_config":
                        val = stmt.value
                        if isinstance(val, ast.Call):
                            for kw in val.keywords:
                                if kw.arg == "extra" and _const_str(kw.value) == "forbid":
                                    info.extra_forbid = True

            if isinstance(stmt, ast.AnnAssign):
                if isinstance(stmt.target, ast.Name) and stmt.target.id == "model_config":
                    val = stmt.value
                    if isinstance(val, ast.Call):
                        for kw in val.keywords:
                            if kw.arg == "extra" and _const_str(kw.value) == "forbid":
                                info.extra_forbid = True

            # class Config: extra = 'forbid'
            if isinstance(stmt, ast.ClassDef) and stmt.name == "Config":
                for cfg_stmt in stmt.body:
                    if isinstance(cfg_stmt, ast.Assign):
                        for t in cfg_stmt.targets:
                            if isinstance(t, ast.Name) and t.id == "extra":
                                if _const_str(cfg_stmt.value) == "forbid":
                                    info.extra_forbid = True

            # ── Annotated field (AnnAssign) ──────────────────────────────────
            if not isinstance(stmt, ast.AnnAssign):
                continue
            if not isinstance(stmt.target, ast.Name):
                continue
            snake_name = stmt.target.id
            if snake_name.startswith("_") or snake_name == "model_config":
                continue

            # Accept the snake_case name (pydantic with populate_by_name=True)
            info.accepted_keys.add(snake_name)

            # Extract alias='camelName' from Field(...)
            if isinstance(stmt.value, ast.Call):
                for kw in stmt.value.keywords:
                    if kw.arg == "alias":
                        alias = _const_str(kw.value)
                        if alias:
                            info.accepted_keys.add(alias)

        models[node.name] = info
    return models


# ── Route -> response model mapping ────────────────────────────────────────

def _extract_route_response_models(tree: ast.Module) -> dict[str, str]:
    """Return {endpoint_path: ModelClassName} for @router.get with response_model=list[X].

    Handles both `def` and `async def` route handlers.
    """
    mapping: dict[str, str] = {}
    for node in ast.walk(tree):
        if not isinstance(node, _FUNC_TYPES):
            continue
        for deco in node.decorator_list:
            if not isinstance(deco, ast.Call):
                continue
            func = deco.func
            if not (isinstance(func, ast.Attribute) and func.attr == "get"):
                continue
            path_arg = deco.args[0] if deco.args else None
            path = _const_str(path_arg) if path_arg else None
            if not path:
                continue
            for kw in deco.keywords:
                if kw.arg != "response_model":
                    continue
                val = kw.value
                if isinstance(val, ast.Subscript) and isinstance(val.slice, ast.Name):
                    mapping[path] = val.slice.id
                elif isinstance(val, ast.Name):
                    mapping[path] = val.id
    return mapping


# ── Adapter mapper key extraction ───────────────────────────────────────────

def _extract_mapper_functions(tree: ast.Module) -> dict[str, list[str]]:
    """Return {map_*_rows: [camelCaseKey, ...]} by extracting dict literal keys."""
    mappers: dict[str, list[str]] = {}
    for node in ast.walk(tree):
        if not isinstance(node, _FUNC_TYPES):
            continue
        if not (node.name.startswith("map_") and node.name.endswith("_rows")):
            continue
        keys: set[str] = set()
        for child in ast.walk(node):
            if isinstance(child, ast.Dict):
                for k in child.keys:
                    if isinstance(k, ast.Constant) and isinstance(k.value, str):
                        keys.add(k.value)
        if keys:
            mappers[node.name] = list(keys)
    return mappers


# ── SIMPLE_DATASETS extraction ──────────────────────────────────────────────

def _find_simple_datasets_node(tree: ast.Module) -> ast.Dict | None:
    """Return the ast.Dict value for the SIMPLE_DATASETS assignment (Assign or AnnAssign)."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            if any(isinstance(t, ast.Name) and t.id == "SIMPLE_DATASETS" for t in node.targets):
                return node.value if isinstance(node.value, ast.Dict) else None
        if isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name) and node.target.id == "SIMPLE_DATASETS":
                return node.value if isinstance(node.value, ast.Dict) else None
    return None


def _extract_simple_datasets(tree: ast.Module) -> dict[str, list[str]]:
    """Return {dataset_name: [snake_col, ...]} from SIMPLE_DATASETS."""
    datasets: dict[str, list[str]] = {}
    d = _find_simple_datasets_node(tree)
    if d is None:
        return datasets
    for k_node, v_node in zip(d.keys, d.values):
        dataset_name = _const_str(k_node)
        if not dataset_name or v_node is None:
            continue
        kws = _extract_dict_kv(v_node)
        if not kws:
            continue
        col_str = _const_str(kws.get("columns"))
        if col_str is None:
            continue
        datasets[dataset_name] = [c.strip() for c in col_str.split(",") if c.strip()]
    return datasets


def _extract_endpoint_to_dataset(tree: ast.Module) -> dict[str, str]:
    """Return {route_path: dataset_name} from SIMPLE_DATASETS endpoint= fields."""
    mapping: dict[str, str] = {}
    d = _find_simple_datasets_node(tree)
    if d is None:
        return mapping
    for k_node, v_node in zip(d.keys, d.values):
        dataset_name = _const_str(k_node)
        if not dataset_name or v_node is None:
            continue
        kws = _extract_dict_kv(v_node)
        if not kws:
            continue
        ep = _const_str(kws.get("endpoint"))
        if ep:
            mapping[ep.removeprefix("/api")] = dataset_name
    return mapping


# ── Explicit route->mapper mapping ─────────────────────────────────────────

def _extract_explicit_route_mappers(tree: ast.Module) -> dict[str, str]:
    """Return {route_path: map_*_rows_name} for @router.get functions that return a named mapper.

    Handles async def handlers.
    """
    mapping: dict[str, str] = {}
    for node in ast.walk(tree):
        if not isinstance(node, _FUNC_TYPES):
            continue
        path: str | None = None
        for deco in node.decorator_list:
            if not isinstance(deco, ast.Call):
                continue
            func = deco.func
            if isinstance(func, ast.Attribute) and func.attr == "get":
                path_arg = deco.args[0] if deco.args else None
                path = _const_str(path_arg) if path_arg else None
        if not path:
            continue
        # Walk the entire function body for any Call to a map_*_rows function.
        # This covers both direct return and assign-then-return patterns.
        for child in ast.walk(node):
            if not isinstance(child, ast.Call):
                continue
            if not isinstance(child.func, ast.Name):
                continue
            if child.func.id.startswith("map_") and child.func.id.endswith("_rows"):
                mapping[path] = child.func.id
                break
    return mapping


# ── Failure record ──────────────────────────────────────────────────────────

class Failure:
    def __init__(self, label: str, key: str, model_name: str, forbid: bool) -> None:
        self.label = label
        self.key = key
        self.model_name = model_name
        self.forbid = forbid

    def __str__(self) -> str:
        severity = "extra=forbid -> runtime 500" if self.forbid else "field missing on model"
        return (
            f"  FAIL  '{self.label}': "
            f"adapter emits '{self.key}' not declared on {self.model_name} ({severity})"
        )


def _check_keys(label: str, emitted_keys: list[str], model: ModelInfo) -> list[Failure]:
    return [
        Failure(label, key, model.name, model.extra_forbid)
        for key in emitted_keys
        if key not in model.accepted_keys
    ]


# ── Main ────────────────────────────────────────────────────────────────────

def run() -> None:
    print("Running route response-model <-> adapter-output guard...")

    adapter_src = ADAPTER_PATH.read_text(encoding="utf-8")
    route_src = ROUTE_PATH.read_text(encoding="utf-8")
    adapter_tree = ast.parse(adapter_src, filename=str(ADAPTER_PATH))
    route_tree = ast.parse(route_src, filename=str(ROUTE_PATH))

    models = _extract_models(route_tree)
    if not models:
        print("WARNING: no pydantic models found in route file.")
        sys.exit(1)

    route_response_models = _extract_route_response_models(route_tree)
    simple_datasets = _extract_simple_datasets(adapter_tree)
    endpoint_to_dataset = _extract_endpoint_to_dataset(adapter_tree)
    adapter_mappers = _extract_mapper_functions(adapter_tree)
    route_mappers = _extract_explicit_route_mappers(route_tree)

    all_failures: list[Failure] = []
    skipped: list[str] = []
    checked: list[str] = []

    # ── SIMPLE_DATASETS routes ─────────────────────────────────────────────
    # _make_simple_route registers these without response_model= (list[dict], open type).
    # ResponseValidationError cannot fire for these — skip with log.
    for route_path, dataset_name in sorted(endpoint_to_dataset.items()):
        model_name = route_response_models.get(route_path)
        if not model_name:
            skipped.append(
                f"  SKIP  SIMPLE_DATASETS '{dataset_name}' ({route_path}): "
                f"no response_model= (list[dict] open type -- cannot 500 via response validation)"
            )
            continue
        if dataset_name not in simple_datasets:
            skipped.append(f"  SKIP  SIMPLE_DATASETS '{dataset_name}': columns not extractable")
            continue
        model = models.get(model_name)
        if not model:
            skipped.append(
                f"  SKIP  SIMPLE_DATASETS '{dataset_name}': model '{model_name}' not in route file"
            )
            continue
        camel_keys = [_camel(c) for c in simple_datasets[dataset_name]]
        failures = _check_keys(dataset_name, camel_keys, model)
        all_failures.extend(failures)
        if not failures:
            checked.append(
                f"  OK    SIMPLE_DATASETS '{dataset_name}' -> {model_name} "
                f"({len(camel_keys)} columns)"
            )

    # ── Explicit mapper routes ─────────────────────────────────────────────
    for route_path, mapper_name in sorted(route_mappers.items()):
        model_name = route_response_models.get(route_path)
        if not model_name:
            skipped.append(
                f"  SKIP  route '{route_path}' ({mapper_name}): "
                f"no response_model= (list[dict] open type -- cannot 500 via response validation)"
            )
            continue
        mapper_keys = adapter_mappers.get(mapper_name)
        if mapper_keys is None:
            skipped.append(
                f"  SKIP  route '{route_path}' ({mapper_name}): could not extract dict keys"
            )
            continue
        model = models.get(model_name)
        if not model:
            skipped.append(
                f"  SKIP  route '{route_path}': model '{model_name}' not in route file"
            )
            continue
        failures = _check_keys(route_path, mapper_keys, model)
        all_failures.extend(failures)
        if not failures:
            checked.append(
                f"  OK    route '{route_path}' {mapper_name} -> {model_name} "
                f"({len(mapper_keys)} keys)"
            )

    # ── Uncovered routes safety net ──────────────────────────────────────────
    # Any route decorated with response_model= that is not covered by either
    # route_mappers or endpoint_to_dataset (via SIMPLE_DATASETS) cannot be
    # verified -- warn so it does not silently bypass the guard.
    covered_paths: set[str] = set(route_mappers) | set(endpoint_to_dataset)
    for route_path, model_name in sorted(route_response_models.items()):
        if route_path not in covered_paths:
            print(
                f"WARNING: route '{route_path}' has response_model={model_name} but no "
                f"recognised mapper was found -- guard cannot verify adapter output; "
                f"add an explicit map_*_rows function or SIMPLE_DATASETS entry.",
                file=sys.stderr,
            )

    # ── Summary ───────────────────────────────────────────────────────────
    if skipped:
        print(f"\nSkipped {len(skipped)} route(s) (open type / no response_model):")
        for s in skipped:
            print(s)

    if checked:
        print(f"\nPassed {len(checked)} check(s):")
        for c in checked:
            print(c)

    if all_failures:
        hard = [f for f in all_failures if f.forbid]
        soft = [f for f in all_failures if not f.forbid]
        print(f"\nFAILED -- {len(all_failures)} mismatch(es):")
        for f in all_failures:
            print(str(f))
        if hard:
            print(f"\n  {len(hard)} hard failure(s): extra=forbid -> GUARANTEED runtime 500.")
        if soft:
            print(f"\n  {len(soft)} soft failure(s): field silently dropped from response.")
        print(
            "\nFix: add the missing field(s) to the pydantic model in "
            "apps/api/routes/wm_operations.py."
        )
        sys.exit(1)

    print(
        f"\nOK -- all adapter-emitted keys are declared on their response models "
        f"({len(checked)} check(s) passed, {len(skipped)} skipped)."
    )


if __name__ == "__main__":
    run()
