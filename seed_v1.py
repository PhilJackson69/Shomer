#!/usr/bin/env python3
"""
Seed script for Shomer v1 MVP.
Runs Reddit query for "synagogue" keyword and populates the dashboard.
"""

import os
import sys
import asyncio
import httpx
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Add the API app to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'apps', 'api'))

async def seed_database():
    """Seed the database with sample data."""
    print("🌱 Starting Shomer v1 seed script...")
    
    # Configuration
    api_base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    nlp_service_url = os.getenv("NLP_SERVICE_URL", "http://localhost:8001")
    
    async with httpx.AsyncClient() as client:
        # Check if services are running
        print("🔍 Checking service health...")
        
        try:
            # Check API health
            api_response = await client.get(f"{api_base_url}/health")
            if api_response.status_code != 200:
                print("❌ API service is not healthy")
                return False
            print("✅ API service is healthy")
            
            # Check NLP service health
            nlp_response = await client.get(f"{nlp_service_url}/health")
            if nlp_response.status_code != 200:
                print("❌ NLP service is not healthy")
                return False
            print("✅ NLP service is healthy")
            
        except httpx.ConnectError:
            print("❌ Cannot connect to services. Make sure they are running:")
            print("   docker-compose -f docker-compose.v1.yml up -d")
            return False
        
        # Run Reddit scan
        print("\n🔍 Running Reddit scan for 'synagogue' keyword...")
        
        try:
            scan_response = await client.post(
                f"{api_base_url}/api/v1/digital-scan/digital-scan",
                json={
                    "keywords": ["synagogue", "jewish", "antisemitic"],
                    "subreddits": ["all", "news", "worldnews"],
                    "limit": 15
                },
                timeout=60.0
            )
            
            if scan_response.status_code == 200:
                scan_data = scan_response.json()
                print(f"✅ Reddit scan completed:")
                print(f"   - Posts analyzed: {scan_data['posts_analyzed']}")
                print(f"   - Incidents found: {scan_data['incidents_found']}")
                
                # Show some sample posts
                if scan_data['posts']:
                    print("\n📊 Sample posts found:")
                    for i, post in enumerate(scan_data['posts'][:3]):
                        print(f"   {i+1}. r/{post['subreddit']} - {post['severity'].upper()}")
                        print(f"      Score: {post['score']:.2f}")
                        print(f"      Title: {post['title'][:60]}...")
                        print()
            else:
                print(f"❌ Reddit scan failed: {scan_response.status_code}")
                print(f"   Response: {scan_response.text}")
                
        except Exception as e:
            print(f"❌ Reddit scan error: {e}")
        
        # Add some sample physical reports
        print("\n📝 Adding sample physical reports...")
        
        sample_reports = [
            {
                "title": "Suspicious activity near synagogue",
                "description": "Observed individuals taking photos of the synagogue entrance and asking questions about security measures. Behavior seemed unusual and concerning.",
                "location": "123 Main Street, New York, NY",
                "latitude": 40.7128,
                "longitude": -74.0060,
                "severity": "medium",
                "reporter_email": "community@example.com"
            },
            {
                "title": "Graffiti found on community center",
                "description": "Discovered antisemitic graffiti on the side of the Jewish Community Center. Appears to be recent based on paint condition.",
                "location": "456 Oak Avenue, Brooklyn, NY",
                "latitude": 40.6782,
                "longitude": -73.9442,
                "severity": "high",
                "reporter_email": "security@jcc.org"
            },
            {
                "title": "Threatening phone call received",
                "description": "Received threatening phone call targeting Jewish community members. Caller made specific threats about upcoming events.",
                "location": "Community Center",
                "latitude": 40.7589,
                "longitude": -73.9851,
                "severity": "critical",
                "reporter_email": "admin@community.org"
            }
        ]
        
        for i, report_data in enumerate(sample_reports):
            try:
                report_response = await client.post(
                    f"{api_base_url}/api/v1/reports/report",
                    json=report_data,
                    timeout=30.0
                )
                
                if report_response.status_code == 200:
                    print(f"✅ Sample report {i+1} added successfully")
                else:
                    print(f"❌ Failed to add sample report {i+1}: {report_response.status_code}")
                    
            except Exception as e:
                print(f"❌ Error adding sample report {i+1}: {e}")
        
        # Get final incident count
        print("\n📊 Final dashboard summary:")
        
        try:
            incidents_response = await client.get(
                f"{api_base_url}/api/v1/reports/incidents",
                timeout=30.0
            )
            
            if incidents_response.status_code == 200:
                incidents_data = incidents_response.json()
                total_incidents = len(incidents_data['incidents'])
                
                # Count by type and severity
                digital_count = sum(1 for i in incidents_data['incidents'] if i['type'] == 'digital')
                physical_count = sum(1 for i in incidents_data['incidents'] if i['type'] == 'physical')
                
                severity_counts = {}
                for incident in incidents_data['incidents']:
                    severity = incident['severity']
                    severity_counts[severity] = severity_counts.get(severity, 0) + 1
                
                print(f"   - Total incidents: {total_incidents}")
                print(f"   - Digital incidents: {digital_count}")
                print(f"   - Physical reports: {physical_count}")
                print(f"   - Severity breakdown:")
                for severity, count in severity_counts.items():
                    print(f"     * {severity.upper()}: {count}")
                
            else:
                print(f"❌ Failed to get incidents summary: {incidents_response.status_code}")
                
        except Exception as e:
            print(f"❌ Error getting incidents summary: {e}")
        
        print("\n🎉 Seed script completed!")
        print("\n📱 Next steps:")
        print("   1. Open http://localhost:3000 in your browser")
        print("   2. Click 'View Dashboard' to see the incidents")
        print("   3. Click 'Submit Report' to add more incidents")
        print("   4. Use the 'Scan Reddit' button to run more scans")
        
        return True

def main():
    """Main entry point."""
    print("🛡️ Shomer v1 MVP Seed Script")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists("docker-compose.v1.yml"):
        print("❌ Please run this script from the Shomer project root directory")
        print("   (where docker-compose.v1.yml is located)")
        sys.exit(1)
    
    # Run the seed script
    try:
        success = asyncio.run(seed_database())
        if success:
            print("\n✅ Seed script completed successfully!")
            sys.exit(0)
        else:
            print("\n❌ Seed script failed!")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⏹️ Seed script interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()


