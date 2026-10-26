"""PDFStruct core: hierarchical decomposition of a PDF into an outline tree.

Copyright © 2026 2351485 ALBERTA INC.
SPDX-License-Identifier: Apache-2.0

Lineage: this module is new code written for PDFStruct. It grows out of the
heading-parsing idea in the owner's Outcome Convergence System (OCS) book
tooling (`src/ocs/subagents/pdf_extractor.py`: a flat Chapter/Appendix/Section
regex) and the two book-era extractors in `pdfextractor_tool/` (PyPDF2 with
page markers; pdfminer.six plain text). Neither source built a tree, assigned
pages to sections, or sliced section body text — that decomposition layer is
PDFStruct's own work. See PROVENANCE.md.

Engine note: the source's PyPDF2 is unmaintained and carries
CVE-2023-36464 (infinite loop on a crafted PDF, fixed in its successor).
PDFStruct therefore runs on `pypdf` — the same library's maintained
continuation — and accepts "pypdf2" as a legacy engine alias.
"""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Optional, Sequence

__all__ = [
    "decode_value",
    "extract_pages",
    "get_metadata",
    "get_toc",
    "detect_headings",
    "build_outline",
    "build_index",
    "parse_structure",
    "extract_document",
    "OCS_CONCEPTS",
]

# The OCS book's concept list, preserved as a named preset — not a default.
OCS_CONCEPTS = [
    "outcome", "convergence", "CTST", "mechanism", "governance", "lineage",
    "context", "freshness", "attribution", "observer", "Goodhart",
    "requisite", "variety", "agency", "constraint",
]

_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in",
    "is", "it", "of", "on", "or", "that", "the", "this", "to", "with",
}

_KEYWORD_RE = re.compile(
    r"^\s*(Chapter|Appendix|Part|Section)\s+([\wIVXLCDM]+)\s*[:.\-]?\s*(.*)$",
    re.IGNORECASE,
)
_NUMBERED_RE = re.compile(r"^\s*(\d+(?:\.\d+)*)\.?\s+([A-Z][^\n]{2,100})$")


def decode_value(value: Any) -> Any:
    """Decode a PDF metadata value that may arrive as raw UTF-16 bytes."""
    if isinstance(value, bytes):
        raw = value
        for enc in ("utf-16", "utf-16-be", "utf-8"):
            try:
                return raw.decode(enc).lstrip("\ufeff").strip("\x00")
            except (UnicodeDecodeError, UnicodeError):
                continue
        return raw.decode("utf-8", "replace").lstrip("\ufeff")
    if isinstance(value, str):
        return value.lstrip("\ufeff")
    return value


# ---------------------------------------------------------------- extraction

def _pages_pypdf(path: Path) -> list[str]:
    import pypdf

    pages: list[str] = []
    with open(path, "rb") as fh:
        reader = pypdf.PdfReader(fh)
        for page in reader.pages:
            pages.append(page.extract_text() or "")
    return pages


def _pages_pdfminer(path: Path) -> list[str]:
    # Extract page by page so structure can be attributed to pages.
    from pdfminer.high_level import extract_pages
    from pdfminer.layout import LTTextContainer

    pages: list[str] = []
    for layout in extract_pages(str(path)):
        parts: list[str] = []
        for element in layout:
            if isinstance(element, LTTextContainer):
                parts.append(element.get_text())
        pages.append("".join(parts))
    return pages


def extract_pages(pdf_path: str | Path, engine: str = "pdfminer") -> list[str]:
    """Return the document's text as one string per page (1 page = 1 item)."""
    path = Path(pdf_path)
    if not path.is_file():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    if engine in ("pypdf", "pypdf2"):  # "pypdf2" = legacy alias from the OCS source
        return _pages_pypdf(path)
    if engine == "pdfminer":
        return _pages_pdfminer(path)
    raise ValueError(f"unknown engine: {engine!r} (use 'pdfminer' or 'pypdf')")


