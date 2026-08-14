"""
cleanup_legacy_chunks.py

One-time cleanup script. Removes manual chunks that predate the
manual_filename metadata field (from before the multi-manual upload
feature existed) - these are leftover from running the old ingest.py
via the CLI, before chunks were tagged with which file they came from.

They show up in GET /admin/manuals as "unknown", but that's just a
display fallback - they don't actually have manual_filename set to
the string "unknown", they're missing the field entirely. That's why
DELETE /admin/manual?filename=unknown returns 404: it searches for an
exact metadata match that was never written. This script finds chunks
missing the field directly instead, and removes them.

Usage:
    python cleanup_legacy_chunks.py CNC-204
"""

import sys

from rag.chroma_store import collection


def cleanup_legacy_chunks(machine_id: str) -> int:
    results = collection.get(
        where={
            "$and": [
                {"machine_id": machine_id},
                {"source_type": "manual"},
            ]
        }
    )

    legacy_ids = [
        chunk_id for chunk_id, metadata in zip(results["ids"], results["metadatas"])
        if "manual_filename" not in metadata
    ]

    if legacy_ids:
        collection.delete(ids=legacy_ids)

    return len(legacy_ids)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python cleanup_legacy_chunks.py <machine_id>")
        sys.exit(1)

    removed = cleanup_legacy_chunks(sys.argv[1])
    print(f"Removed {removed} legacy (untagged) manual chunks for machine: {sys.argv[1]}")