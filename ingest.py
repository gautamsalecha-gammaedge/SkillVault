"""
ingest.py

Run this ONCE per machine manual to load it into the knowledge base.

What it does, in plain steps:
1. Reads a PDF file and pulls out all the text.
2. Cuts that text into small chunks (so search results are focused, not whole pages).
3. Turns each chunk into an "embedding" (a list of numbers representing meaning).
4. Saves each chunk + its embedding into Chroma, tagged with the machine_id.

Usage:
    python ingest.py path/to/manual.pdf CNC-204
"""

import sys
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pypdf import PdfReader
import chromadb

# --- Setup ---
load_dotenv()  # reads GEMINI_API_KEY from your .env file
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# Chroma will create a local folder called "chroma_db" to store everything.
# This is your RAG database — no external server needed.
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="skillvault_knowledge")


def extract_text_from_pdf(pdf_path: str) -> str:
    """Reads a PDF and returns all its text as one big string."""
    reader = PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"
    return full_text


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    """
    Cuts a long string into overlapping chunks.
    chunk_size = roughly how many characters per chunk.
    overlap = how much chunks share, so we don't lose context at the edges.
    """
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks


def embed_text(text: str) -> list[float]:
    """Turns a piece of text into a vector (list of numbers) using Gemini's embedding model."""
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
    )
    return result.embeddings[0].values


def ingest_pdf(pdf_path: str, machine_id: str):
    print(f"Reading {pdf_path} ...")
    full_text = extract_text_from_pdf(pdf_path)

    print("Splitting into chunks ...")
    chunks = chunk_text(full_text)
    print(f"Created {len(chunks)} chunks.")

    print("Embedding and saving each chunk ...")
    for i, chunk in enumerate(chunks):
        embedding = embed_text(chunk)
        collection.add(
            ids=[f"{machine_id}-manual-{i}"],
            embeddings=[embedding],
            documents=[chunk],
            metadatas=[{
                "machine_id": machine_id,
                "source_type": "manual",
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