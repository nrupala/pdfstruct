import json

import pytest

from pdfstruct.core import (
    build_index,
    build_outline,
    decode_value,
    detect_headings,
    extract_document,
    get_metadata,
    get_toc,
    parse_structure,
)

PAGES = [
    "Chapter 1 Foundations\nOutcome text about governance and context.\n",
    "1.1 Scope and Limits\nScope body with lineage.\n",
    "Chapter 2 Mechanisms\nMechanism body.\nAppendix A Tables\nTable body.\n",
]


def test_decode_value_utf16_bytes():
    raw = "Sample Book".encode("utf-16")
    assert decode_value(raw) == "Sample Book"
    assert decode_value("plain") == "plain"
    assert decode_value(None) is None


def test_detect_headings_kinds_and_pages():
    hits = detect_headings(PAGES)
    kinds = [(h["kind"], h["page_start"]) for h in hits]
    assert ("chapter", 1) in kinds
    assert ("numbered", 2) in kinds
    assert ("chapter", 3) in kinds
    assert ("appendix", 3) in kinds


def test_build_outline_nests_and_slices():
    tree, source = build_outline(PAGES)
    assert source == "headings"
    titles = [n["title"] for n in tree]
    assert titles[0].startswith("Chapter 1")
    chapter1 = tree[0]
    assert chapter1["level"] == 1
    assert chapter1["page_start"] == 1
    assert any(ch["title"].startswith("1.1") for ch in chapter1["children"])
    section = chapter1["children"][0]
    assert "Scope body" in section["text"]
    assert section["word_count"] > 0
    assert section["page_start"] == 2


def test_parse_structure_compat_face():
    text = "\n".join(PAGES)
    buckets = parse_structure(text)
    assert len(buckets["chapters"]) == 2
    assert len(buckets["appendices"]) == 1


def test_build_index_concepts_opt_in():
    text = "Outcome convergence needs governance. Cats sleep."
    plain = build_index(text)
    assert plain["concepts"] == []
    assert plain["term_count"] > 0
    with_concepts = build_index(text, concepts=["outcome", "governance", "absent"])
    assert with_concepts["concepts"] == ["outcome", "governance"]


def test_metadata_and_toc_from_fixture(fixture_pdf):
    meta = get_metadata(fixture_pdf)
    assert meta["pages"] == 4
    assert meta["title"] == "Sample Book"
    assert meta["author"] == "A. Author"
    toc = get_toc(fixture_pdf)
    toc_titles = [e["title"] for e in toc]
    assert "Chapter 1 Foundations" in toc_titles
    assert any(e["level"] == 2 for e in toc)


@pytest.mark.parametrize("engine", ["pypdf", "pdfminer"])
def test_extract_document_prefers_toc(fixture_pdf, engine):
    doc = extract_document(fixture_pdf, engine=engine)
    assert doc["outline_source"] == "toc"
    assert doc["metadata"]["pages"] == 4
    top = [n["title"] for n in doc["outline"]]
    assert any(t.startswith("Chapter 1") for t in top)
    # serialisable end to end
    json.dumps(doc)


@pytest.mark.parametrize("engine", ["pypdf", "pdfminer"])
def test_extract_document_headings_fallback(fixture_pdf_no_toc, engine):
    doc = extract_document(fixture_pdf_no_toc, engine=engine)
    assert doc["outline_source"] == "headings"
    titles = [n["title"] for n in doc["outline"]]
    assert any(t.startswith("Chapter 1") for t in titles)


def test_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        extract_document("does-not-exist.pdf")
