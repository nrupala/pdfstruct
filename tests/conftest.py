"""Build a small fixture PDF with known headings and bookmarks.

Dev-only fixture generation (reportlab). The product itself never
depends on reportlab.
"""

from __future__ import annotations

import pytest


@pytest.fixture(scope="session")
def fixture_pdf(tmp_path_factory):
    reportlab = pytest.importorskip("reportlab")
    from reportlab.lib.pagesizes import LETTER
    from reportlab.pdfgen import canvas

    path = tmp_path_factory.mktemp("fx") / "sample_book.pdf"
    c = canvas.Canvas(str(path), pagesize=LETTER)
    c.setTitle("Sample Book")
    c.setAuthor("A. Author")

    def heading(text, key):
        c.bookmarkPage(key)
        c.addOutlineEntry(text, key, level=0, closed=False)
        c.drawString(72, 720, text)

    def body(lines):
        y = 690
        for line in lines:
            c.drawString(72, y, line)
            y -= 20

    heading("Chapter 1 Foundations", "ch1")
    body(["Outcome convergence begins with a desired state.",
          "Governance keeps the mechanism honest."])
    c.showPage()
    c.bookmarkPage("s11")
    c.addOutlineEntry("1.1 Scope and Limits", "s11", level=1, closed=False)
    c.drawString(72, 720, "1.1 Scope and Limits")
    body(["This section defines the scope of the system.",
          "Context and lineage are recorded for every cycle."])
    c.showPage()
    heading("Chapter 2 Mechanisms", "ch2")
    body(["A mechanism transforms the current state.",
          "Assessment compares outcome against the contract."])
    c.showPage()
    c.drawString(72, 720, "Appendix A Tables")
    body(["Reference tables for the worked examples."])
    c.showPage()
    c.save()
    return path


@pytest.fixture(scope="session")
def fixture_pdf_no_toc(tmp_path_factory):
    """Same shape, no bookmarks — heading detection must do the work."""
    from reportlab.lib.pagesizes import LETTER
    from reportlab.pdfgen import canvas

    path = tmp_path_factory.mktemp("fx2") / "plain_book.pdf"
    c = canvas.Canvas(str(path), pagesize=LETTER)
    c.setTitle("Plain Book")
    c.drawString(72, 720, "Chapter 1 Alpha")
    c.drawString(72, 680, "Alpha body text about outcomes.")
    c.showPage()
    c.drawString(72, 720, "Section 1 Background")
    c.drawString(72, 680, "Background body text about context.")
    c.showPage()
    c.save()
    return path
