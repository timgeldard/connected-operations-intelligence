"""Pin the Databricks Apps OAuth proxy header NAMES that the RLS/OBO model depends on.

The plant-level RLS guarantee for every domain depends on resolving the real end user from
the ``x-forwarded-*`` headers the Databricks Apps OAuth proxy injects. Those names are marked
UNVERIFIED in ``identity.py`` until confirmed against a live Databricks Apps deployment — see
``docs/audit/databricks-apps-oauth-header-verification.md``.

This test pins the header names the code currently binds so a rename cannot land silently. The
behavioural tests in ``test_identity.py`` call ``extract_user_identity`` with keyword args, which
would rename in lockstep with the params and so would NOT catch a header-name change; the
``TestClient`` cases below send real HTTP headers and therefore fail if the bound name changes.

When the live names are confirmed, update ``EXPECTED_HEADER_NAMES`` here in lockstep with
``extract_user_identity`` and remove the UNVERIFIED markers.
"""
import inspect

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from shared.query_service.identity import UserIdentity, extract_user_identity

# FastAPI binds each ``Header(default=None)`` param to the header named by replacing
# underscores with hyphens. Param name -> bound HTTP header name.
EXPECTED_HEADER_NAMES = {
    "x_forwarded_access_token": "x-forwarded-access-token",
    "x_forwarded_user": "x-forwarded-user",
    "x_forwarded_email": "x-forwarded-email",
    "x_databricks_catalog": "x-databricks-catalog",
}


def test_extract_user_identity_param_names_are_pinned():
    """A rename of any header param fails here — forcing EXPECTED_HEADER_NAMES + the
    verification doc to be updated together."""
    params = list(inspect.signature(extract_user_identity).parameters)
    assert params == list(EXPECTED_HEADER_NAMES), (
        "extract_user_identity header params changed. Update EXPECTED_HEADER_NAMES and "
        "docs/audit/databricks-apps-oauth-header-verification.md to match the confirmed "
        "live Databricks Apps header names."
    )


def _probe_app() -> FastAPI:
    app = FastAPI()

    @app.get("/_probe")
    def _probe(identity: UserIdentity = Depends(extract_user_identity)):
        return {
            "user_id": identity.user_id,
            "email": identity.email,
            "token_present": identity.raw_oauth_token is not None,
        }

    return app


def test_oauth_headers_bind_by_exact_name_end_to_end():
    """Real HTTP headers with the bound names must populate the identity."""
    client = TestClient(_probe_app())
    resp = client.get(
        "/_probe",
        headers={
            "x-forwarded-access-token": "tok-xyz",
            "x-forwarded-user": "user-1",
            "x-forwarded-email": "u@example.com",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_present"] is True
    assert body["user_id"] == "user-1"
    assert body["email"] == "u@example.com"


def test_wrong_header_names_do_not_populate_identity():
    """Plausible-but-wrong header names must NOT populate the token — proving the exact-name bind."""
    client = TestClient(_probe_app())
    resp = client.get(
        "/_probe",
        headers={"x-access-token": "tok-xyz", "x-user": "user-1", "x-email": "u@example.com"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_present"] is False
    assert body["user_id"] == "unknown"
    assert body["email"] is None
