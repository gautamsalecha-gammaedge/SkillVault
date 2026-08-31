"""
wipe_chroma.py

Deletes ALL vectors in the SkillVault Chroma collection (manuals, tips,
interview-derived knowledge — everything).

Safe to run when switching to OpenAI embeddings from scratch.

Usage (from backend/):
    python wipe_chroma.py
    python wipe_chroma.py --yes   # skip confirmation prompt
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from config import CHROMA_PATH, CHROMA_COLLECTION_NAME


def wipe(force: bool = False) -> None:
    import chromadb

    path = Path(CHROMA_PATH)
    print(f"Chroma path:       {path.resolve()}")
    print(f"Collection name:   {CHROMA_COLLECTION_NAME}")

    if not force:
        reply = input(
            "This deletes ALL embeddings (manuals, tips, interviews). Type YES to continue: "
        ).strip()
        if reply != "YES":
            print("Aborted.")
            return

    client = chromadb.PersistentClient(path=str(path))
    names = [c.name for c in client.list_collections()]
    print(f"Collections found: {names or '(none)'}")

    if CHROMA_COLLECTION_NAME in names:
        client.delete_collection(CHROMA_COLLECTION_NAME)
        print(f"Deleted collection '{CHROMA_COLLECTION_NAME}'.")
    else:
        print(f"Collection '{CHROMA_COLLECTION_NAME}' not found (already empty).")

    # Optional full disk wipe so no stale index files remain
    if path.exists() and path.is_dir():
        shutil.rmtree(path)
        path.mkdir(parents=True, exist_ok=True)
        print(f"Removed on-disk folder {path.resolve()} and recreated empty dir.")

    # Recreate empty collection so the app can start cleanly
    client = chromadb.PersistentClient(path=str(path))
    client.get_or_create_collection(name=CHROMA_COLLECTION_NAME)
    print(f"Created empty collection '{CHROMA_COLLECTION_NAME}'. Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wipe all SkillVault Chroma embeddings.")
    parser.add_argument("--yes", action="store_true", help="Skip confirmation")
    args = parser.parse_args()
    wipe(force=args.yes)