def get_metadata(pdf_path: str | Path) -> dict[str, Any]:
    """Decoded metadata plus page count, read with pypdf."""
    import pypdf

    path = Path(pdf_path)
    if not path.is_file():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    with open(path, "rb") as fh:
        reader = pypdf.PdfReader(fh)
        raw = reader.metadata
        info: dict[str, Any] = {}
        if raw is not None:
            for key in ("/Title", "/Author", "/Creator", "/Producer", "/Subject"):
                try:
                    val = raw.get(key)
                except Exception:
                    val = None
                if val is not None:
                    info[key.lstrip("/").lower()] = decode_value(val)
        return {
            "title": info.get("title"),
            "author": info.get("author"),
            "creator": info.get("creator"),
            "producer": info.get("producer"),
            "subject": info.get("subject"),
            "pages": len(reader.pages),
            "metadata": info,
        }


def get_toc(pdf_path: str | Path) -> list[dict[str, Any]]:
    """Flatten the PDF's own bookmarks/outline, with page numbers (1-based).

    Returns an empty list when the document carries no outline.
    """
    import pypdf

    path = Path(pdf_path)
    with open(path, "rb") as fh:
        reader = pypdf.PdfReader(fh)
        try:
            outline = reader.outline
        except Exception:
            return []

        flat: list[dict[str, Any]] = []

        def walk(items: Iterable[Any], level: int) -> None:
            for item in items:
                if isinstance(item, list):
                    walk(item, level + 1)
                    continue
                title = getattr(item, "title", None)
                if title is None:
                    continue
                try:
                    page = reader.get_destination_page_number(item) + 1
                except Exception:
                    page = None
                flat.append(
                    {"title": str(title).strip(), "level": level, "page": page}
                )

        walk(outline, 1)
        return flat


# ----------------------------------------------------------------- headings

def _heading_from_line(line: str) -> Optional[dict[str, Any]]:
    """Classify one line as a heading, or return None."""
    match = _KEYWORD_RE.match(line)
    if match:
        kind_word, number, rest = match.group(1), match.group(2), match.group(3)
        kind = kind_word.lower()
        title = line.strip()
        level = 2 if kind == "section" else 1
        return {"kind": kind, "level": level, "number": number, "title": title}
    match = _NUMBERED_RE.match(line)
    if match:
        number, rest = match.group(1), match.group(2).strip()
        # Reject prose that merely starts with a number: the remainder must
        # look like a title (short, no sentence-ending period mid-line,
        # at least one alphabetic word beyond a single letter).
        if len(rest) > 100 or rest.endswith(","):
            return None
        if sum(ch.isalpha() for ch in rest) < 3:
            return None
        level = min(number.count(".") + 1, 6)
        return {
            "kind": "numbered",
            "level": level,
            "number": number,
            "title": line.strip(),
        }
    return None


def detect_headings(pages: Sequence[str]) -> list[dict[str, Any]]:
    """Find headings page by page; each hit knows its page and text offset."""
    hits: list[dict[str, Any]] = []
    offset = 0  # offset into the joined document text ("\n".join(pages))
    for page_index, page_text in enumerate(pages):
        line_offset = offset
        for line in page_text.splitlines():
            found = _heading_from_line(line)
            if found is not None:
                hits.append(
                    {
                        **found,
                        "page_start": page_index + 1,
                        "offset": line_offset,
                    }
                )
            line_offset += len(line) + 1
        offset += len(page_text) + 1
    return hits


def _page_for_offset(page_spans: list[tuple[int, int]], offset: int) -> int:
    for idx, (start, end) in enumerate(page_spans):
        if start <= offset < end or (idx == len(page_spans) - 1 and offset >= start):
            return idx + 1
    return len(page_spans) or 1


def build_outline(pages: Sequence[str]) -> tuple[list[dict[str, Any]], str]:
    """Build the nested outline tree. Returns (tree, source).

    Source is "toc" when the caller's TOC entries are used by
    extract_document, otherwise "headings". This function itself works
    from detected headings; extract_document substitutes the TOC tree
    when bookmarks exist.
    """
    joined = "\n".join(pages)
    page_spans: list[tuple[int, int]] = []
    cursor = 0
    for page_text in pages:
        page_spans.append((cursor, cursor + len(page_text) + 1))
        cursor += len(page_text) + 1

    flat = detect_headings(pages)
    nodes: list[dict[str, Any]] = []
    for i, hit in enumerate(flat):
        seg_start = hit["offset"] + len(hit["title"]) + 1
        seg_end = flat[i + 1]["offset"] if i + 1 < len(flat) else len(joined)
        body = joined[seg_start:seg_end].strip()
        page_end = (
            _page_for_offset(page_spans, max(seg_start, seg_end - 1))
            if seg_end > seg_start
            else hit["page_start"]
        )
        nodes.append(
            {
                "title": hit["title"],
                "kind": hit["kind"],
                "number": hit["number"],
                "level": hit["level"],
                "page_start": hit["page_start"],
                "page_end": max(page_end, hit["page_start"]),
                "word_count": len(body.split()),
                "text": body,
                "children": [],
            }
        )
    return _nest(nodes), "headings"


