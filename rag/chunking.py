"""
rag/chunking.py

Structure-aware chunking for machine manuals.
Designed to work well for both short manuals (~10 pages)
and large manuals (100+ pages).

Key design decisions:
- Only TOP-LEVEL numbered headings (1., 2., 9. etc.) force a hard chunk break.
- Sub-headings (2.1, 9.1.3) are allowed to stay inside a chunk.
- Recursive splitting prefers meaningful boundaries.
- Default chunk size is larger (1200) so we don't create too many tiny chunks.
"""

import re
from pypdf import PdfReader
from pdf2image import convert_from_path
import pytesseract

# If pypdf extracts fewer than this many characters from a page,
# treat it as image-only and fall back to OCR.
MIN_CHARS_TO_SKIP_OCR = 20

# Preferred split boundaries (most meaningful first)
SEPARATORS = ["\n\n", "\n", ". ", " ", ""]

# Only match TOP-LEVEL headings like:
#   1. Introduction
#   9. Technical Specifications
# Does NOT match 2.1 or 9.1.3
TOP_LEVEL_HEADING = re.compile(r"^\d+\.\s+[A-Z]")


def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extract text from PDF. Uses OCR only for pages that have almost no text.
    """
    reader = PdfReader(pdf_path)
    full_text = ""
    pages_needing_ocr = []

    for page_num, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if len(text.strip()) >= MIN_CHARS_TO_SKIP_OCR:
            full_text += text + "\n"
        else:
            full_text += f"__OCR_PLACEHOLDER_{page_num}__\n"
            pages_needing_ocr.append(page_num)

    if pages_needing_ocr:
        print(f"  {len(pages_needing_ocr)} page(s) need OCR...")
        for page_num in pages_needing_ocr:
            images = convert_from_path(
                pdf_path, first_page=page_num + 1, last_page=page_num + 1
            )
            ocr_text = pytesseract.image_to_string(images[0])
            full_text = full_text.replace(
                f"__OCR_PLACEHOLDER_{page_num}__", ocr_text.strip()
            )

    return full_text


def _split_text(text: str, separator: str) -> list[str]:
    if separator == "":
        return list(text)
    return text.split(separator)


def _recursive_split(text: str, chunk_size: int, separators: list[str]):
    """
    Recursively split text using the most meaningful separator available.
    """
    if not separators:
        return [text], ""

    separator = separators[0]
    remaining = separators[1:]
    pieces = _split_text(text, separator)

    good_pieces = []
    for piece in pieces:
        if not piece.strip():
            continue
        if len(piece) <= chunk_size:
            good_pieces.append(piece)
        elif remaining:
            sub_pieces, _ = _recursive_split(piece, chunk_size, remaining)
            good_pieces.extend(sub_pieces)
        else:
            # Last resort: just keep it (will be handled by merge logic)
            good_pieces.append(piece)

    return good_pieces, separator


def _is_top_level_heading(piece: str) -> bool:
    return bool(TOP_LEVEL_HEADING.match(piece.strip()))


def _merge_pieces(pieces: list[str], separator: str, chunk_size: int, overlap: int) -> list[str]:
    """
    Merge small pieces into larger chunks while respecting:
    - Maximum chunk size
    - Top-level section headings as hard boundaries
    - Overlap between consecutive chunks
    """
    chunks = []
    current = []
    current_len = 0

    for piece in pieces:
        piece = piece.strip()
        if not piece:
            continue

        piece_len = len(piece) + (len(separator) if current else 0)
        is_heading = _is_top_level_heading(piece)

        # Decide whether to close the current chunk
        should_break = current and (
            current_len + piece_len > chunk_size or is_heading
        )

        if should_break:
            # Save current chunk
            chunks.append(separator.join(current).strip())

            if is_heading:
                # Hard break → start completely fresh (no overlap)
                current = []
                current_len = 0
            else:
                # Soft break → keep some overlap
                while current and current_len > overlap:
                    removed = current.pop(0)
                    current_len -= len(removed) + len(separator)

        current.append(piece)
        current_len += piece_len

    # Don't forget the last chunk
    if current:
        chunks.append(separator.join(current).strip())

    # Remove any empty chunks that might have slipped through
    return [c for c in chunks if c]


def chunk_text(
    text: str,
    chunk_size: int = 1200,
    overlap: int = 150,
) -> list[str]:
    """
    Split long text into overlapping, structure-aware chunks.

    Defaults are tuned for machine manuals:
    - chunk_size=1200 → good balance of context vs. precision
    - overlap=150 → enough context without too much duplication
    - Only top-level headings force a hard break
    """
    if not text or not text.strip():
        return []

    pieces, separator = _recursive_split(text, chunk_size, SEPARATORS)
    return _merge_pieces(pieces, separator, chunk_size, overlap)