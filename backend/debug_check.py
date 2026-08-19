from rag.embeddings import embed_text
from rag.chroma_store import collection

question_embedding = embed_text("What is the maximum spindle speed?")

results = collection.query(
    query_embeddings=[question_embedding],
    n_results=4,
    where={"$and": [{"machine_id": "CNC-204"}, {"status": "approved"}]},
)

for i, doc in enumerate(results["documents"][0]):
    print(f"--- Result {i+1} ---")
    print(doc[:200])
    print()


results = collection.get(where={"$and": [{"machine_id": "CNC-204"}, {"source_type": "manual"}]})
print(f"Total manual chunks: {len(results['ids'])}")
print(f"Unique IDs: {len(set(results['ids']))}")