def _nest(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    roots: list[dict[str, Any]] = []
    stack: list[dict[str, Any]] = []
    for node in nodes:
        while stack and stack[-1]["level"] >= node["level"]:
            stack.pop()
        if stack:
            stack[-1]["children"].append(node)
        else:
            roots.append(node)
        stack.append(node)
    return roots


def toc_outline(
    toc: Sequence[dict[str, Any]], pages: Sequence[str]
) -> list[dict[str, Any]]:
    """Build a tree from the PDF's own bookmarks, slicing text by page."""
    nodes: list[dict[str, Any]] = []
    total = len(pages)
    for i, entry in enumerate(toc):
        page_start = entry.get("page") or 1
        next_page = None
        for later in toc[i + 1 :]:
            if later.get("page"):
                next_page = later["page"]
                break
        page_end = (next_page - 1) if next_page else total
        if page_end < page_start:
            page_end = page_start
        body = "\n".join(pages[page_start - 1 : page_end]).strip()
        nodes.append(
            {
                "title": entry["title"],
                "kind": "toc",
                "number": None,
                "level": entry.get("level", 1),
                "page_start": page_start,
                "page_end": page_end,
                "word_count": len(body.split()),
                "text": body,
                "children": [],
            }
        )
    return _nest(nodes)


# -------------------------------------------------------------------- index

def build_index(
    text: str, concepts: Optional[Sequence[str]] = None
) -> dict[str, Any]:
    """Top terms (source method) plus an optional, caller-chosen concept set."""
    tokens = [t for t in re.split(r"[^A-Za-z0-9]+", text) if t]
    lowered = [t.lower() for t in tokens if t.lower() not in _STOPWORDS]
    counts = Counter(lowered)
    found: list[str] = []
    if concepts:
        present = set(lowered)
        found = [c for c in concepts if c.lower() in present]
    return {
        "concepts": found,
        "term_count": len(lowered),
        "top_terms": [term for term, _ in counts.most_common(20)],
    }


def parse_structure(text: str) -> dict[str, list[str]]:
    """Compatibility face: the source's flat chapter/appendix/section lists."""
    buckets: dict[str, list[str]] = {
        "chapters": [], "appendices": [], "sections": [],
    }
    for line in text.splitlines():
        found = _heading_from_line(line)
        if not found:
            continue
        if found["kind"] == "chapter":
            buckets["chapters"].append(found["title"])
        elif found["kind"] == "appendix":
            buckets["appendices"].append(found["title"])
        elif found["kind"] == "section":
            buckets["sections"].append(found["title"])
    return buckets


# ----------------------------------------------------------------- document

def extract_document(
    pdf_path: str | Path,
    engine: str = "pdfminer",
    concepts: Optional[Sequence[str]] = None,
) -> dict[str, Any]:
    """Decompose a PDF: text, decoded metadata, outline tree, index."""
    path = Path(pdf_path)
    if not path.is_file():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    pages = extract_pages(path, engine=engine)
    text = "\n".join(pages)
    try:
        metadata = get_metadata(path)
    except Exception:
        metadata = {"pages": len(pages), "title": None, "author": None}
    toc = []
    try:
        toc = get_toc(path)
    except Exception:
        toc = []
    if toc:
        outline = toc_outline(toc, pages)
        outline_source = "toc"
    else:
        outline, outline_source = build_outline(pages)
    return {
        "source": str(path),
        "engine": engine,
        "text": text,
        "text_length": len(text),
        "metadata": metadata,
        "outline_source": outline_source,
        "outline": outline,
        "structure": parse_structure(text),
        "index": build_index(text, concepts=concepts),
    }
