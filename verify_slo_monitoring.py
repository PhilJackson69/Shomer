#!/usr/bin/env python3
"""Verification script for SLO monitoring deployment."""

import requests
import json
import time
import sys

def test_metrics_endpoint(base_url="http://localhost:8000"):
    """Test the metrics endpoint."""
    print("🔍 Testing metrics endpoint...")
    
    try:
        response = requests.get(f"{base_url}/api/v1/metrics", timeout=5)
        response.raise_for_status()
        
        metrics = response.text
        
        # Check for required metrics
        required_metrics = [
            "csrf_rotations_total",
            "api_fetch_retry_total", 
            "idempotency_hits_total",
            "http_write_requests_total",
            "http_responses_total"
        ]
        
        found_metrics = []
        for metric in required_metrics:
            if metric in metrics:
                found_metrics.append(metric)
        
        print(f"✅ Metrics endpoint working: {len(found_metrics)}/{len(required_metrics)} metrics found")
        
        # Check for required labels
        required_labels = ["service", "env", "cluster", "region"]
        found_labels = []
        for label in required_labels:
            if f'{label}=' in metrics:
                found_labels.append(label)
        
        print(f"✅ Labels present: {found_labels}")
        
        return len(found_metrics) == len(required_metrics) and len(found_labels) == len(required_labels)
        
    except Exception as e:
        print(f"❌ Metrics endpoint failed: {e}")
        return False

def test_prometheus_target(prometheus_url="http://localhost:9090"):
    """Test Prometheus target status."""
    print("🔍 Testing Prometheus target...")
    
    try:
        response = requests.get(f"{prometheus_url}/api/v1/targets", timeout=5)
        response.raise_for_status()
        
        data = response.json()
        targets = data.get("data", {}).get("activeTargets", [])
        
        shomer_targets = [t for t in targets if "shomer" in t.get("job", "").lower()]
        
        if shomer_targets:
            target = shomer_targets[0]
            health = target.get("health", "unknown")
            print(f"✅ Prometheus target found: {target.get('job')} - {health}")
            return health == "up"
        else:
            print("⚠️  No Shomer targets found in Prometheus")
            return False
            
    except Exception as e:
        print(f"❌ Prometheus target check failed: {e}")
        return False

def test_recording_rules(prometheus_url="http://localhost:9090"):
    """Test recording rules."""
    print("🔍 Testing recording rules...")
    
    test_queries = [
        "api:writes_sli_pct:svc_env_cluster_region",
        "api:retry_success_pct:svc_env_cluster_region",
        "api:csrf_rotations_per_min:svc_env_cluster_region"
    ]
    
    success_count = 0
    
    for query in test_queries:
        try:
            response = requests.get(f"{prometheus_url}/api/v1/query", 
                                  params={"query": query}, timeout=5)
            response.raise_for_status()
            
            data = response.json()
            result = data.get("data", {}).get("result", [])
            
            if result:
                print(f"✅ Recording rule working: {query}")
                success_count += 1
            else:
                print(f"⚠️  Recording rule empty: {query}")
                
        except Exception as e:
            print(f"❌ Recording rule failed: {query} - {e}")
    
    print(f"✅ Recording rules: {success_count}/{len(test_queries)} working")
    return success_count > 0

def test_alert_rules(prometheus_url="http://localhost:9090"):
    """Test alert rules."""
    print("🔍 Testing alert rules...")
    
    try:
        response = requests.get(f"{prometheus_url}/api/v1/rules", timeout=5)
        response.raise_for_status()
        
        data = response.json()
        groups = data.get("data", {}).get("groups", [])
        
        slo_groups = [g for g in groups if "slo" in g.get("name", "").lower()]
        
        if slo_groups:
            group = slo_groups[0]
            rules = group.get("rules", [])
            print(f"✅ SLO alert rules found: {len(rules)} rules")
            
            # Check for specific alerts
            alert_names = [r.get("name", "") for r in rules if r.get("type") == "alerting"]
            expected_alerts = [
                "ApiWritesSLOBurnCritical",
                "ApiWritesSLOBurnWarning", 
                "ApiDegradedResponsesHigh",
                "ApiFetchRetrySuccessLow"
            ]
            
            found_alerts = [name for name in expected_alerts if any(name in alert for alert in alert_names)]
            print(f"✅ Key alerts present: {found_alerts}")
            
            return len(found_alerts) >= 2
            
        else:
            print("⚠️  No SLO alert groups found")
            return False
            
    except Exception as e:
        print(f"❌ Alert rules check failed: {e}")
        return False

def generate_test_traffic(base_url="http://localhost:8000"):
    """Generate test traffic to populate metrics."""
    print("🔍 Generating test traffic...")
    
    try:
        # Try to hit a test endpoint
        response = requests.post(f"{base_url}/api/v1/test", timeout=5)
        if response.status_code == 200:
            print("✅ Test traffic generated")
            return True
        else:
            print(f"⚠️  Test endpoint returned {response.status_code}")
            return False
            
    except Exception as e:
        print(f"⚠️  Could not generate test traffic: {e}")
        return False

def main():
    """Run all verification tests."""
    print("🚀 SLO Monitoring Verification Script")
    print("=" * 50)
    
    # Test metrics endpoint
    metrics_ok = test_metrics_endpoint()
    
    # Generate some traffic
    generate_test_traffic()
    time.sleep(2)  # Wait for metrics to update
    
    # Test Prometheus components
    prometheus_ok = test_prometheus_target()
    rules_ok = test_recording_rules()
    alerts_ok = test_alert_rules()
    
    print("\n" + "=" * 50)
    print("📊 VERIFICATION SUMMARY")
    print("=" * 50)
    
    results = {
        "Metrics Endpoint": metrics_ok,
        "Prometheus Target": prometheus_ok,
        "Recording Rules": rules_ok,
        "Alert Rules": alerts_ok
    }
    
    for test, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test}: {status}")
    
    total_passed = sum(results.values())
    total_tests = len(results)
    
    print(f"\nOverall: {total_passed}/{total_tests} tests passed")
    
    if total_passed == total_tests:
        print("🎉 All systems operational!")
        return 0
    else:
        print("⚠️  Some components need attention")
        return 1

if __name__ == "__main__":
    sys.exit(main())
