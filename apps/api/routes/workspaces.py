"""Workspace manifest endpoint."""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class TabDefinition(BaseModel):
    """Workspace tab metadata."""

    id: str
    label: str
    icon: str


class WorkspaceManifestEntry(BaseModel):
    """Single workspace registration entry."""

    id: str
    label: str
    icon: str
    lifecycle: str
    scopeLevel: str
    defaultTab: str
    tabs: list[TabDefinition]


class WorkspaceManifest(BaseModel):
    """Full manifest response."""

    workspaces: list[WorkspaceManifestEntry]


_STATIC_MANIFEST: list[WorkspaceManifestEntry] = [
    WorkspaceManifestEntry(
        id="traceability-workspace",
        label="Traceability",
        icon="git-branch",
        lifecycle="live",
        scopeLevel="batch",
        defaultTab="trace",
        tabs=[
            TabDefinition(id="trace", label="Trace", icon="git-branch"),
            TabDefinition(id="lineage", label="Lineage", icon="network"),
        ],
    ),
    WorkspaceManifestEntry(
        id="quality-workspace",
        label="Quality",
        icon="check-circle",
        lifecycle="concept-lab",
        scopeLevel="plant",
        defaultTab="overview",
        tabs=[TabDefinition(id="overview", label="Overview", icon="layout-grid")],
    ),
    WorkspaceManifestEntry(
        id="operations-workspace",
        label="Operations",
        icon="activity",
        lifecycle="concept-lab",
        scopeLevel="plant",
        defaultTab="overview",
        tabs=[TabDefinition(id="overview", label="Overview", icon="layout-grid")],
    ),
]


@router.get("/workspaces/manifest", response_model=WorkspaceManifest)
async def get_workspace_manifest() -> WorkspaceManifest:
    """Return the workspace manifest for the shell to hydrate."""
    return WorkspaceManifest(workspaces=_STATIC_MANIFEST)
