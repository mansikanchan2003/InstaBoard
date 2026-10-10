"""Every GET the frontend makes in api mode returns exactly what demo mode returns (seeded DB)."""

from __future__ import annotations

import pytest

from .conftest import api
from .contract import diff, load_contract, normalize

CONTRACT = load_contract()


@pytest.mark.parametrize("path", sorted(CONTRACT))
def test_api_matches_frontend_demo_payload(client, path):
    response = client.get(api(path))
    assert response.status_code == 200, response.text
    problems = diff(normalize(path, response.json()), normalize(path, CONTRACT[path]))
    assert not problems, "\n".join(problems[:20])
