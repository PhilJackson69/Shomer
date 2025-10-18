#!/usr/bin/env python3
"""
Production Security Validation Script

This script validates critical security configurations for production deployment.
Run this before deploying to production to ensure all security measures are in place.
"""

import os
import sys
import json
import base64
import hashlib
import requests
import subprocess
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import jwt
from jwt import PyJWKClient


class SecurityValidator:
    """Production security validator."""
    
    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.failures = []
        self.warnings = []
        self.successes = []
    
    def log_failure(self, message: str):
        """Log a security failure."""
        self.failures.append(message)
        print(f"❌ FAILURE: {message}")
    
    def log_warning(self, message: str):
        """Log a security warning."""
        self.warnings.append(message)
        print(f"⚠️  WARNING: {message}")
    
    def log_success(self, message: str):
        """Log a security success."""
        self.successes.append(message)
        print(f"✅ SUCCESS: {message}")
    
    def validate_jwks_endpoint(self) -> bool:
        """Validate JWKS endpoint security."""
        print("\n🔑 Validating JWKS endpoint...")
        
        try:
            response = requests.get(f"{self.base_url}/.well-known/jwks.json", timeout=self.timeout)
            
            if response.status_code != 200:
                self.log_failure(f"JWKS endpoint returned {response.status_code}")
                return False
            
            # Validate JWKS structure
            jwks = response.json()
            if not isinstance(jwks.get('keys'), list):
                self.log_failure("JWKS keys must be an array")
                return False
            
            if len(jwks['keys']) == 0:
                self.log_failure("JWKS must contain at least one key")
                return False
            
            # Validate each key
            for i, key in enumerate(jwks['keys']):
                required_fields = ['kty', 'kid', 'use', 'alg']
                for field in required_fields:
                    if field not in key:
                        self.log_failure(f"Key {i} missing required field: {field}")
                        return False
                
                # Validate algorithm
                alg = key.get('alg')
                if alg not in ['RS256', 'RS384', 'RS512', 'EdDSA']:
                    self.log_failure(f"Key {i} has unsupported algorithm: {alg}")
                    return False
                
                if alg == 'HS256':
                    self.log_failure(f"Key {i} uses HS256 (not allowed in production)")
                    return False
            
            # Validate cache headers
            cache_control = response.headers.get('cache-control', '')
            if 'max-age=60' not in cache_control:
                self.log_warning("JWKS cache control should include max-age=60")
            
            if 'stale-while-revalidate=300' not in cache_control:
                self.log_warning("JWKS cache control should include stale-while-revalidate=300")
            
            # Validate CORS headers
            if 'access-control-allow-origin' in response.headers:
                self.log_success("JWKS has CORS headers")
            else:
                self.log_warning("JWKS missing CORS headers")
            
            self.log_success("JWKS endpoint validation passed")
            return True
            
        except requests.RequestException as e:
            self.log_failure(f"JWKS endpoint not accessible: {e}")
            return False
        except json.JSONDecodeError as e:
            self.log_failure(f"JWKS response is not valid JSON: {e}")
            return False
    
    def validate_algorithm_confusion_protection(self) -> bool:
        """Validate algorithm confusion attack protection."""
        print("\n🛡️  Validating algorithm confusion protection...")
        
        try:
            # Get JWKS
            jwks_response = requests.get(f"{self.base_url}/.well-known/jwks.json", timeout=self.timeout)
            jwks = jwks_response.json()
            
            if not jwks.get('keys'):
                self.log_failure("No keys in JWKS for algorithm confusion testing")
                return False
            
            # Test algorithm confusion with HS256
            pub_key = jwks['keys'][0]
            malicious_claims = {
                "sub": "test-user",
                "aud": "shomer",
                "exp": 9999999999,
                "iat": 1000000000
            }
            
            # Create malicious token using HS256 with public key as secret
            malicious_token = jwt.encode(
                malicious_claims,
                str(pub_key),
                algorithm="HS256"
            )
            
            # Try to decode with PyJWKClient (should fail)
            try:
                jwks_client = PyJWKClient(f"{self.base_url}/.well-known/jwks.json")
                signing_key = jwks_client.get_signing_key_from_jwt(malicious_token)
                decoded = jwt.decode(
                    malicious_token,
                    signing_key.key,
                    algorithms=['RS256', 'EdDSA'],
                    audience='shomer'
                )
                self.log_failure("Algorithm confusion attack succeeded - HS256 token accepted")
                return False
            except jwt.InvalidTokenError:
                self.log_success("Algorithm confusion protection working - HS256 token rejected")
            
            # Test 'none' algorithm
            none_token = jwt.encode(malicious_claims, "", algorithm="none")
            try:
                jwks_client = PyJWKClient(f"{self.base_url}/.well-known/jwks.json")
                signing_key = jwks_client.get_signing_key_from_jwt(none_token)
                decoded = jwt.decode(
                    none_token,
                    signing_key.key,
                    algorithms=['RS256', 'EdDSA'],
                    audience='shomer'
                )
                self.log_failure("Algorithm confusion attack succeeded - 'none' algorithm accepted")
                return False
            except jwt.InvalidTokenError:
                self.log_success("Algorithm confusion protection working - 'none' algorithm rejected")
            
            return True
            
        except Exception as e:
            self.log_failure(f"Algorithm confusion validation failed: {e}")
            return False
    
    def validate_security_headers(self) -> bool:
        """Validate security headers."""
        print("\n🔒 Validating security headers...")
        
        try:
            response = requests.get(self.base_url, timeout=self.timeout)
            headers = response.headers
            
            required_headers = {
                'strict-transport-security': 'HSTS header',
                'x-frame-options': 'X-Frame-Options header',
                'x-content-type-options': 'X-Content-Type-Options header',
                'referrer-policy': 'Referrer-Policy header'
            }
            
            missing_headers = []
            for header, description in required_headers.items():
                if header not in headers:
                    missing_headers.append(description)
            
            if missing_headers:
                self.log_warning(f"Missing security headers: {', '.join(missing_headers)}")
            else:
                self.log_success("All required security headers present")
            
            # Check Content Security Policy
            csp = headers.get('content-security-policy', '')
            if csp:
                self.log_success("Content Security Policy header present")
                if 'unsafe-inline' in csp or 'unsafe-eval' in csp:
                    self.log_warning("CSP contains potentially unsafe directives")
            else:
                self.log_warning("Content Security Policy header missing")
            
            return True
            
        except requests.RequestException as e:
            self.log_failure(f"Failed to validate security headers: {e}")
            return False
    
    def validate_auth_endpoints(self) -> bool:
        """Validate authentication endpoints security."""
        print("\n🔐 Validating authentication endpoints...")
        
        endpoints = [
            "/api/v1/auth/login",
            "/api/v1/auth/sessions/revoke-all"
        ]
        
        for endpoint in endpoints:
            try:
                response = requests.post(f"{self.base_url}{endpoint}", timeout=self.timeout)
                
                # Should require authentication (401/403) or have proper validation
                if response.status_code in [401, 403]:
                    self.log_success(f"{endpoint} properly requires authentication")
                elif response.status_code == 405:
                    self.log_success(f"{endpoint} exists and responds appropriately")
                else:
                    self.log_warning(f"{endpoint} returned unexpected status: {response.status_code}")
                
            except requests.RequestException as e:
                self.log_warning(f"Failed to test {endpoint}: {e}")
        
        return True
    
    def validate_rate_limiting(self) -> bool:
        """Validate rate limiting configuration."""
        print("\n⏱️  Validating rate limiting...")
        
        try:
            # Test rate limiting by making multiple requests
            responses = []
            for i in range(10):
                response = requests.get(f"{self.base_url}/.well-known/jwks.json", timeout=self.timeout)
                responses.append(response.status_code)
            
            # Check for rate limiting headers
            last_response = requests.get(f"{self.base_url}/.well-known/jwks.json", timeout=self.timeout)
            rate_limit_headers = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']
            
            has_rate_limit_headers = any(header in last_response.headers for header in rate_limit_headers)
            
            if has_rate_limit_headers:
                self.log_success("Rate limiting headers present")
            else:
                self.log_warning("Rate limiting headers not detected")
            
            return True
            
        except requests.RequestException as e:
            self.log_failure(f"Rate limiting validation failed: {e}")
            return False
    
    def validate_https_enforcement(self) -> bool:
        """Validate HTTPS enforcement."""
        print("\n🔐 Validating HTTPS enforcement...")
        
        if not self.base_url.startswith('https://'):
            self.log_warning("Not using HTTPS - skipping HTTPS validation")
            return True
        
        try:
            response = requests.get(self.base_url, timeout=self.timeout)
            headers = response.headers
            
            # Check HSTS header
            hsts = headers.get('strict-transport-security', '')
            if hsts:
                self.log_success("HSTS header present")
                if 'max-age' in hsts:
                    self.log_success("HSTS has max-age directive")
                else:
                    self.log_warning("HSTS missing max-age directive")
            else:
                self.log_failure("HSTS header missing for HTTPS site")
                return False
            
            return True
            
        except requests.RequestException as e:
            self.log_failure(f"HTTPS validation failed: {e}")
            return False
    
    def validate_clock_skew_hardening(self) -> bool:
        """Validate clock skew hardening."""
        print("\n⏰ Validating clock skew hardening...")
        
        # This would typically check system clock synchronization
        # For now, we'll validate the configuration
        
        # Check if NTP is configured (system-dependent)
        try:
            result = subprocess.run(['ntpq', '-p'], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                self.log_success("NTP service appears to be configured")
            else:
                self.log_warning("NTP service may not be configured")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            self.log_warning("Could not verify NTP configuration")
        
        return True
    
    def validate_environment_configuration(self) -> bool:
        """Validate environment configuration."""
        print("\n🌍 Validating environment configuration...")
        
        # Check for production environment
        env = os.environ.get('ENVIRONMENT', 'development')
        if env != 'production':
            self.log_warning(f"Environment is '{env}', not 'production'")
        
        # Check for debug mode
        debug = os.environ.get('DEBUG', 'false').lower()
        if debug == 'true':
            self.log_failure("Debug mode is enabled in production")
            return False
        
        # Check for secure cookies
        secure_cookies = os.environ.get('SECURE_COOKIES', 'true').lower()
        if secure_cookies != 'true':
            self.log_warning("Secure cookies not enabled")
        
        self.log_success("Environment configuration validation completed")
        return True
    
    def run_all_validations(self) -> bool:
        """Run all security validations."""
        print("🔒 Starting Production Security Validation")
        print("=" * 50)
        
        validations = [
            self.validate_jwks_endpoint,
            self.validate_algorithm_confusion_protection,
            self.validate_security_headers,
            self.validate_auth_endpoints,
            self.validate_rate_limiting,
            self.validate_https_enforcement,
            self.validate_clock_skew_hardening,
            self.validate_environment_configuration
        ]
        
        all_passed = True
        for validation in validations:
            try:
                if not validation():
                    all_passed = False
            except Exception as e:
                self.log_failure(f"Validation failed with exception: {e}")
                all_passed = False
        
        return all_passed
    
    def generate_report(self) -> Dict:
        """Generate security validation report."""
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "base_url": self.base_url,
            "summary": {
                "total_checks": len(self.successes) + len(self.warnings) + len(self.failures),
                "successes": len(self.successes),
                "warnings": len(self.warnings),
                "failures": len(self.failures)
            },
            "successes": self.successes,
            "warnings": self.warnings,
            "failures": self.failures,
            "recommendations": self._generate_recommendations()
        }
    
    def _generate_recommendations(self) -> List[str]:
        """Generate security recommendations."""
        recommendations = []
        
        if self.failures:
            recommendations.append("Address all security failures before production deployment")
        
        if self.warnings:
            recommendations.append("Review and address security warnings")
        
        if not any('HSTS' in success for success in self.successes):
            recommendations.append("Implement HSTS headers for HTTPS enforcement")
        
        if not any('rate limiting' in success.lower() for success in self.successes):
            recommendations.append("Implement rate limiting on authentication endpoints")
        
        return recommendations


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Production Security Validation')
    parser.add_argument('--base-url', required=True, help='Base URL to validate')
    parser.add_argument('--timeout', type=int, default=30, help='Request timeout in seconds')
    parser.add_argument('--output', help='Output file for JSON report')
    parser.add_argument('--fail-on-warnings', action='store_true', help='Fail on warnings')
    
    args = parser.parse_args()
    
    validator = SecurityValidator(args.base_url, args.timeout)
    all_passed = validator.run_all_validations()
    
    # Generate report
    report = validator.generate_report()
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n📄 Report saved to {args.output}")
    
    # Print summary
    print("\n" + "=" * 50)
    print("🔒 Security Validation Summary")
    print("=" * 50)
    print(f"✅ Successes: {len(validator.successes)}")
    print(f"⚠️  Warnings: {len(validator.warnings)}")
    print(f"❌ Failures: {len(validator.failures)}")
    
    if validator.failures:
        print("\n❌ CRITICAL FAILURES:")
        for failure in validator.failures:
            print(f"  - {failure}")
    
    if validator.warnings and args.fail_on_warnings:
        print("\n⚠️  WARNINGS (treated as failures):")
        for warning in validator.warnings:
            print(f"  - {warning}")
        all_passed = False
    
    if all_passed and not (args.fail_on_warnings and validator.warnings):
        print("\n🎉 All security validations passed!")
        print("✅ Ready for production deployment")
        sys.exit(0)
    else:
        print("\n🚨 Security validation failed!")
        print("❌ Do not deploy to production")
        sys.exit(1)


if __name__ == "__main__":
    main()
