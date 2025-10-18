"""NLP Threat Classification Service for Shomer v1."""

import os
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Shomer NLP Service", version="1.0.0")

# Global model variables
tokenizer = None
model = None
device = None

class TextAnalysisRequest(BaseModel):
    """Request model for text analysis."""
    text: str
    source: Optional[str] = "unknown"

class TextAnalysisResponse(BaseModel):
    """Response model for text analysis."""
    text: str
    score: float
    severity: str
    confidence: float
    timestamp: datetime
    source: str

class RedditPost(BaseModel):
    """Reddit post model."""
    title: str
    content: str
    author: str
    subreddit: str
    url: str
    created_utc: float

def load_model():
    """Load the hate speech detection model."""
    global tokenizer, model, device
    
    try:
        model_name = "cardiffnlp/twitter-roberta-base-offensive"
        logger.info(f"Loading model: {model_name}")
        
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name)
        
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)
        model.eval()
        
        logger.info(f"Model loaded successfully on {device}")
        
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise

def classify_text(text: str) -> Tuple[float, str]:
    """
    Classify text for hate speech/offensive content.
    
    Returns:
        Tuple of (score, severity) where score is 0-1 and severity is low/medium/high/critical
    """
    if not tokenizer or not model:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    try:
        # Tokenize input
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Get predictions
        with torch.no_grad():
            outputs = model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=-1)
            
        # Get offensive score (class 1 is offensive)
        offensive_score = probabilities[0][1].item()
        
        # Determine severity based on score
        if offensive_score >= 0.85:
            severity = "critical"
        elif offensive_score >= 0.7:
            severity = "high"
        elif offensive_score >= 0.5:
            severity = "medium"
        else:
            severity = "low"
            
        return offensive_score, severity
        
    except Exception as e:
        logger.error(f"Error classifying text: {e}")
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """Load model on startup."""
    load_model()

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "device": str(device) if device else None
    }

@app.post("/analyze", response_model=TextAnalysisResponse)
async def analyze_text(request: TextAnalysisRequest):
    """Analyze text for hate speech/offensive content."""
    try:
        score, severity = classify_text(request.text)
        
        return TextAnalysisResponse(
            text=request.text,
            score=score,
            severity=severity,
            confidence=score,
            timestamp=datetime.utcnow(),
            source=request.source
        )
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-batch")
async def analyze_batch_texts(requests: List[TextAnalysisRequest]):
    """Analyze multiple texts in batch."""
    results = []
    
    for req in requests:
        try:
            score, severity = classify_text(req.text)
            results.append(TextAnalysisResponse(
                text=req.text,
                score=score,
                severity=severity,
                confidence=score,
                timestamp=datetime.utcnow(),
                source=req.source
            ))
        except Exception as e:
            logger.error(f"Batch analysis failed for text: {e}")
            results.append(TextAnalysisResponse(
                text=req.text,
                score=0.0,
                severity="low",
                confidence=0.0,
                timestamp=datetime.utcnow(),
                source=req.source
            ))
    
    return {"results": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

