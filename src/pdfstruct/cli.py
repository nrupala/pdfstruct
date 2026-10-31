"""PDFStruct CLI: `pdfstruct <pdf>`.

Copyright © 2026 2351485 ALBERTA INC.
SPDX-License-Identifier: Apache-2.0
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .core import OCS_CONCEPTS, extract_document, get_metadata
from .outputs import write_document


def _concepts_from_args(args) -> list[str] | None:
    if getattr(args, "concepts_preset", None) == "ocs":
        return list(OCS_CONCEPTS)
    if getattr(args, "concepts", None):
        return [c.strip() for c in args.concepts.split(",") if c.strip()]
    return None


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="pdfstruct",
        description=(
            "Decompose a PDF into a hierarchical outline tree "
            "(chapters / sections, page ranges, section text) — fully local."
        ),
    )
    parser.add_argument("input", help="Input PDF file")
    parser.add_argument(
        "-o", "--output-dir", default=None,
        help="Output directory (default: extracted_<stem> next to the PDF). "
             "Honoured exactly — the OCS extract_text.py ignored its -o flag; "
             "this one does not.",
    )
    parser.add_argument(
        "--format", default="json,md,txt",
        help="Comma list of output formats: json,md,txt (default all three)",
    )
    parser.add_argument(
        "--engine", choices=["pdfminer", "pypdf", "pypdf2"], default="pdfminer",
        help="Text engine: pdfminer (default, layout-faithful) or pypdf (pypdf2 = legacy alias)",
    )
    parser.add_argument("--info", action="store_true",
                        help="Print decoded metadata incl. page count")
    parser.add_argument("--concepts", default=None,
                        help="Comma-separated concept terms to index for")
    parser.add_argument("--concepts-preset", choices=["ocs"], default=None,
                        help="Use a named concept preset (ocs = the OCS book list)")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)

    src = Path(args.input)
    if not src.is_file():
        print(f"Input file not found: {src}")
        return 1

    # Tester finding F3: a corrupt PDF must produce a clean error and
    # exit 1, never an uncaught traceback (the API already does this).
    try:
        if args.info:
            meta = get_metadata(src)
            print("PDF Metadata:")
            for key in ("pages", "title", "author", "creator", "producer"):
                print(f"- {key}: {meta.get(key)}")

        formats = [f.strip().lower() for f in args.format.split(",") if f.strip()]
        doc = extract_document(
            src, engine=args.engine, concepts=_concepts_from_args(args)
        )
    except Exception as exc:
        print(f"Error: could not decompose {src}: {exc}")
        return 1
    out_dir = (
        Path(args.output_dir)
        if args.output_dir
        else src.parent / f"extracted_{src.stem}"
    )
    try:
        written = write_document(doc, out_dir, formats=formats)
    except ValueError as exc:
        print(str(exc))
        return 2
    if not args.quiet:
        for dest in written:
            print(f"Wrote {dest}")
        print(
            f"Decomposed {doc['text_length']} characters, "
            f"{doc['metadata'].get('pages')} pages, "
            f"outline source: {doc['outline_source']}, "
            f"top-level nodes: {len(doc['outline'])}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
