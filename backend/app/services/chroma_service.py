import logging
from typing import Optional, List, Dict

import chromadb

logger = logging.getLogger(__name__)


class ChromaDBService:
    """Handles vector storage and similarity search for RAG."""

    def __init__(self):
        self.client = chromadb.PersistentClient(path="./chroma_data")
        self.collection = self.client.get_or_create_collection(
            name="news_articles",
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(f"ChromaDB initialized. Collection has {self.collection.count()} documents.")

    async def add_article(
        self,
        article_id: str,
        embedding: List[float],
        content: str,
        metadata: Dict,
    ):
        """Add an article to the vector store."""
        try:
            self.collection.add(
                ids=[article_id],
                embeddings=[embedding],
                documents=[content],
                metadatas=[metadata],
            )
        except Exception as e:
            logger.error(f"Error adding article to ChromaDB: {e}")

    async def search(
        self,
        query_embedding: List[float],
        n_results: int = 5,
    ) -> Optional[Dict]:
        """Search for similar articles by embedding."""
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
            )
            return results
        except Exception as e:
            logger.error(f"Error searching ChromaDB: {e}")
            return None

    def get_count(self) -> int:
        """Get total number of documents in the collection."""
        return self.collection.count()


# Singleton instance
chroma_service = ChromaDBService()
