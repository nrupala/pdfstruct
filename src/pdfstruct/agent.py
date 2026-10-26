"""Compatibility agent face, keeping the OCS source's method names.

Copyright © 2026 2351485 ALBERTA INC.
SPDX-License-Identifier: Apache-2.0

The OCS `PDFExtractorAgent.extract()` returned a receipt only
(text_length / first_200_chars). This class keeps the four method names
(`extract`, `parse_structure`, `index`, `extract_metadata`) so OCS-era
callers have a familiar surface, but `extract` returns the full
decomposed document — that change is deliberate and documented here.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional, Sequence

from .core import build_index, extract_document, get_metadata, parse_structure


class PDFStructAgent:
    """Decompose a PDF into an outline tree, metadata, and a term index."""

    def extract(
        self,
        pdf_path: str,
        output_dir: str | None = None,
        engine: str = "pdfminer",
        concepts: Optional[Sequence[str]] = None,
    ) -> dict[str, Any]:
        doc = extract_document(pdf_path, engine=engine, concepts=concepts)
        if output_dir is not None:
            from .outputs import write_document

            written = write_document(doc, Path(output_dir), formats=("txt",))
            doc["output_path"] = written[0] if written else None
        return doc

    def parse_structure(self, text: str) -> dict[str, list[str]]:
        return parse_structure(text)

    def index(
        self, text: str, concepts: Optional[Sequence[str]] = None
    ) -> dict[str, Any]:
        return build_index(text, concepts=concepts)

    def extract_metadata(self, pdf_path: str) -> dict[str, Any]:
        try:
            return get_metadata(pdf_path)
        except Exception:
            return {}
