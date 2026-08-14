"""
rag/chunking.py

The "ingestion" half of the RAG pipeline: turning a raw PDF into clean,
overlapping text chunks ready to be embedded. Kept separate so this
logic is reusable beyond just the ingest.py script.

Extraction has two paths per page:
1. Normal text extraction (pypdf) - fast, used whenever a page has real,
   embedded text (the vast majority of digitally-produced manuals).
2. OCR fallback (Tesseract, via pytesseract) - used only for pages where
   pypdf found little or no text, which usually means the page is a
   scanned image (a photo/scan of a paper manual) rather than real text.
   Without this fallback, such pages would silently contribute nothing
   to the knowledge base - not an error, just quietly missing data.

Chunking is structure-aware rather than a blind character-count cut:
it tries to split on paragraph breaks first, then sentence breaks, then
word breaks, and only falls back to raw characters if nothing else
works. This keeps sentences, warnings, and label/value pairs from
tables intact instead of slicing through the middle of them.

On top of that, merging respects numbered section headings (e.g.
"9. Technical Specifications") as a hard boundary - a new section never
gets merged into the same chunk as whatever unrelated content came
before it, even if there's still room left under chunk_size. Without
this, unrelated sections (e.g. a maintenance note + the specs table +
the start of a tooling guide) could get blended into one chunk purely
because they fit under the character limit - which dilutes that
chunk's embedding and can cause a section-specific question (like
"what's the max spindle speed") to miss its own answer in retrieval,
even though the text is genuinely stored.
"""

import re

from pypdf import PdfReader
from pdf2image import convert_from_path
import pytesseract

# If pypdf extracts fewer than this many characters from a page, treat it
# as likely image-only and fall back to OCR instead. A real text page
# with barely any content is rare in a machine manual; a low count is a
# much stronger signal of "this page is actually an image."
MIN_CHARS_TO_SKIP_OCR = 20

# Boundaries tried in order, most meaningful first: paragraph break, line
# break, sentence break, word break, and finally raw characters as a
# last resort if nothing else can split a piece down to size.
SEPARATORS = ["\n\n", "\n", ". ", " ", ""]

# Matches numbered section headings like "9. Technical Specifications",
# "2.1 General Safety", "10.1 Recommended Tool Types" - one or more
# digit groups separated by dots, optionally a trailing dot, then a
# capitalized word. Used to force a chunk break before a new section
# starts, regardless of how much room is left in the current chunk.
HEADING_PATTERN = re.compile(r"^\d+(\.\d+)*\.?\s+[A-Z]")


def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Reads a PDF and returns all its text as one big string.
    Pages with real embedded text use normal extraction. Pages that come
    back empty or near-empty are assumed to be scanned/image-only, and
    are OCR'd instead so their content isn't silently lost.
    """
    reader = PdfReader(pdf_path)
    full_text = ""
    pages_needing_ocr = []

    for page_num, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and len(text.strip()) >= MIN_CHARS_TO_SKIP_OCR:
            full_text += text + "\n"
        else:
            full_text += f"__OCR_PLACEHOLDER_{page_num}__\n"
            pages_needing_ocr.append(page_num)

    if pages_needing_ocr:
        print(f"  {len(pages_needing_ocr)} page(s) had little/no extractable text - running OCR ...")
        for page_num in pages_needing_ocr:
            images = convert_from_path(pdf_path, first_page=page_num + 1, last_page=page_num + 1)
            ocr_text = pytesseract.image_to_string(images[0])
            full_text = full_text.replace(f"__OCR_PLACEHOLDER_{page_num}__", ocr_text.strip())

    return full_text


def _split_text(text, separator):
    if separator == "":
        return list(text)
    return text.split(separator)


def _recursive_split(text, chunk_size, separators):
    separator = separators[0]
    remaining_separators = separators[1:]

    pieces = _split_text(text, separator)

    good_pieces = []
    for piece in pieces:
        if len(piece) <= chunk_size:
            good_pieces.append(piece)
        elif remaining_separators:
            sub_pieces, _ = _recursive_split(piece, chunk_size, remaining_separators)
            good_pieces.extend(sub_pieces)
        else:
            good_pieces.append(piece)  # nothing left to split on, accept as-is

    return good_pieces, separator


def _looks_like_heading(piece: str) -> bool:
    return bool(HEADING_PATTERN.match(piece.strip()))


def _merge_pieces(pieces, separator, chunk_size, overlap):
    chunks = []
    current = []
    current_len = 0

    for piece in pieces:
        piece_len = len(piece) + len(separator)
        is_new_section = _looks_like_heading(piece)

        # Break the current chunk if it's full, OR if this piece starts a
        # new numbered section - a heading always starts a fresh chunk,
        # even when there's still room left, so sections never blend.
        should_break = current and (current_len + piece_len > chunk_size or is_new_section)

        if should_break:
            chunks.append(separator.join(current))

            # Trim from the front to build the overlap for the next chunk,
            # keeping only enough trailing pieces to cover `overlap` chars.
            # Skipped when breaking on a heading - a new section shouldn't
            # carry overlap from the unrelated section before it.
            if not is_new_section:
                while current and current_len > overlap:
                    removed = current.pop(0)
                    current_len -= len(removed) + len(separator)
            else:
                current = []
                current_len = 0

        current.append(piece)
        current_len += piece_len

    if current:
        chunks.append(separator.join(current))

    return chunks


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    """
    Cuts a long string into overlapping chunks, splitting on the most
    meaningful boundary available (paragraph, then line, then sentence,
    then word, then raw characters as a last resort) rather than blindly
    cutting every N characters regardless of what's there. Also never
    merges across a numbered section heading, so unrelated sections stay
    in separate chunks even when they'd otherwise fit together.
    """
    pieces, separator = _recursive_split(text, chunk_size, SEPARATORS)
    return _merge_pieces(pieces, separator, chunk_size, overlap)