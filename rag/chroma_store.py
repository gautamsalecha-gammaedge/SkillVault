"""
rag/chroma_store.py

Sets up the single Chroma collection used for all knowledge - manual
chunks (source_type: "manual") and worker-submitted tips
(source_type: "worker_input"). Approval state lives on the "status"
metadata tag ("pending" / "approved"), not as separate collections.
"""

import chromadb

from config import CHROMA_PATH, CHROMA_COLLECTION_NAME

chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = chroma_client.get_or_create_collection(name=CHROMA_COLLECTION_NAME)