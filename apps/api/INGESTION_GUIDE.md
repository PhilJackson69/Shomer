# Shomer Ingestion System Guide

## Overview

The ingestion system automatically pulls content from external sources (RSS feeds, Reddit, web pages), analyzes it using the NLP module, and creates incidents for high-risk content.

## Architecture

```
┌─────────────────┐
│  Feed Sources   │
│  (RSS/Reddit)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Feed Parsers   │
│ (Rate Limited)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  NLP Scoring    │
│ (score_text)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Risk Assessment │
│ (RiskScorer)    │
└────────┬────────┘
         │
         ▼ (if > threshold)
┌─────────────────┐
│Create Incident  │
│  (status=new)   │
└─────────────────┘
```

## Components

### 1. Feed Parsers

Located in `ingestion/parsers/`:

- **RSSParser**: Parses RSS/Atom feeds
- **RedditParser**: Stub for Reddit integration (requires API setup)
- **WebParser**: Generic web pages via RSS (allow-list only)

### 2. Feed Manager

`ingestion/manager.py` - Coordinates ingestion:
- Fetches posts from all enabled feeds
- Scores each post with NLP
- Creates incidents for high-risk content
- Handles errors gracefully

### 3. Workers

`ingestion/worker.py` - RQ workers for background processing:
- Runs ingestion tasks asynchronously
- Rate-limited to avoid overwhelming sources
- Logs all runs to audit log

### 4. Scheduler

`ingestion/scheduler.py` - Periodic execution:
- Runs ingestion every N minutes (default: 5)
- Integrated with FastAPI lifespan
- Can be disabled via environment variable

## Configuration

### feeds.yaml

Main configuration file for feeds and settings:

```yaml
version: '1.0'
settings:
  risk_threshold: 50.0          # Minimum risk score to create incident
  rate_limit_per_minute: 60     # Max API calls per minute
  worker_timeout: 300           # Worker timeout in seconds
  max_posts_per_feed: 100       # Max posts to fetch per feed

feeds:
  rss:
    enabled: true
    sources:
      - name: bbc_world
        url: http://feeds.bbci.co.uk/news/world/rss.xml
        enabled: false
      - name: cnn_world
        url: http://rss.cnn.com/rss/cnn_world.rss
        enabled: false

  reddit:
    enabled: false
    sources:
      - name: worldnews
        subreddit: worldnews
        search_query: null
        enabled: false

  web:
    enabled: false
    sources: []
```

### Environment Variables

```bash
# Enable/disable scheduler
SCHEDULER_ENABLED=true

# Ingestion interval (minutes)
INGESTION_INTERVAL_MINUTES=5

# Redis URL (for RQ workers)
REDIS_URL=redis://localhost:6379
```

## Usage

### CLI Commands

#### Run Ingestion Once

```bash
# Run all feeds
python -m ingestion run_once

# Run specific feed type
python -m ingestion run_once --type rss

# Run specific feed
python -m ingestion run_once --type rss --name bbc_world
```

#### Start Worker

```bash
# Start RQ worker for background processing
python -m ingestion worker
```

### API Endpoints

All endpoints require admin authentication.

#### List All Feeds

```bash
GET /api/v1/ingestion/feeds
```

Response:
```json
{
  "rss": {
    "enabled": true,
    "sources": [
      {
        "name": "bbc_world",
        "url": "http://feeds.bbci.co.uk/news/world/rss.xml",
        "enabled": false
      }
    ]
  },
  "reddit": {...},
  "web": {...}
}
```

#### List Feeds by Type

```bash
GET /api/v1/ingestion/feeds/rss
```

#### Add Feed

```bash
POST /api/v1/ingestion/feeds/rss
Content-Type: application/json

{
  "name": "new_feed",
  "url": "https://example.com/rss",
  "enabled": true
}
```

#### Enable/Disable Feed

```bash
PUT /api/v1/ingestion/feeds/rss/bbc_world/status
Content-Type: application/json

{
  "enabled": true
}
```

#### Remove Feed

```bash
DELETE /api/v1/ingestion/feeds/rss/bbc_world
```

#### Manually Trigger Ingestion

```bash
# Run all feeds
POST /api/v1/ingestion/run

# Run specific feed
POST /api/v1/ingestion/run?feed_type=rss&feed_name=bbc_world
```

Response:
```json
{
  "job_id": "abc123",
  "status": "queued",
  "message": "Ingestion job queued successfully"
}
```

#### Get/Update Settings

```bash
GET /api/v1/ingestion/settings

PUT /api/v1/ingestion/settings
Content-Type: application/json

{
  "risk_threshold": 60.0,
  "rate_limit_per_minute": 30
}
```

## Workflow

### Automatic (Scheduled)

1. Scheduler triggers ingestion every N minutes
2. Job enqueued to RQ worker
3. Worker fetches posts from all enabled feeds
4. Each post is scored with NLP
5. High-risk posts (≥ threshold) create incidents
6. Results logged to audit log

### Manual (CLI)

```bash
# One-time run
python -m ingestion run_once

# Output:
# Starting ingestion run...
# 
# Ingestion Results:
# ================================================================================
# 
# ✓ rss:bbc_world
#   Posts fetched: 25
#   Posts scored: 25
#   Incidents created: 2
#   Duration: 12.34s
# 
# ================================================================================
# Total: 1 feeds processed
#   Posts fetched: 25
#   Posts scored: 25
#   Incidents created: 2
```

## Adding New Feeds

### RSS Feed

