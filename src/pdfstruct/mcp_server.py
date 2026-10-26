"""PDFStruct MCP server (stdio, JSON-RPC, no MCP SDK dependency).

Copyright © 2026 2351485 ALBERTA INC.
SPDX-License-Identifier: Apache-2.0

Tools: pdf_outline / pdf_structure / pdf_metadata.
"""

from __future__ import annotations

import json
import sys

from . import __version__
from .core import extract_document, get_metadata

TOOLS = [
    {
        "name": "pdf_outline",
        "description": "Hierarchical outline tree (titles, levels, page ranges) for a local PDF",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "engine": {"type": "string", "enum": ["pdfminer", "pypdf", "pypdf2"], "default": "pdfminer"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "pdf_structure",
        "description": "Full decomposition of a local PDF: outline tree with section text, metadata, term index",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "engine": {"type": "string", "enum": ["pdfminer", "pypdf", "pypdf2"], "default": "pdfminer"},
                "concepts": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["path"],
        },
    },
    {
        "name": "pdf_metadata",
        "description": "Decoded metadata incl. page count for a local PDF",
        "inputSchema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
]


def call_tool(name, args):
    if name == "pdf_metadata":
        return get_metadata(args["path"])
    if name == "pdf_outline":
        doc = extract_document(args["path"], engine=args.get("engine", "pdfminer"))
        return {
            "metadata": doc["metadata"],
            "outline_source": doc["outline_source"],
            "outline": doc["outline"],
        }
    if name == "pdf_structure":
        return extract_document(
            args["path"],
            engine=args.get("engine", "pdfminer"),
            concepts=args.get("concepts"),
        )
    raise ValueError(f"unknown tool {name}")


def handle(req):
    method = req.get("method")
    rid = req.get("id")
    if method == "initialize":
        return {
            "jsonrpc": "2.0", "id": rid,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "pdfstruct", "version": __version__},
            },
        }
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": rid, "result": {"tools": TOOLS}}
    if method == "tools/call":
        params = req.get("params") or {}
        try:
            result = call_tool(params.get("name"), params.get("arguments") or {})
            return {
                "jsonrpc": "2.0", "id": rid,
                "result": {
                    "content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}],
                    "isError": False,
                },
            }
        except Exception as exc:
            return {
                "jsonrpc": "2.0", "id": rid,
                "result": {
                    "content": [{"type": "text", "text": str(exc)}],
                    "isError": True,
                },
            }
    if rid is not None:
        return {"jsonrpc": "2.0", "id": rid,
                "error": {"code": -32601, "message": "method not found"}}
    return None


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue
        resp = handle(req)
        if resp is not None:
            print(json.dumps(resp), flush=True)


if __name__ == "__main__":
    main()
