"""
rag/chunking.py

The "ingestion" half of the RAG pipeline: turning a raw PDF into clean,
overlapping text chunks ready to be embedded. Kept separate so this
logic is reusable beyond just the ingest.py script.
"""

from pypdf import PdfReader


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
    overlap = how much consecutive chunks share, so we don't lose context
    right at the boundary between one chunk and the next.
    """
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks