"""Simple test script to verify metrics endpoint."""

import os
import sys
from prometheus_client import Counter, generate_latest

# Set environment variables for testing
os.environ["API_SECRET_KEY"] = "test-secret-key"
os.environ["POSTGRES_USER"] = "test"
os.environ["POSTGRES_PASSWORD"] = "test"
os.environ["POSTGRES_DB"] = "test"
os.environ["DATABASE_URL"] = "postgresql://test:test@localhost/test"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET"] = "test-jwt-secret"

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "apps", "api"))

try:
    from app.core.metrics import get_metrics_collector
    
    # Initialize metrics collector
    collector = get_metrics_collector()
    
    # Record some test metrics
    collector.record_csrf_rotation()
    collector.record_api_fetch_retry("success")
    collector.record_idempotency_hit()
    collector.record_http_write_request("POST")
    collector.record_http_response("POST", "200", "0")
    
    # Get metrics
    metrics = collector.get_metrics()
    
    print("✅ Metrics endpoint working!")
    print("\n📊 Sample metrics:")
    print(metrics[:1000] + "..." if len(metrics) > 1000 else metrics)
    
    # Check for required labels
    required_labels = ["service", "env", "cluster", "region"]
    found_labels = []
    for label in required_labels:
        if f'{label}=' in metrics:
            found_labels.append(label)
    
    print(f"\n🏷️  Labels found: {found_labels}")
    if len(found_labels) == len(required_labels):
        print("✅ All required labels present!")
    else:
        missing = set(required_labels) - set(found_labels)
        print(f"⚠️  Missing labels: {missing}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
