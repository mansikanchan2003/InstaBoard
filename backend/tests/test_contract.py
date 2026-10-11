"""Every GET the frontend makes in api mode returns exactly what demo mode returns (seeded DB)."""

from __future__ import annotations

import pytest

from .conftest import api
from .contract import diff, load_contract, normalize

CONTRACT = load_contract()
# /me/session now describes the caller's real authenticated session instead of demo copy.
SESSION_DERIVED = {"/me/session"}


@pytest.mark.parametrize("path", sorted(set(CONTRACT) - SESSION_DERIVED))
def test_api_matches_frontend_demo_payload(client, path):
    response = client.get(api(path))
    assert response.status_code == 200, response.text
    problems = diff(normalize(path, response.json()), normalize(path, CONTRACT[path]))
    assert not problems, "\n".join(problems[:20])


def test_session_panel_describes_the_real_session(client):
    body = client.get(api("/me/session")).json()
    assert set(body) == set(CONTRACT["/me/session"])  # same shape as the demo payload
    assert body["origin"] == "testclient" and "Argon2id" in body["authMethod"]
