"""Output writers: .json (full tree), .md (nested outline), .txt (plain).

Copyright © 2026 2351485 ALBERTA INC.
SPDX-License-Identifier: Apache-2.0
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable


def _public(doc: dict) -> dict:
    return doc


def write_json(doc: dict, path: Path) -> None:
    Path(path).write_text(
        json.dumps(_public(doc), ensure_ascii=False, indent=2), encoding="utf-8"
    )


def write_txt(doc: dict, path: Path) -> None:
    Path(path).write_text(doc.get("text", ""), encoding="utf-8")


def _render_node(lines: list[str], node: dict, depth: int) -> None:
    hashes = "#" * min(2 + node.get("level", 1), 6)
    pages = f" (p. {node.get('page_start')}–{node.get('page_end')})"
    lines.append(f"{hashes} {node.get('title', '')}{pages}")
    lines.append("")
    if node.get("text"):
        lines.append(node["text"])
        lines.append("")
    for child in node.get("children", []):
        _render_node(lines, child, depth + 1)


def write_md(doc: dict, path: Path) -> None:
    meta = doc.get("metadata") or {}
    title = meta.get("title") or Path(doc.get("source", "document")).stem
    lines = [f"# {title}", ""]
    if meta.get("author"):
        lines.append(f"- Author: {meta['author']}")
    lines.append(f"- Pages: {meta.get('pages')}")
    lines.append(f"- Outline source: {doc.get('outline_source')}")
    lines.append("")
    if doc.get("outline"):
        for node in doc["outline"]:
            _render_node(lines, node, 0)
    else:
        lines += ["## Text", "", doc.get("text", "")]
    Path(path).write_text("\n".join(lines), encoding="utf-8")


WRITERS = {"json": write_json, "md": write_md, "txt": write_txt}
EXTENSIONS = {"json": ".json", "md": ".md", "txt": ".txt"}


def write_document(
    doc: dict, out_dir: Path, formats: Iterable[str] = ("json", "md", "txt")
) -> list[str]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(doc.get("source", "document")).stem
    written: list[str] = []
    for fmt in formats:
        if fmt not in WRITERS:
            raise ValueError(f"unknown format: {fmt!r}")
        dest = out_dir / f"{stem}{EXTENSIONS[fmt]}"
        WRITERS[fmt](doc, dest)
        written.append(str(dest))
    return written
