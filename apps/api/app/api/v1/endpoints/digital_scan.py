"""Digital scanning endpoint for Reddit content analysis."""

import os
import logging
from typing import List, Optional
from datetime import datetime

import praw
import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

class RedditScanRequest(BaseModel):
    """Request model for Reddit scanning."""
    keywords: List[str]
    subreddits: Optional[List[str]] = None
    limit: int = 10

class RedditPost(BaseModel):
    """Reddit post model."""
    title: str
    content: str
    author: str
    subreddit: str
    url: str
    created_utc: float
    score: float
    severity: str

class DigitalScanResponse(BaseModel):
    """Response model for digital scan."""
    posts_analyzed: int
    incidents_found: int
    posts: List[RedditPost]

def get_reddit_client():
    """Get Reddit API client."""
    try:
        reddit = praw.Reddit(
            client_id=os.getenv("REDDIT_CLIENT_ID"),
            client_secret=os.getenv("REDDIT_CLIENT_SECRET"),
            user_agent=os.getenv("REDDIT_USER_AGENT", "ShomerBot/1.0")
        )
        return reddit
    except Exception as e:
        logger.error(f"Failed to initialize Reddit client: {e}")
        raise HTTPException(status_code=500, detail="Reddit API not configured")

async def analyze_text_with_nlp(text: str) -> tuple[float, str]:
    """Analyze text using the NLP service."""
    nlp_service_url = os.getenv("NLP_SERVICE_URL", "http://localhost:8001")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{nlp_service_url}/analyze",
                json={"text": text, "source": "reddit"},
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()
            return result["score"], result["severity"]
    except Exception as e:
        logger.error(f"NLP analysis failed: {e}")
        return 0.0, "low"

async def send_slack_alert(post: RedditPost):
    """Send Slack alert for high-severity incidents."""
    slack_webhook = os.getenv("SLACK_WEBHOOK_URL")
    if not slack_webhook or post.severity not in ["high", "critical"]:
        return
    
    try:
        message = {
            "text": f"🚨 High-severity incident detected",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Severity:* {post.severity.upper()}\n*Subreddit:* r/{post.subreddit}\n*Author:* u/{post.author}\n*Score:* {post.score:.2f}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Content:* {post.content[:500]}{'...' if len(post.content) > 500 else ''}"
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "View Post"},
                            "url": post.url
                        }
                    ]
                }
            ]
        }
        
        async with httpx.AsyncClient() as client:
            await client.post(slack_webhook, json=message, timeout=10.0)
            
    except Exception as e:
        logger.error(f"Slack alert failed: {e}")

@router.post("/digital-scan", response_model=DigitalScanResponse)
async def scan_reddit_content(
    request: RedditScanRequest,
    db: Session = Depends(get_db)
):
    """Scan Reddit for antisemitic or violent content."""
    try:
        reddit = get_reddit_client()
        analyzed_posts = []
        incidents_found = 0
        
        # Default subreddits if none specified
        subreddits = request.subreddits or ["all", "news", "worldnews", "politics"]
        
        for subreddit_name in subreddits:
            try:
                subreddit = reddit.subreddit(subreddit_name)
                
                # Search for posts containing keywords
                for keyword in request.keywords:
                    search_query = f"{keyword} OR synagogue OR jewish"
                    
                    for submission in subreddit.search(
                        search_query, 
                        limit=request.limit // len(request.keywords),
                        sort="new"
                    ):
                        # Combine title and content for analysis
                        full_text = f"{submission.title} {submission.selftext}"
                        
                        # Analyze with NLP service
                        score, severity = await analyze_text_with_nlp(full_text)
                        
                        post = RedditPost(
                            title=submission.title,
                            content=submission.selftext or submission.title,
                            author=str(submission.author) if submission.author else "[deleted]",
                            subreddit=submission.subreddit.display_name,
                            url=f"https://reddit.com{submission.permalink}",
                            created_utc=submission.created_utc,
                            score=score,
                            severity=severity
                        )
                        
                        analyzed_posts.append(post)
                        
                        # Store in database if severity is medium or higher
                        if severity in ["medium", "high", "critical"]:
                            incidents_found += 1
                            
                            # Store digital incident
                            from app.models.digital_incident import DigitalIncident
                            incident = DigitalIncident(
                                text=full_text,
                                score=score,
                                severity=severity,
                                source="reddit",
                                subreddit=submission.subreddit.display_name,
                                author=str(submission.author) if submission.author else "[deleted]",
                                url=f"https://reddit.com{submission.permalink}"
                            )
                            db.add(incident)
                            
                            # Send Slack alert for high severity
                            if severity in ["high", "critical"]:
                                await send_slack_alert(post)
                        
            except Exception as e:
                logger.error(f"Error scanning subreddit {subreddit_name}: {e}")
                continue
        
        db.commit()
        
        return DigitalScanResponse(
            posts_analyzed=len(analyzed_posts),
            incidents_found=incidents_found,
            posts=analyzed_posts
        )
        
    except Exception as e:
        logger.error(f"Digital scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/digital-incidents")
async def get_digital_incidents(
    severity: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get digital incidents from database."""
    try:
        from app.models.digital_incident import DigitalIncident
        
        query = db.query(DigitalIncident)
        
        if severity:
            query = query.filter(DigitalIncident.severity == severity)
        
        incidents = query.order_by(DigitalIncident.created_at.desc()).limit(limit).all()
        
        return {
            "incidents": [
                {
                    "id": str(incident.id),
                    "text": incident.text,
                    "score": incident.score,
                    "severity": incident.severity,
                    "source": incident.source,
                    "subreddit": incident.subreddit,
                    "author": incident.author,
                    "url": incident.url,
                    "created_at": incident.created_at.isoformat()
                }
                for incident in incidents
            ]
        }
        
    except Exception as e:
        logger.error(f"Failed to get digital incidents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


