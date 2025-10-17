"""Cross-source deduplication using similarity hashing and fuzzy matching."""

import hashlib
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy.orm import Session
from app.models.incident import Incident


@dataclass
class SimilarityMatch:
    """Represents a similarity match between two texts."""
    source_text: str
    target_text: str
    similarity_score: float
    similarity_hash: str
    target_incident_id: Optional[int] = None
    target_created_at: Optional[datetime] = None


class DeduplicationService:
    """Service for detecting and managing duplicate content across sources."""
    
    def __init__(self, similarity_threshold: float = 0.85):
        """Initialize deduplication service."""
        self.similarity_threshold = similarity_threshold
        self._similarity_cache: Dict[str, List[SimilarityMatch]] = {}
    
    def generate_similarity_hash(self, text: str) -> str:
        """Generate a similarity hash for text normalization."""
        # Normalize text for comparison
        normalized = self._normalize_text(text)
        
        # Generate hash
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for similarity comparison."""
        # Convert to lowercase
        text = text.lower()
        
        # Remove punctuation and special characters
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Remove common stop words that don't affect meaning
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
            'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
        }
        
        words = text.split()
        filtered_words = [word for word in words if word not in stop_words]
        
        return ' '.join(filtered_words)
    
    def find_similar_content(
        self, 
        text: str, 
        db: Session, 
        hours_back: int = 24
    ) -> List[SimilarityMatch]:
        """
        Find similar content in the database within the specified time window.
        
        Args:
            text: Text to find similar content for
            db: Database session
            hours_back: How many hours back to search for similar content
            
        Returns:
            List of similarity matches
        """
        # Generate similarity hash for the input text
        similarity_hash = self.generate_similarity_hash(text)
        
        # Check cache first
        if similarity_hash in self._similarity_cache:
            return self._similarity_cache[similarity_hash]
        
        # Calculate time window
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours_back)
        
        # Get recent incidents from database
        recent_incidents = db.query(Incident).filter(
            Incident.created_at >= cutoff_time
        ).all()
        
        matches = []
        
        for incident in recent_incidents:
            # Compare with incident title and description
            incident_text = f"{incident.title} {incident.description or ''}"
            
            # Calculate similarity
            similarity = self._calculate_similarity(text, incident_text)
            
            if similarity >= self.similarity_threshold:
                match = SimilarityMatch(
                    source_text=text,
                    target_text=incident_text,
                    similarity_score=similarity,
                    similarity_hash=similarity_hash,
                    target_incident_id=incident.id,
                    target_created_at=incident.created_at
                )
                matches.append(match)
        
        # Sort by similarity score (highest first)
        matches.sort(key=lambda x: x.similarity_score, reverse=True)
        
        # Cache results
        self._similarity_cache[similarity_hash] = matches
        
        return matches
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts using multiple methods."""
        # Normalize both texts
        norm1 = self._normalize_text(text1)
        norm2 = self._normalize_text(text2)
        
        # Skip if texts are too short after normalization
        if len(norm1.split()) < 3 or len(norm2.split()) < 3:
            return 0.0
        
        # Method 1: Sequence matcher (good for overall similarity)
        sequence_similarity = SequenceMatcher(None, norm1, norm2).ratio()
        
        # Method 2: Word overlap (good for content similarity)
        word_similarity = self._calculate_word_overlap(norm1, norm2)
        
        # Method 3: Jaccard similarity
        jaccard_similarity = self._calculate_jaccard_similarity(norm1, norm2)
        
        # Weighted combination of methods
        combined_similarity = (
            sequence_similarity * 0.4 +
            word_similarity * 0.4 +
            jaccard_similarity * 0.2
        )
        
        return combined_similarity
    
    def _calculate_word_overlap(self, text1: str, text2: str) -> float:
        """Calculate word overlap similarity."""
        words1 = set(text1.split())
        words2 = set(text2.split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def _calculate_jaccard_similarity(self, text1: str, text2: str) -> float:
        """Calculate Jaccard similarity using character n-grams."""
        # Use 3-gram character sets
        ngram_size = 3
        
        def get_ngrams(text: str, n: int) -> Set[str]:
            return set(text[i:i+n] for i in range(len(text) - n + 1))
        
        ngrams1 = get_ngrams(text1, ngram_size)
        ngrams2 = get_ngrams(text2, ngram_size)
        
        if not ngrams1 or not ngrams2:
            return 0.0
        
        intersection = ngrams1.intersection(ngrams2)
        union = ngrams1.union(ngrams2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def is_duplicate(
        self, 
        text: str, 
        db: Session, 
        hours_back: int = 24,
        min_similarity: Optional[float] = None
    ) -> bool:
        """
        Check if text is a duplicate of existing content.
        
        Args:
            text: Text to check
            db: Database session
            hours_back: How many hours back to search
            min_similarity: Minimum similarity threshold (uses default if None)
            
        Returns:
            True if duplicate found, False otherwise
        """
        threshold = min_similarity or self.similarity_threshold
        
        matches = self.find_similar_content(text, db, hours_back)
        
        return any(match.similarity_score >= threshold for match in matches)
    
    def get_best_match(
        self, 
        text: str, 
        db: Session, 
        hours_back: int = 24
    ) -> Optional[SimilarityMatch]:
        """
        Get the best similarity match for the given text.
        
        Returns:
            Best similarity match or None if no good matches found
        """
        matches = self.find_similar_content(text, db, hours_back)
        
        return matches[0] if matches else None
    
    def create_deduplication_report(
        self, 
        text: str, 
        db: Session, 
        hours_back: int = 24
    ) -> Dict[str, Any]:
        """
        Create a comprehensive deduplication report.
        
        Returns:
            Dictionary with deduplication analysis
        """
        matches = self.find_similar_content(text, db, hours_back)
        
        return {
            "input_text": text,
            "similarity_hash": self.generate_similarity_hash(text),
            "total_matches": len(matches),
            "is_duplicate": len(matches) > 0,
            "best_match": matches[0] if matches else None,
            "all_matches": [
                {
                    "incident_id": match.target_incident_id,
                    "similarity_score": match.similarity_score,
                    "created_at": match.target_created_at.isoformat() if match.target_created_at else None
                }
                for match in matches
            ],
            "similarity_threshold": self.similarity_threshold,
            "search_window_hours": hours_back
        }
    
    def clear_cache(self):
        """Clear the similarity cache."""
        self._similarity_cache.clear()
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            "cache_size": len(self._similarity_cache),
            "total_entries": sum(len(matches) for matches in self._similarity_cache.values()),
            "average_matches_per_hash": (
                sum(len(matches) for matches in self._similarity_cache.values()) / len(self._similarity_cache)
                if self._similarity_cache else 0
            )
        }


# Global deduplication service instance
_deduplication_service: Optional[DeduplicationService] = None


def get_deduplication_service(similarity_threshold: float = 0.85) -> DeduplicationService:
    """Get or create global deduplication service instance."""
    global _deduplication_service
    if _deduplication_service is None:
        _deduplication_service = DeduplicationService(similarity_threshold)
    return _deduplication_service


def check_for_duplicates(text: str, db: Session, hours_back: int = 24) -> bool:
    """Convenience function to check for duplicates."""
    service = get_deduplication_service()
    return service.is_duplicate(text, db, hours_back)
