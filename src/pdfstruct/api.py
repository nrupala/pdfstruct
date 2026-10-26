"""PDFStruct local API: `pdfstruct-api` (FastAPI, localhost by default).

Copyright © 2026 2351485 ALBERTA INC.
SPDX-License-Identifier: Apache-2.0
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

try:
    from fastapi import FastAPI, File, Form, UploadFile
    from fastapi.responses import JSONResponse
except ImportError:  # pragma: no cover - exercised only without the extra
    FastAPI = None  # type: ignore

from . import __version__


def create_app():
    if FastAPI is None:
        raise ImportError(
            "Install the api extra: pip install 'pdfstruct[api]'"
        )
    from .core import extract_document

    app = FastAPI(title="PDFStruct API", version=__version__)

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "pdfstruct", "version": __version__}

    async def _load(file: UploadFile, engine: str, concepts: str | None):
        data = await file.read()
        with tempfile.TemporaryDirectory() as td:
            src = Path(td) / (file.filename or "input.pdf")
            src.write_bytes(data)
            concept_list = (
                [c.strip() for c in concepts.split(",") if c.strip()]
                if concepts else None
            )
            return extract_document(src, engine=engine, concepts=concept_list)

    @app.post("/extract")
    async def extract(
        file: UploadFile = File(...),
        engine: str = Form("pdfminer"),
        concepts: str | None = Form(None),
    ):
        try:
            doc = await _load(file, engine, concepts)
        except Exception as exc:
            return JSONResponse({"error": str(exc)}, status_code=400)
        return JSONResponse(doc)

    @app.post("/outline")
    async def outline(
        file: UploadFile = File(...),
        engine: str = Form("pdfminer"),
    ):
        try:
            doc = await _load(file, engine, None)
        except Exception as exc:
            return JSONResponse({"error": str(exc)}, status_code=400)
        return JSONResponse(
            {
                "metadata": doc["metadata"],
                "outline_source": doc["outline_source"],
                "outline": doc["outline"],
            }
        )

    return app


app = create_app() if FastAPI is not None else None


def main() -> None:
    import uvicorn

    uvicorn.run(
        create_app(),
        host=os.environ.get("PDFSTRUCT_HOST", "127.0.0.1"),
        port=int(os.environ.get("PDFSTRUCT_PORT", "8766")),
    )


if __name__ == "__main__":
    main()