1. **Via API:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/ingestion/feeds/rss \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "my_news_source",
       "url": "https://example.com/rss",
       "enabled": true
     }'
   ```

2. **Via Config File:**
   Edit `feeds.yaml`:
   ```yaml
   feeds:
     rss:
       enabled: true
       sources:
         - name: my_news_source
           url: https://example.com/rss
           enabled: true
   ```

3. **Enable and Test:**
   ```bash
   python -m ingestion run_once --type rss --name my_news_source
   ```

### Reddit Feed

**Note**: Reddit parser is currently a stub. To implement:

1. Get Reddit API credentials
2. Implement authentication in `parsers/reddit_parser.py`
3. Choose approach:
   - Official Reddit API (requires OAuth)
   - Reddit RSS (limited to 25 posts)
   - Pushshift API (if available)

Example stub to real implementation:

```python
# In reddit_parser.py
import praw  # pip install praw

class RedditParser(BaseParser):
    def __init__(self, max_posts: int = 100):
        self.max_posts = max_posts
        self.reddit = praw.Reddit(
            client_id="YOUR_CLIENT_ID",
            client_secret="YOUR_SECRET",
            user_agent="Shomer/1.0"
        )
    
    async def fetch(self, source_config: dict[str, Any]) -> list[NormalizedPost]:
        subreddit_name = source_config.get("subreddit")
        subreddit = self.reddit.subreddit(subreddit_name)
        
        posts = []
        for submission in subreddit.hot(limit=self.max_posts):
            posts.append(NormalizedPost(
                source=f"reddit:{subreddit_name}",
                url=submission.url,
                title=submission.title,
                text=submission.selftext,
                published_at=datetime.fromtimestamp(submission.created_utc, tz=timezone.utc),
                author=submission.author.name if submission.author else None
            ))
        
        return posts
```

## Monitoring

### Audit Logs

All ingestion runs are logged to the audit log:

```sql
SELECT * FROM audit_logs 
WHERE action = 'ingestion_run' 
ORDER BY created_at DESC;
```

Example audit log entry:
```json
{
  "action": "ingestion_run",
  "resource_type": "feed",
  "resource_id": "rss:bbc_world",
  "details": {
    "success": true,
    "posts_fetched": 25,
    "posts_scored": 25,
    "incidents_created": 2,
    "errors": [],
    "duration_seconds": 12.34
  }
}
```

### Incidents Created

Query incidents created by ingestion:

```sql
SELECT * FROM incidents 
WHERE source LIKE 'rss:%' OR source LIKE 'reddit:%'
ORDER BY created_at DESC;
```

Each incident contains:
- `title`: Auto-generated from post title
- `description`: Full analysis with risk breakdown
- `severity`: Mapped from risk level (LOW/MEDIUM/HIGH/CRITICAL)
- `status`: Always starts as "new"
- `source`: Feed identifier (e.g., "rss:bbc_world")
- `metadata`: Contains post URL, scores, risk factors, etc.

## Troubleshooting

### No Posts Fetched

1. Check feed is enabled:
   ```bash
   python -c "from ingestion.config import IngestionConfig; print(IngestionConfig().get_all_enabled_feeds())"
   ```

2. Test feed URL manually:
   ```bash
   curl -I "http://feeds.bbci.co.uk/news/world/rss.xml"
   ```

3. Check for errors in logs

### Worker Not Processing

1. Check Redis is running:
   ```bash
   redis-cli ping
   ```

2. Check worker is running:
   ```bash
   python -m ingestion worker
   ```

3. Check queue status:
   ```python
   from redis import Redis
   from rq import Queue
   
   redis_conn = Redis.from_url("redis://localhost:6379")
   queue = Queue("ingestion", connection=redis_conn)
   print(f"Jobs: {len(queue)}")
   ```

### Rate Limiting Issues

If seeing timeouts or slow processing:

1. Increase rate limit in `feeds.yaml`:
   ```yaml
   settings:
     rate_limit_per_minute: 120  # Increase from 60
   ```

2. Or decrease max posts:
   ```yaml
   settings:
     max_posts_per_feed: 50  # Decrease from 100
   ```

### High False Positives

If too many incidents are being created:

1. Increase risk threshold:
   ```yaml
   settings:
     risk_threshold: 70.0  # Increase from 50.0
   ```

2. Tune NLP classifier weights (see NLP_MODULE_SUMMARY.md)

## Best Practices

1. **Start Conservative**: Begin with a few well-known, reliable feeds
2. **Monitor Initially**: Watch the first few runs to tune thresholds
3. **Use Allow Lists**: For web feeds, maintain strict allow lists
4. **Rate Limit**: Respect source rate limits to avoid blocking
5. **Review Incidents**: Regularly review auto-created incidents
6. **Tune Thresholds**: Adjust based on your community's needs
7. **Enable Gradually**: Don't enable all feeds at once

## Security Considerations

1. **Allow Lists**: Web parser enforces domain allow lists
2. **Rate Limiting**: Prevents overwhelming external sources
3. **Admin Only**: All management endpoints require admin role
4. **Audit Logging**: All ingestion runs are logged
5. **Sanitization**: HTML is stripped from content
6. **Validation**: URLs and content are validated before processing

## Performance

- **RSS feeds**: ~1-2 seconds per feed
- **Rate limit**: 60 requests/minute (configurable)
- **Max posts**: 100 per feed (configurable)
- **Worker timeout**: 5 minutes per job
- **Memory**: ~50MB per worker process

## Future Enhancements

- [ ] Support for X/Twitter feeds (requires API)
- [ ] Real-time Reddit integration
- [ ] Custom webhook sources
- [ ] Image analysis for visual content
- [ ] Language detection and translation
- [ ] Duplicate detection
- [ ] Source reliability scoring
- [ ] Machine learning for feed prioritization

