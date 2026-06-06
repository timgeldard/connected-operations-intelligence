"""ConnectIO V2 FastAPI application entry point."""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes.auth import router as auth_router
from routes.auth_diagnostics import router as auth_diagnostics_router
from routes.connected_quality_lab import router as connected_quality_lab_router
from routes.envmon import router as envmon_router
from routes.health import router as health_router
from routes.process_order import router as process_order_router
from routes.quality import router as quality_router
from routes.spc import router as spc_router
from routes.trace2 import router as trace2_router
from routes.warehouse360 import router as warehouse360_router
from routes.workspaces import router as workspaces_router
from shared.proxy_client import close_proxy_client
from shared.query_service.databricks_client import databricks_http_client_pool

_log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if os.getenv("APP_ENV", "development") != "production":
        _log.warning(
            "STARTUP: x-forwarded-* header names have not been verified against a live "
            "Databricks Apps environment. See TODO in shared/query_service/identity.py. "
            "Deploy with ENABLE_AUTH_DIAGNOSTICS=true and hit /api/diagnostics/auth-headers to verify."
        )
    yield
    await databricks_http_client_pool.aclose()
    await close_proxy_client()


app = FastAPI(title="ConnectIO API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(workspaces_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(auth_diagnostics_router, prefix="/api")
app.include_router(trace2_router, prefix="/api")
app.include_router(warehouse360_router, prefix="/api")
app.include_router(process_order_router, prefix="/api")
app.include_router(connected_quality_lab_router, prefix="/api")
app.include_router(envmon_router, prefix="/api")
app.include_router(spc_router, prefix="/api")
app.include_router(quality_router, prefix="/api")

# Serve the React bundle as static files when deployed to Databricks Apps.
# The static/ directory is absent in local development (Vite serves the frontend directly).
# html=True is sufficient: the app navigates via URL search params (?workspace=X), so the
# server always receives GET / — there are no path-segment deep links that would need a
# catch-all route.
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
