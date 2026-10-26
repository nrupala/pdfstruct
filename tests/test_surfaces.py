import json
from pathlib import Path

from pdfstruct import cli
from pdfstruct.mcp_server import TOOLS, handle


def test_cli_honours_output_dir(fixture_pdf_no_toc, tmp_path):
    """Regression: the OCS extract_text.py parsed -o and ignored it."""
    out = tmp_path / "chosen"
    rc = cli.main([str(fixture_pdf_no_toc), "-o", str(out), "--format", "json,md"])
    assert rc == 0
    assert (out / "plain_book.json").is_file()
    assert (out / "plain_book.md").is_file()
    doc = json.loads((out / "plain_book.json").read_text(encoding="utf-8"))
    assert doc["outline_source"] == "headings"
    md = (out / "plain_book.md").read_text(encoding="utf-8")
    assert "Chapter 1 Alpha" in md


def test_cli_default_output_dir(fixture_pdf_no_toc):
    rc = cli.main([str(fixture_pdf_no_toc), "--quiet"])
    assert rc == 0
    default_dir = Path(fixture_pdf_no_toc).parent / "extracted_plain_book"
    assert (default_dir / "plain_book.txt").is_file()


def test_cli_missing_file():
    assert cli.main(["nope.pdf"]) == 1


def test_mcp_tools_and_calls(fixture_pdf):
    names = [t["name"] for t in TOOLS]
    assert names == ["pdf_outline", "pdf_structure", "pdf_metadata"]
    resp = handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    assert resp["result"]["tools"][0]["name"] == "pdf_outline"
    resp = handle({
        "jsonrpc": "2.0", "id": 2, "method": "tools/call",
        "params": {"name": "pdf_metadata", "arguments": {"path": str(fixture_pdf)}},
    })
    payload = json.loads(resp["result"]["content"][0]["text"])
    assert payload["pages"] == 4
    resp = handle({
        "jsonrpc": "2.0", "id": 3, "method": "tools/call",
        "params": {"name": "pdf_outline", "arguments": {"path": str(fixture_pdf)}},
    })
    payload = json.loads(resp["result"]["content"][0]["text"])
    assert payload["outline_source"] == "toc"


def test_api_health_and_outline(fixture_pdf):
    pytest = __import__("pytest")
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    from fastapi.testclient import TestClient

    from pdfstruct.api import create_app

    client = TestClient(create_app())
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["service"] == "pdfstruct"
    with open(fixture_pdf, "rb") as fh:
        resp = client.post("/outline", files={"file": ("sample_book.pdf", fh, "application/pdf")})
    assert resp.status_code == 200
    assert resp.json()["outline_source"] == "toc"
    with open(fixture_pdf, "rb") as fh:
        resp = client.post("/extract", files={"file": ("sample_book.pdf", fh, "application/pdf")})
    assert resp.status_code == 200
    assert resp.json()["metadata"]["pages"] == 4
