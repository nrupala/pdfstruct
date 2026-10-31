"""Hostile-fixture tests: untrusted input must fail cleanly, never hang
the process or leak a 500-with-internals to an API client.

The standing attack class for this family is parser denial of service
(crafted PDFs that loop a parser — CVE-2023-36464 in the source's
PyPDF2 was exactly that). These tests bound every attempt by the test
runner itself: a hang fails the suite by timeout in CI.
"""

from __future__ import annotations

import json

import pytest

from pdfstruct.core import extract_document
from pdfstruct.mcp_server import handle


def _write(tmp_path, name: str, data: bytes):
    p = tmp_path / name
    p.write_bytes(data)
    return p


@pytest.mark.parametrize("engine", ["pdfminer", "pypdf"])
def test_garbage_bytes_fail_cleanly(tmp_path, engine):
    bad = _write(tmp_path, "garbage.pdf", b"this is not a pdf at all" * 50)
    with pytest.raises(Exception):
        extract_document(bad, engine=engine)


@pytest.mark.parametrize("engine", ["pdfminer", "pypdf"])
def test_empty_file_fails_cleanly(tmp_path, engine):
    bad = _write(tmp_path, "empty.pdf", b"")
    with pytest.raises(Exception):
        extract_document(bad, engine=engine)


def test_truncated_pdf_fails_cleanly(tmp_path, fixture_pdf):
    data = fixture_pdf.read_bytes()[:200]
    bad = _write(tmp_path, "truncated.pdf", data)
    with pytest.raises(Exception):
        extract_document(bad, engine="pypdf")


def test_api_rejects_garbage_with_400_not_500(tmp_path):
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    from fastapi.testclient import TestClient

    from pdfstruct.api import create_app

    client = TestClient(create_app(), raise_server_exceptions=False)
    resp = client.post(
        "/extract",
        files={"file": ("garbage.pdf", b"not a pdf" * 20, "application/pdf")},
    )
    assert resp.status_code == 400
    assert "error" in resp.json()
    # no stack traces or interpreter internals in the client-facing body
    assert "Traceback" not in resp.text


def test_mcp_survives_bad_call(tmp_path):
    bad = _write(tmp_path, "garbage.pdf", b"junk" * 100)
    resp = handle({
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": "pdf_structure", "arguments": {"path": str(bad)}},
    })
    assert resp["result"]["isError"] is True
    # the server still answers the next request
    resp2 = handle({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    assert resp2["result"]["tools"]
    json.dumps(resp)
