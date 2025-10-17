"""Ingestion admin endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.ingestion import (
    FeedConfig,
    FeedListResponse,
    FeedStatusUpdate,
    IngestionJobResponse,
)
from ingestion.config import IngestionConfig
from ingestion.worker import enqueue_ingestion

router = APIRouter()


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/feeds", response_model=dict[str, Any])
async def list_feeds(
    current_user: User = Depends(require_admin),
) -> dict[str, Any]:
    """
    List all configured feeds.

    Requires admin role.
    """
    config = IngestionConfig()
    all_feeds = config.get_all_enabled_feeds()

    # Get all feeds including disabled
    result = {}
    for feed_type in ["rss", "reddit", "web"]:
        feeds_config = config._config.get("feeds", {}).get(feed_type, {})
        sources = feeds_config.get("sources", [])
        result[feed_type] = {
            "enabled": feeds_config.get("enabled", False),
            "sources": sources,
        }

    return result


@router.get("/feeds/{feed_type}", response_model=FeedListResponse)
async def list_feeds_by_type(
    feed_type: str,
    current_user: User = Depends(require_admin),
) -> FeedListResponse:
    """
    List feeds of a specific type.

    Requires admin role.
    """
    if feed_type not in ["rss", "reddit", "web"]:
        raise HTTPException(status_code=400, detail="Invalid feed type")

    config = IngestionConfig()
    feeds_config = config._config.get("feeds", {}).get(feed_type, {})
    sources = feeds_config.get("sources", [])

    return FeedListResponse(
        feed_type=feed_type,
        feeds=[FeedConfig(**source) for source in sources],
    )


@router.post("/feeds/{feed_type}", response_model=dict[str, str])
async def add_feed(
    feed_type: str,
    feed_config: FeedConfig,
    current_user: User = Depends(require_admin),
) -> dict[str, str]:
    """
    Add a new feed.

    Requires admin role.
    """
    if feed_type not in ["rss", "reddit", "web"]:
        raise HTTPException(status_code=400, detail="Invalid feed type")

    config = IngestionConfig()

    # Validate feed config based on type
    if feed_type in ["rss", "web"] and not feed_config.url:
        raise HTTPException(status_code=400, detail="URL required for RSS/web feeds")
    if feed_type == "reddit" and not feed_config.subreddit:
        raise HTTPException(status_code=400, detail="Subreddit required for Reddit feeds")

    # Add feed
    success = config.add_feed(feed_type, feed_config.model_dump(exclude_none=True))

    if success:
        return {"message": f"Feed {feed_config.name} added successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to add feed")


@router.put("/feeds/{feed_type}/{feed_name}/status", response_model=dict[str, str])
async def update_feed_status(
    feed_type: str,
    feed_name: str,
    status_update: FeedStatusUpdate,
    current_user: User = Depends(require_admin),
) -> dict[str, str]:
    """
    Enable or disable a feed.

    Requires admin role.
    """
    if feed_type not in ["rss", "reddit", "web"]:
        raise HTTPException(status_code=400, detail="Invalid feed type")

    config = IngestionConfig()

    if status_update.enabled:
        success = config.enable_feed(feed_type, feed_name)
        action = "enabled"
    else:
        success = config.disable_feed(feed_type, feed_name)
        action = "disabled"

    if success:
        return {"message": f"Feed {feed_name} {action} successfully"}
    else:
        raise HTTPException(status_code=404, detail="Feed not found")


@router.delete("/feeds/{feed_type}/{feed_name}", response_model=dict[str, str])
async def remove_feed(
    feed_type: str,
    feed_name: str,
    current_user: User = Depends(require_admin),
) -> dict[str, str]:
    """
    Remove a feed.

    Requires admin role.
    """
    if feed_type not in ["rss", "reddit", "web"]:
        raise HTTPException(status_code=400, detail="Invalid feed type")

    config = IngestionConfig()
    success = config.remove_feed(feed_type, feed_name)

    if success:
        return {"message": f"Feed {feed_name} removed successfully"}
    else:
        raise HTTPException(status_code=404, detail="Feed not found")


@router.post("/run", response_model=IngestionJobResponse)
async def run_ingestion(
    feed_type: str | None = None,
    feed_name: str | None = None,
    current_user: User = Depends(require_admin),
) -> IngestionJobResponse:
    """
    Manually trigger ingestion run.

    Requires admin role.

    Args:
        feed_type: Optional feed type to run
        feed_name: Optional specific feed to run

    Returns:
        Job information
    """
    try:
        job = enqueue_ingestion(feed_type=feed_type, feed_name=feed_name)

        return IngestionJobResponse(
            job_id=job.id,
            status="queued",
            message=f"Ingestion job queued successfully",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enqueue job: {str(e)}")


@router.get("/settings", response_model=dict[str, Any])
async def get_settings(
    current_user: User = Depends(require_admin),
) -> dict[str, Any]:
    """
    Get ingestion settings.

    Requires admin role.
    """
    config = IngestionConfig()
    return config._config.get("settings", {})


@router.put("/settings", response_model=dict[str, str])
async def update_settings(
    settings: dict[str, Any],
    current_user: User = Depends(require_admin),
) -> dict[str, str]:
    """
    Update ingestion settings.

    Requires admin role.
    """
    config = IngestionConfig()
    config._config["settings"].update(settings)
    config.save()

    return {"message": "Settings updated successfully"}

