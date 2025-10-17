"""NLP endpoints for text classification and risk scoring."""

import os
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.db.base import get_db
from app.models.user import User
from app.schemas.nlp import TextScoreRequest, TextScoreResponse
from shomer_nlp import score_text, enhanced_score_text, check_for_duplicates, normalize_confidence
from shomer_nlp.risk_scorer import RiskScorer

router = APIRouter()

# Global risk scorer instance
risk_scorer = RiskScorer()

# Use enhanced classifier if available
USE_ENHANCED_CLASSIFIER = os.getenv("USE_ENHANCED_NLP", "true").lower() == "true"


@router.post("/score", response_model=TextScoreResponse)
async def score_text_endpoint(
    request: TextScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> TextScoreResponse:
    """
    Score text for threats, hate speech, and calculate risk score.

    This endpoint combines content classification with contextual risk factors
    to produce a comprehensive risk assessment. Uses enhanced classifier if available.

    Args:
        request: Text scoring request with content and optional context
        db: Database session for deduplication checks
        current_user: Current authenticated user

    Returns:
        Classification results and risk score
    """
    try:
        # Check for duplicates if enabled
        is_duplicate = False
        if USE_ENHANCED_CLASSIFIER:
            is_duplicate = check_for_duplicates(request.text, db, hours_back=24)
        
        # Get classification results using enhanced or standard classifier
        if USE_ENHANCED_CLASSIFIER:
            classification = enhanced_score_text(request.text)
            
            # Normalize confidence scores
            context = {
                "text_length": len(request.text),
                "keyword_density": len(request.text.split()) / max(1, len(request.text.split())),
                "source_reliability": 1.0,  # Could be based on source
                "hour": request.timestamp.hour if request.timestamp else 12
            }
            
            classification["confidence"] = normalize_confidence(
                classification.get("confidence", 0.5),
                model_type="enhanced_classifier",
                context=context
            )
        else:
            classification = score_text(request.text)
            classification["confidence"] = 0.5  # Default confidence for basic classifier

        # Calculate risk score with context
        risk_result = risk_scorer.calculate_risk_score(
            text=request.text,
            threat_prob=classification["threat_prob"],
            hate_prob=classification["hate_prob"],
            risk_factors=classification["risk_factors"],
            timestamp=request.timestamp,
            detected_locations=request.detected_locations,
            user_id=request.user_id,
            previous_warnings=request.previous_warnings,
            previous_incidents=request.previous_incidents,
        )

        # Add enhanced features to response if available
        response_data = {
            "threat_prob": classification["threat_prob"],
            "hate_prob": classification["hate_prob"],
            "risk_factors": classification["risk_factors"],
            "risk_score": risk_result["risk_score"],
            "risk_level": risk_result["risk_level"],
            "breakdown": risk_result["breakdown"],
            "confidence": classification.get("confidence", 0.5),
            "is_duplicate": is_duplicate,
            "classifier_type": "enhanced" if USE_ENHANCED_CLASSIFIER else "basic"
        }

        return TextScoreResponse(**response_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scoring text: {str(e)}")


@router.post("/score/enhanced")
async def enhanced_score_endpoint(
    request: TextScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> dict:
    """
    Enhanced scoring endpoint with full analysis including deduplication and confidence.
    
    Returns comprehensive analysis including similarity hashing, context analysis,
    and detailed confidence scoring.
    """
    try:
        # Use enhanced classifier
        classification = enhanced_score_text(request.text)
        
        # Check for duplicates
        from shomer_nlp.deduplication import get_deduplication_service
        dedup_service = get_deduplication_service()
        duplicate_report = dedup_service.create_deduplication_report(request.text, db)
        
        # Normalize confidence
        context = {
            "text_length": len(request.text),
            "keyword_density": classification.get("context_analysis", {}).get("word_count", 0) / max(1, len(request.text.split())),
            "source_reliability": 1.0,
            "hour": request.timestamp.hour if request.timestamp else 12
        }
        
        normalized_confidence = normalize_confidence(
            classification.get("confidence", 0.5),
            model_type="enhanced_classifier",
            context=context
        )
        
        return {
            "classification": classification,
            "duplicate_analysis": duplicate_report,
            "normalized_confidence": normalized_confidence,
            "context": context,
            "enhanced_features": {
                "similarity_hash": classification.get("similarity_hash"),
                "ml_predictions": classification.get("ml_predictions", {}),
                "context_analysis": classification.get("context_analysis", {})
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in enhanced scoring: {str(e)}")


@router.get("/health")
async def health_check() -> dict:
    """Health check endpoint for NLP service."""
    return {
        "status": "healthy", 
        "service": "nlp",
        "enhanced_classifier": USE_ENHANCED_CLASSIFIER,
        "features": {
            "deduplication": True,
            "confidence_normalization": True,
            "ml_models": USE_ENHANCED_CLASSIFIER
        }
    }

