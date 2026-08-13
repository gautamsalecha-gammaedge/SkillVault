"""
ingest.py

Run this ONCE per machine manual to load it into the knowledge base.

What it does, in plain steps:
1. Reads a PDF file and pulls out all the text.
2. Cuts that text into small overlapping chunks (so search results are
   focused, not whole pages, and don't lose context at chunk edges).
3. Turns each chunk into an "embedding" (a list of numbers representing meaning).
4. Saves each chunk + its embedding into Chroma, tagged with the machine_id.

Usage:
    python ingest.py path/to/manual.pdf CNC-204
"""

import sys

from rag.embeddings import embed_text
from rag.chroma_store import collection
from rag.chunking import extract_text_from_pdf, chunk_text


def ingest_pdf(pdf_path: str, machine_id: str):
    print(f"Reading {pdf_path} ...")
    full_text = extract_text_from_pdf(pdf_path)

    print("Splitting into chunks ...")
    chunks = chunk_text(full_text)
    print(f"Created {len(chunks)} chunks.")

    print("Embedding and saving each chunk ...")
    for i, chunk in enumerate(chunks):
        embedding = embed_text(chunk, task_type="RETRIEVAL_DOCUMENT")
        collection.upsert(
            ids=[f"{machine_id}-manual-{i}"],
            embeddings=[embedding],
            documents=[chunk],
            metadatas=[{
                "machine_id": machine_id,
                "source_type": "manual",
                "status": "approved",
            }],
        )
        print(f"  Saved chunk {i + 1}/{len(chunks)}")

    print("Done. Manual is now searchable for machine:", machine_id)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python ingest.py <path_to_pdf> <machine_id>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    machine_id = sys.argv[2]
    ingest_pdf(pdf_path, machine_id)