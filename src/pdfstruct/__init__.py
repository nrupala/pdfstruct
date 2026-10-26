"""PDFStruct — hierarchical decomposition of PDFs into outline trees.

Copyright © 2026 2351485 ALBERTA INC.
SPDX-License-Identifier: Apache-2.0
"""

from .core import (
    OCS_CONCEPTS,
    build_index,
    build_outline,
    decode_value,
    detect_headings,
    extract_document,
    extract_pages,
    get_metadata,
    get_toc,
    parse_structure,
)

__version__ = "0.1.0"

__all__ = [
    "OCS_CONCEPTS",
    "build_index",
    "build_outline",
    "decode_value",
    "detect_headings",
    "extract_document",
    "extract_pages",
    "get_metadata",
    "get_toc",
    "parse_structure",
    "__version__",
]
