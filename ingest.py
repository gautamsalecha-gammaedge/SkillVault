"""
ingest.py

Run this to load a PDF manual into the knowledge base for one machine.

What it does, in plain steps:
1. Reads a PDF file and pulls out all the text.
2. Cuts that text into small overlapping chunks (so search results are
   focused, not whole pages, and don't lose context at chunk edges).
3. Turns each chunk into an "embedding" (a list of numbers representing meaning).
4. Saves each chunk + its embedding into Chroma, tagged with the machine_id
   AND which manual file it came from - this is what lets multiple
   different manuals coexist safely under the same machine_id.

Why chunk IDs include the filename:
Chroma's upsert() replaces any existing chunk that has the same ID. The
old scheme (f"{machine_id}-manual-{i}") only used a bare counter, so
ingesting a second, different PDF for the same machine_id would silently
overwrite the first PDF's chunks one by one (chunk 0 replaces chunk 0,
etc.) - corrupting the knowledge base into a mixed-up mess of both files.
Including the filename in the ID makes each file's chunks land at their
own unique IDs, so different manuals never collide.

Usage:
    python ingest.py path/to/manual.pdf CNC-204
"""

import re
import sys
from pathlib import Path

from rag.embeddings import embed_text
from rag.chroma_store import collection, delete_manual
from rag.chunking import extract_text_from_pdf, chunk_text


def slugify_filename(filename: str) -> str:
    """Turns a filename into a safe string for use inside a Chroma ID (letters, numbers, - and _ only)."""
    stem = Path(filename).stem
    return re.sub(r"[^a-zA-Z0-9_-]", "-", stem)


def ingest_pdf(pdf_path: str, machine_id: str, filename: str = None, override: bool = True) -> int:
    """
    Loads one PDF into the knowledge base for one machine.

    filename: the display name to tag this manual with (defaults to the
              PDF's own filename on disk). This is what's shown when
              listing manuals, and what's used to identify this exact
              manual later for override or delete.
    override: if True (default), any existing chunks already tagged with
              this same machine_id + filename are deleted first, so
              re-ingesting the same file cleanly replaces the old version
              instead of duplicating it or mixing old and new chunks
              together.

    Returns the number of chunks created.
    """
    if filename is None:
        filename = Path(pdf_path).name

    if override:
        removed = delete_manual(machine_id, filename)
        if removed:
            print(f"Removed {removed} existing chunks for '{filename}' before re-ingesting.")

    print(f"Reading {pdf_path} ...")
    full_text = extract_text_from_pdf(pdf_path)

    print("Splitting into chunks ...")
    chunks = chunk_text(full_text)
    print(f"Created {len(chunks)} chunks.")

    safe_name = slugify_filename(filename)

    print("Embedding and saving each chunk ...")
    for i, chunk in enumerate(chunks):
        embedding = embed_text(chunk, task_type="RETRIEVAL_DOCUMENT")
        collection.upsert(
            ids=[f"{machine_id}-{safe_name}-chunk-{i}"],
            embeddings=[embedding],
            documents=[chunk],
            metadatas=[{
                "machine_id": machine_id,
                "source_type": "manual",
                "status": "approved",
                "manual_filename": filename,
            }],
        )
        print(f"  Saved chunk {i + 1}/{len(chunks)}")

    print(f"Done. '{filename}' is now searchable for machine: {machine_id}")
    return len(chunks)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python ingest.py <path_to_pdf> <machine_id>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    machine_id = sys.argv[2]
    ingest_pdf(pdf_path, machine_id)