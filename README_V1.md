# 🛡️ Shomer v1 MVP

**AI-Powered Community Safety Platform**

Shomer v1 is an MVP that detects antisemitic or violent content online and displays verified digital + physical incidents on a dashboard.

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Reddit API credentials (optional, for Reddit scanning)
- Slack webhook URL (optional, for alerts)
- Mapbox access token (optional, for map functionality)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd shomer
cp env.example .env
```

### 2. Configure Environment

Edit `.env` file with your API keys:

```bash
# Required for Reddit scanning
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

# Required for Slack alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Required for map functionality
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token
```

### 3. Start Services

```bash
docker-compose -f docker-compose.v1.yml up --build
```

This starts:
- **PostgreSQL** database on `localhost:5432`
- **Redis** cache on `localhost:6379`
- **NLP Service** on `localhost:8001` (hate speech detection)
- **FastAPI API** on `localhost:8000`
- **Next.js Web** on `localhost:3000`

### 4. Seed Data

```bash
python seed_v1.py
```

This will:
- Run a Reddit scan for "synagogue" keyword
- Add sample physical incident reports
- Populate the dashboard with test data

### 5. Access the Application

- **Web Interface**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **NLP Service**: http://localhost:8001/docs

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js Web   │────│  FastAPI API    │────│   PostgreSQL   │
│   (Frontend)    │    │   (Backend)     │    │   (Database)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   NLP Service   │
                       │ (Hate Speech)   │
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Reddit API    │
                       │   (Content)     │
                       └─────────────────┘
```

## 📊 Features

### Digital Threat Detection
- **Reddit Scanning**: Monitors Reddit for antisemitic content
- **AI Classification**: Uses `cardiffnlp/twitter-roberta-base-offensive` model
- **Severity Scoring**: 0-1 scale with low/medium/high/critical levels
- **Real-time Alerts**: Slack notifications for high-severity incidents

### Physical Incident Reporting
- **Community Reports**: Secure form for incident submission
- **Location Mapping**: GPS coordinates and address support
- **Severity Classification**: Community-driven severity assessment
- **Status Tracking**: Open → Investigating → Resolved → Closed

### Dashboard
- **Interactive Map**: Mapbox integration with incident markers
- **Incident List**: Real-time feed of digital + physical incidents
- **Severity Indicators**: Color-coded severity levels
- **Source Tracking**: Reddit posts and community reports

## 🔧 API Endpoints

### Digital Scanning
- `POST /api/v1/digital-scan/digital-scan` - Scan Reddit for threats
- `GET /api/v1/digital-scan/digital-incidents` - Get digital incidents

### Physical Reports
- `POST /api/v1/reports/report` - Submit physical incident report
- `GET /api/v1/reports/physical-reports` - Get physical reports
- `GET /api/v1/reports/incidents` - Get all incidents (combined)

### NLP Service
- `POST /services/nlp/analyze` - Analyze text for hate speech
- `POST /services/nlp/analyze-batch` - Batch text analysis

## 🗄️ Database Schema

### Digital Incidents
```sql
CREATE TABLE digital_incidents (
    id UUID PRIMARY KEY,
    text TEXT NOT NULL,
    score FLOAT NOT NULL,
    severity TEXT NOT NULL,
    source TEXT DEFAULT 'reddit',
    subreddit TEXT,
    author TEXT,
    url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Physical Reports
```sql
CREATE TABLE physical_reports (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT,
    latitude FLOAT,
    longitude FLOAT,
    severity TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    reporter_email TEXT,
    reporter_phone TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🚨 Alert System

### Slack Integration
- **Trigger**: Severity >= 0.85 (high/critical)
- **Content**: Incident details, source links, severity level
- **Format**: Rich Slack blocks with action buttons

### Alert Types
- **Digital**: Reddit posts with high hate speech scores
- **Physical**: Community reports marked as high/critical severity

## 🧪 Testing

### Manual Testing
1. **Reddit Scan**: Click "Scan Reddit" button on dashboard
2. **Report Submission**: Submit test incident via `/report` page
3. **Map Interaction**: Click markers to view incident details
4. **Slack Alerts**: Check Slack for high-severity notifications

### API Testing
```bash
# Test Reddit scan
curl -X POST http://localhost:8000/api/v1/digital-scan/digital-scan \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["synagogue"], "limit": 5}'

# Test incident report
curl -X POST http://localhost:8000/api/v1/reports/report \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Incident", "description": "Test description", "severity": "medium"}'
```

## 🔒 Security

- **Input Validation**: Pydantic schemas for all API inputs
- **SQL Injection Protection**: SQLAlchemy ORM
- **XSS Protection**: React auto-escaping
- **CORS Configuration**: Restricted origins
- **Environment Variables**: No hardcoded secrets

## 📈 Monitoring

### Health Checks
- API: `GET /health`
- NLP Service: `GET /health`
- Database: PostgreSQL health check
- Redis: Redis ping check

### Logging
- Structured logging with request IDs
- Error tracking and debugging
- Performance monitoring

## 🚀 Deployment

### Production Considerations
1. **Environment Variables**: Update all secrets
2. **Database**: Use managed PostgreSQL service
3. **Redis**: Use managed Redis service
4. **NLP Service**: Consider GPU instances for better performance
5. **Monitoring**: Add application monitoring (Sentry, etc.)
6. **SSL**: Configure HTTPS certificates
7. **Rate Limiting**: Implement API rate limits

### Scaling
- **Horizontal**: Multiple API instances behind load balancer
- **Vertical**: Increase NLP service memory for larger models
- **Caching**: Redis for API response caching
- **CDN**: Static asset delivery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: GitHub Issues
- **Documentation**: This README
- **API Docs**: http://localhost:8000/docs

---

**Built with ❤️ for community safety**


