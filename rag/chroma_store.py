"""
rag/chroma_store.py

Sets up the single Chroma collection used for all knowledge - manual
chunks (source_type: "manual") and worker-submitted tips
(source_type: "worker_input"). Approval state lives on the "status"
metadata tag ("pending" / "approved"), not as separate collections.

Also holds helper functions for managing manuals specifically - listing
which manuals exist for a machine, and deleting one manual's chunks
cleanly (used for admin manual management and for override-on-re-ingest).
"""

import chromadb

from config import CHROMA_PATH, CHROMA_COLLECTION_NAME

chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = chroma_client.get_or_create_collection(name=CHROMA_COLLECTION_NAME)


def list_manuals(machine_id: str) -> list[dict]:
    """
    Returns every distinct manual filename ingested for one machine,
    with how many chunks each one has. Chunks with no manual_filename
    tag (from before this field existed) are grouped under "unknown".
    """
    results = collection.get(
        where={
            "$and": [
                {"machine_id": machine_id},
                {"source_type": "manual"},
            ]
        }
    )

    counts: dict[str, int] = {}
    for metadata in results["metadatas"]:
        filename = metadata.get("manual_filename", "unknown")
        counts[filename] = counts.get(filename, 0) + 1

    return [{"filename": f, "chunk_count": c} for f, c in counts.items()]


def delete_manual(machine_id: str, filename: str) -> int:
    """
    Deletes every chunk belonging to one manual file, for one machine.
    Returns how many chunks were actually deleted (0 if nothing matched).
    """
    existing = collection.get(
        where={
            "$and": [
                {"machine_id": machine_id},
                {"manual_filename": filename},
            ]
        }
    )
    ids_to_delete = existing["ids"]
    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
    return len(ids_to_delete)