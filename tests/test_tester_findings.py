"""Regression tests for the independent tester's findings (2026-10-30).

F1: prose starting "Chapter <word>..." became a phantom chapter.
F2: year-led prose ("2024 Was a very good year...") became an L1 heading.
F3: the CLI dumped an uncaught traceback on a corrupt PDF.
F4: node text included the heading line in TOC mode, excluded it in
    heading mode.
"""

from __future__ import annotations

import pytest

from pdfstruct import cli
from pdfstruct.core import build_outline, detect_headings, extract_document

PROSE_PAGES = [
    "Chapter 1 Real Beginnings\nThe opening body text is here.\n"
    "Chapter three body text.\nMore body follows the sentence.\n",
    "2024 Was a very good year for the whole team at home\n"
    "2.3.4 Genuine Subsection Heading\nSubsection body text.\n",
]


def test_f1_prose_chapter_sentence_is_not_a_heading():
    hits = detect_headings(PROSE_PAGES)
    titles = [h["title"] for h in hits]
    assert "Chapter three body text." not in titles
    assert any(t.startswith("Chapter 1") for t in titles)


def test_f2_year_led_prose_is_not_a_heading():
    hits = detect_headings(PROSE_PAGES)
    titles = [h["title"] for h in hits]
    assert not any(t.startswith("2024") for t in titles)
    # the genuine numbered heading on the same page still parses
    assert any(t.startswith("2.3.4") for t in titles)


def test_f1_f2_tree_keeps_real_chapter_words():
    tree, _ = build_outline(PROSE_PAGES)
    chapter = tree[0]
    assert chapter["title"].startswith("Chapter 1")
    assert chapter["word_count"] > 0


def test_f3_cli_corrupt_pdf_is_clean_error(tmp_path, capsys):
    bad = tmp_path / "corrupt.pdf"
    bad.write_bytes(b"this is not a pdf" * 20)
    rc = cli.main([str(bad)])
    assert rc == 1
    out = capsys.readouterr().out
    assert "Traceback" not in out
    assert "Error" in out


@pytest.mark.parametrize("engine", ["pdfminer", "pypdf"])
def test_f4_toc_node_text_excludes_own_heading(fixture_pdf, engine):
    doc = extract_document(fixture_pdf, engine=engine)
    assert doc["outline_source"] == "toc"
    chapter = doc["outline"][0]
    assert chapter["title"].startswith("Chapter 1")
    assert not chapter["text"].startswith("Chapter 1 Foundations")
