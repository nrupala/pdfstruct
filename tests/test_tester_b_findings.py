"""Regression tests for the adversarial tester's findings (2026-10-30).

B-1 HIGH: API upload filename traversal -> arbitrary file overwrite.
B-2 MEDIUM: decompression bomb killed the default engine by OOM.
B-3 MEDIUM: MCP server died on non-object JSON messages.
B-4 LOW: bookmarks deeper than pypdf's limit were lost silently.
Extension: unused activeTab permission; 400s misreported as unreachable.
"""

from __future__ import annotations

import json
import subprocess
import sys
import zlib
from pathlib import Path

import pytest

import pdfstruct.core as core
from pdfstruct.core import check_inflation, extract_document, get_toc_detailed


# --------------------------------------------------------------- B-1

def test_b1_api_filename_traversal_cannot_escape(tmp_path, fixture_pdf):
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient

    from pdfstruct.api import create_app

    client = TestClient(create_app())
    data = Path(fixture_pdf).read_bytes()
    sentinel = tmp_path / "evil.pdf"
    resp = client.post(
        "/outline",
        files={"file": (f"../evil.pdf", data, "application/pdf")},
    )
    assert resp.status_code == 200
    assert not sentinel.exists()
    resp = client.post(
        "/outline",
        files={"file": (str(sentinel), data, "application/pdf")},
    )
    assert resp.status_code == 200
    assert not sentinel.exists()


# --------------------------------------------------------------- B-2

def _bomb_pdf(path: Path, inflated: bytes) -> None:
    comp = zlib.compress(inflated)
    stream = b"<< /Length " + str(len(comp)).encode() + b" >>\nstream\n" + comp + b"\nendstream"
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
        stream,
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode()
    path.write_bytes(bytes(out))


def test_b2_inflation_guard_refuses_bomb(tmp_path, monkeypatch):
    bomb = tmp_path / "bomb.pdf"
    _bomb_pdf(bomb, b"A" * (5 * 1024 * 1024))
    monkeypatch.setattr(core, "MAX_INFLATED_BYTES", 1024 * 1024)
    with pytest.raises(ValueError, match="inflate beyond"):
        check_inflation(bomb)
    with pytest.raises(ValueError, match="inflate beyond"):
        extract_document(bomb)


def test_b2_normal_pdf_passes_guard(fixture_pdf):
    check_inflation(fixture_pdf)  # must not raise


# --------------------------------------------------------------- B-3

def _mcp_session(lines: list[str]) -> list[str]:
    proc = subprocess.run(
        [sys.executable, "-m", "pdfstruct.mcp_server"],
        input="\n".join(lines) + "\n",
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert proc.returncode == 0, proc.stderr
    return [ln for ln in proc.stdout.splitlines() if ln.strip()]


def test_b3_mcp_survives_non_object_json():
    out = _mcp_session([
        "123",
        '"hello"',
        "null",
        "[1,2,3]",
        '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
    ])
    errors = [json.loads(ln) for ln in out if '"-32600"' in ln or "-32600" in ln]
    assert len(errors) >= 3
    tool_lists = [json.loads(ln) for ln in out if '"tools"' in ln]
    assert tool_lists and tool_lists[-1]["id"] == 1


def test_b3_mcp_batch_array_answers_each():
    out = _mcp_session([
        '[{"jsonrpc":"2.0","id":9,"method":"tools/list"},'
        '{"jsonrpc":"2.0","id":10,"method":"initialize"}]',
    ])
    assert len(out) == 1
    batch = json.loads(out[0])
    assert isinstance(batch, list)
    assert {resp["id"] for resp in batch} == {9, 10}


# --------------------------------------------------------------- B-4

def test_b4_deep_bookmarks_warn_instead_of_silent_loss(tmp_path):
    pypdf = pytest.importorskip("pypdf")
    writer = pypdf.PdfWriter()
    for _ in range(2):
        writer.add_blank_page(612, 792)
    parent = None
    for i in range(150):
        parent = writer.add_outline_item(f"L{i}", 0, parent=parent)
    deep = tmp_path / "deep.pdf"
    with open(deep, "wb") as fh:
        writer.write(fh)
    flat, warning = get_toc_detailed(deep)
    assert flat == []
    assert warning is not None and "bookmarks unreadable" in warning
    doc = extract_document(deep)
    assert doc["warnings"] and "bookmarks unreadable" in doc["warnings"][0]


# --------------------------------------------------------------- extension

EXT = Path(__file__).resolve().parents[1] / "extension"


def test_extension_has_no_active_tab_permission():
    manifest = json.loads((EXT / "manifest.json").read_text())
    assert "activeTab" not in manifest.get("permissions", [])
    assert not manifest.get("permissions")


def test_extension_popup_distinguishes_api_400_and_times_out():
    js = (EXT / "popup.js").read_text()
    assert "could not read that PDF" in js
    assert "AbortController" in js
