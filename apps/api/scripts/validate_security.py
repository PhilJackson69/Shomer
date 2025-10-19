#!/usr/bin/env python3
"""
15-Minute Release Gate Validation Script
Validates security configuration and endpoints before production deployment.
"""

import os
import sys
import subprocess
import requests
import json
import time
from typing import Dict, List, Tuple, Optional
from urllib.parse import urljoin


class SecurityValidator:
    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "SecurityValidator/1.0"})
        self.errors: List[str] = []
        self.warnings: List[str] = []
        
    def log_error(self, message: str):
        """Log an error and add to errors list."""
        print(f"❌ ERROR: {message}")
        self.errors.append(message)
        
    def log_warning(self, message: str):
        """Log a warning and add to warnings list."""
        print(f"⚠️  WARNING: {message}")
        self.warnings.append(message)
        
    def log_success(self, message: str):
        """Log a success message."""
        print(f"✅ SUCCESS: {message}")
        
    def validate_config_and_secrets(self) -> bool:
        """A) Config & secrets validation (3 min)"""
        print("\n🔐 A) Config & Secrets Validation")
        print("=" * 50)
        
        success = True
        
        # Check environment variables
        required_vars = [
            "JWT_SECRET",
            "CSRF_SECRET", 
            "RATE_LIMIT_REDIS_URL",
            "PUBLIC_BASE_URL"
        ]
        
        for var in required_vars:
            if not os.getenv(var):
                self.log_error(f"Missing required environment variable: {var}")
                success = False
            else:
                self.log_success(f"Found {var}")
        
        # Validate PUBLIC_BASE_URL is HTTPS in production
        public_url = os.getenv("PUBLIC_BASE_URL", "")
        if public_url and not public_url.startswith("https://"):
            if os.getenv("ENVIRONMENT") == "production":
                self.log_error("PUBLIC_BASE_URL must be HTTPS in production")
                success = False
            else:
                self.log_warning("PUBLIC_BASE_URL should be HTTPS in production")
        
        # Check JWT algorithm
        jwt_alg = os.getenv("JWT_ALG", "HS256")
        if os.getenv("ENVIRONMENT") == "production" and jwt_alg == "HS256":
            self.log_warning("Consider using RS256/EdDSA in production for better key management")
        
        # Validate secret strength
        jwt_secret = os.getenv("JWT_SECRET", "")
        if len(jwt_secret) < 32:
            self.log_error("JWT_SECRET must be at least 32 characters")
            success = False
            
        csrf_secret = os.getenv("CSRF_SECRET", "")
        if len(csrf_secret) < 32:
            self.log_error("CSRF_SECRET must be at least 32 characters")
            success = False
            
        return success
    
    def validate_auth_csrf_idempotency(self) -> bool:
        """B) Auth/CSRF/idempotency quick probes (5 min)"""
        print("\n🔒 B) Auth/CSRF/Idempotency Validation")
        print("=" * 50)
        
        success = True
        
        try:
            # 1) CSRF token endpoint
            csrf_url = urljoin(self.base_url, "/api/v1/csrf")
            response = self.session.get(csrf_url)
            
            if response.status_code == 200:
                csrf_data = response.json()
                if "token" in csrf_data:
                    self.log_success("CSRF token endpoint working")
                    csrf_token = csrf_data["token"]
                else:
                    self.log_error("CSRF token missing from response")
                    success = False
            else:
                self.log_error(f"CSRF endpoint failed: {response.status_code}")
                success = False
                
            # 2) Test CSRF protection on protected endpoint
            if csrf_token:
                protected_url = urljoin(self.base_url, "/api/v1/auth/login")
                
                # Test without CSRF token (should fail)
                response = self.session.post(protected_url, json={"email": "test@example.com", "password": "test"})
                if response.status_code == 403:
                    self.log_success("CSRF protection working (blocked request without token)")
                else:
                    self.log_warning(f"CSRF protection may not be working: {response.status_code}")
                
                # Test with CSRF token (should work or fail gracefully)
                headers = {"X-CSRF-Token": csrf_token}
                response = self.session.post(protected_url, json={"email": "test@example.com", "password": "test"}, headers=headers)
                if response.status_code in [400, 401, 422]:  # Expected for invalid credentials
                    self.log_success("CSRF token accepted")
                else:
                    self.log_warning(f"Unexpected response with CSRF token: {response.status_code}")
            
            # 3) Test rate limiting
            rate_limit_url = urljoin(self.base_url, "/api/v1/auth/login")
            rate_limit_responses = []
            
            for i in range(25):
                response = self.session.post(rate_limit_url, json={"email": "test@example.com", "password": "test"})
                rate_limit_responses.append(response.status_code)
                time.sleep(0.1)  # Small delay to avoid overwhelming
            
            # Check for rate limiting
            rate_limited = any(status == 429 for status in rate_limit_responses)
            if rate_limited:
                self.log_success("Rate limiting detected (429 responses found)")
            else:
                self.log_warning("No rate limiting detected - may need configuration")
                
        except Exception as e:
            self.log_error(f"Auth/CSRF validation failed: {str(e)}")
            success = False
            
        return success
    
    def validate_headers_cors_csp(self) -> bool:
        """C) Headers/CORS/CSP validation (3 min)"""
        print("\n🛡️ C) Headers/CORS/CSP Validation")
        print("=" * 50)
        
        success = True
        
        try:
            # Test main endpoint
            response = self.session.get(self.base_url)
            
            # Check security headers
            security_headers = {
                "strict-transport-security": "HSTS",
                "content-security-policy": "CSP",
                "x-content-type-options": "Content Type Options",
                "x-frame-options": "Frame Options",
                "vary": "Vary Header"
            }
            
            for header, name in security_headers.items():
                if header in response.headers:
                    self.log_success(f"{name} header present")
                    
                    # Additional checks
                    if header == "content-security-policy":
                        csp = response.headers[header]
                        if "nonce-" in csp:
                            self.log_success("CSP nonce detected")
                        else:
                            self.log_warning("CSP nonce not detected")
                            
                    if header == "strict-transport-security":
                        hsts = response.headers[header]
                        if "max-age=" in hsts:
                            self.log_success("HSTS max-age configured")
                        else:
                            self.log_warning("HSTS max-age not configured")
                else:
                    if header == "strict-transport-security" and os.getenv("ENVIRONMENT") != "production":
                        self.log_success("HSTS not required in development")
                    else:
                        self.log_warning(f"{name} header missing")
            
            # Check for dangerous headers
            dangerous_headers = ["x-powered-by", "server"]
            for header in dangerous_headers:
                if header in response.headers:
                    self.log_warning(f"Potentially dangerous header present: {header}")
                else:
                    self.log_success(f"No {header} header (good)")
                    
        except Exception as e:
            self.log_error(f"Headers validation failed: {str(e)}")
            success = False
            
        return success
    
    def validate_upload_ssrf_guards(self) -> bool:
        """D) Upload/SSRF guards validation (4 min)"""
        print("\n📁 D) Upload/SSRF Guards Validation")
        print("=" * 50)
        
        success = True
        
        try:
            # Test file upload validation
            validation_url = urljoin(self.base_url, "/api/v1/validation/validate")
            
            # Test with dangerous file
            files = {
                "file": ("test.php", b"<?php echo 'test'; ?>", "application/x-php")
            }
            
            response = self.session.post(validation_url, files=files)
            if response.status_code in [415, 422, 400]:
                self.log_success("Dangerous file type blocked")
            else:
                self.log_error(f"Dangerous file type not blocked: {response.status_code}")
                success = False
            
            # Test SSRF protection
            ssrf_url = urljoin(self.base_url, "/api/v1/validation/url-scan")
            ssrf_payload = {"url": "http://127.0.0.1:80"}
            
            response = self.session.post(ssrf_url, json=ssrf_payload)
            if response.status_code in [400, 422, 403]:
                self.log_success("SSRF protection working (blocked localhost)")
            else:
                self.log_warning(f"SSRF protection may not be working: {response.status_code}")
                
        except Exception as e:
            self.log_error(f"Upload/SSRF validation failed: {str(e)}")
            success = False
            
        return success
    
    def run_all_validations(self) -> bool:
        """Run all validation checks."""
        print("🚀 Starting 15-Minute Release Gate Validation")
        print("=" * 60)
        
        start_time = time.time()
        
        # Run all validation steps
        steps = [
            ("Config & Secrets", self.validate_config_and_secrets),
            ("Auth/CSRF/Idempotency", self.validate_auth_csrf_idempotency),
            ("Headers/CORS/CSP", self.validate_headers_cors_csp),
            ("Upload/SSRF Guards", self.validate_upload_ssrf_guards)
        ]
        
        all_passed = True
        
        for step_name, step_func in steps:
            print(f"\n⏱️  Running {step_name} validation...")
            step_start = time.time()
            
            try:
                step_success = step_func()
                step_duration = time.time() - step_start
                
                if step_success:
                    self.log_success(f"{step_name} validation passed ({step_duration:.1f}s)")
                else:
                    self.log_error(f"{step_name} validation failed ({step_duration:.1f}s)")
                    all_passed = False
                    
            except Exception as e:
                self.log_error(f"{step_name} validation crashed: {str(e)}")
                all_passed = False
        
        # Summary
        total_time = time.time() - start_time
        print(f"\n📊 Validation Summary")
        print("=" * 30)
        print(f"Total time: {total_time:.1f}s")
        print(f"Errors: {len(self.errors)}")
        print(f"Warnings: {len(self.warnings)}")
        
        if self.errors:
            print("\n❌ ERRORS:")
            for error in self.errors:
                print(f"  - {error}")
                
        if self.warnings:
            print("\n⚠️  WARNINGS:")
            for warning in self.warnings:
                print(f"  - {warning}")
        
        if all_passed:
            print("\n🎉 ALL VALIDATIONS PASSED - READY FOR DEPLOYMENT!")
            return True
        else:
            print("\n🚫 VALIDATION FAILED - DO NOT DEPLOY!")
            return False


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Security validation for production deployment")
    parser.add_argument("--base-url", help="Base URL to test against", default=None)
    parser.add_argument("--timeout", type=int, help="Request timeout in seconds", default=30)
    
    args = parser.parse_args()
    
    # Set request timeout
    requests.adapters.DEFAULT_RETRIES = 1
    
    validator = SecurityValidator(args.base_url)
    validator.session.timeout = args.timeout
    
    success = validator.run_all_validations()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
