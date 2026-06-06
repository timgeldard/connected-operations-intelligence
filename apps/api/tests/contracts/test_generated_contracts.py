import pytest
from adapters.trace2.trace2_databricks_adapter import TraceGraphRequest, map_trace_graph
from contracts.generated import TraceGraph


def test_trace_graph_validation_with_snake_case():
    """Verify that TraceGraph can be populated using snake_case (internal API)."""
    data = {
        "nodes": [
            {
                "id": "node1",
                "materialId": "MAT1",
                "materialDescription": "Desc1",
                "batchId": "B1",
                "directions": ["upstream"]
            }
        ],
        "edges": [],
        "direction": "upstream",
        "depth": 1,
        "rootBatch": "MAT1/B1",
        "upstreamCount": 1,
        "downstreamCount": 0,
        "unresolvedNodeCount": 0,
        "truncated": False,
        "warnings": []
    }

    # Test population via aliases (how FastAPI usually receives it)
    graph = TraceGraph(**data)
    assert graph.direction == "upstream"
    assert graph.nodes[0].material_id == "MAT1"

    # Test population via snake_case (populate_by_name=True)
    data_snake = {
        "nodes": [
            {
                "id": "node1",
                "material_id": "MAT1",
                "material_description": "Desc1",
                "batch_id": "B1",
                "directions": ["upstream"]
            }
        ],
        "edges": [],
        "direction": "upstream",
        "depth": 1,
        "root_batch": "MAT1/B1",
        "upstream_count": 1,
        "downstream_count": 0,
        "unresolved_node_count": 0,
        "truncated": False,
        "warnings": []
    }
    graph_snake = TraceGraph(**data_snake)
    assert graph_snake.direction == "upstream"
    assert graph_snake.nodes[0].material_id == "MAT1"

def test_trace_graph_direction_enum():
    """Verify that TraceGraph accepts upstream/downstream/both."""
    base_data = {
        "nodes": [],
        "edges": [],
        "depth": 0,
        "rootBatch": "ROOT",
        "upstreamCount": 0,
        "downstreamCount": 0,
        "unresolvedNodeCount": 0
    }

    for direction in ["upstream", "downstream", "both"]:
        data = {**base_data, "direction": direction}
        graph = TraceGraph(**data)
        assert graph.direction == direction

    with pytest.raises(ValueError):
        TraceGraph(**{**base_data, "direction": "forward"})

def test_map_trace_graph_output_validates():
    """Verify that the actual mapper output validates against the generated model."""
    request = TraceGraphRequest(
        material_id="MAT1",
        batch_id="B1",
        plant_id="P1",
        direction="upstream",
        max_depth=3,
        max_edges=100
    )

    # Mock row data matching what the adapter expects
    row = {
        "material_id": "MAT1",
        "batch_id": "B1",
        "material_name": "Material 1",
        "plant_id": "P1",
        "parent_material_id": "MAT_P",
        "parent_batch_id": "B_P",
        "parent_material_name": "Parent Mat",
        "parent_plant_id": "P1",
        "child_material_id": "MAT1",
        "child_batch_id": "B1",
        "child_material_name": "Material 1",
        "child_plant_id": "P1",
    }

    # tagged_rows: list[tuple[dict, hop, direction]]
    tagged_rows = [(row, 0, "upstream")]

    mapped_output = map_trace_graph(
        tagged_rows=tagged_rows,
        request=request,
        depth_reached=1,
        truncated=False
    )

    # This is the critical check: does the dictionary returned by our mapper
    # validate against the Pydantic model generated from the Zod schema?
    graph = TraceGraph.model_validate(mapped_output)

    assert graph.direction == "upstream"
    assert graph.root_batch == "MAT1/B1"
    assert len(graph.nodes) > 0
    assert graph.upstream_count > 0
