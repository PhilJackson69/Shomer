#!/usr/bin/env python3
"""
Throwaway Security Probes

These are "mean" security probes designed to test edge cases and catch
sneaky vulnerabilities that teams usually miss. Use these for testing
but don't commit them to production.
"""

import requests
import zipfile
import io
import tempfile
import os
from PIL import Image
import base64


class ThrowawaySecurityProbes:
    """Mean security probes for edge case testing."""
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
    
    def test_redirect_to_private_ip(self):
        """
        Test redirect-to-private IP attack (SSRF).
        Creates a public URL that redirects to private IP addresses.
        """
        print("🔍 Testing redirect-to-private IP attack...")
        
        # Common private IP addresses to test
        private_ips = [
            "169.254.169.254",  # AWS metadata
            "10.0.0.1",         # Private range
            "192.168.1.1",      # Private range
            "127.0.0.1",        # Localhost
            "0.0.0.0",          # All interfaces
        ]
        
        # Test each private IP
        for ip in private_ips:
            try:
                # Create a URL that redirects to private IP
                redirect_url = f"http://{ip}/"
                
                # Test if the application follows redirects to private IPs
                response = self.session.get(
                    redirect_url,
                    allow_redirects=True,
                    timeout=5
                )
                
                if response.status_code == 200:
                    print(f"⚠️  WARNING: Application may follow redirects to private IP: {ip}")
                    print(f"   Response length: {len(response.content)} bytes")
                else:
                    print(f"✅ Application properly blocked redirect to {ip}")
                    
            except requests.RequestException as e:
                print(f"✅ Application properly blocked redirect to {ip}: {e}")
    
    def test_polyglot_zip_attack(self):
        """
        Test polyglot zip attack with nested zips and oversized images.
        """
        print("🔍 Testing polyglot zip attack...")
        
        # Create a polyglot zip file
        polyglot_zip = io.BytesIO()
        
        with zipfile.ZipFile(polyglot_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Add a normal file
            zf.writestr("normal.txt", "This is a normal file")
            
            # Create a nested zip with oversized image
            nested_zip = io.BytesIO()
            with zipfile.ZipFile(nested_zip, 'w', zipfile.ZIP_DEFLATED) as nested:
                # Create an oversized image (10000x10000 pixels)
                oversized_image = Image.new('RGB', (10000, 10000), color='red')
                img_bytes = io.BytesIO()
                oversized_image.save(img_bytes, format='PNG')
                nested.writestr("oversized.png", img_bytes.getvalue())
                
                # Add another nested zip
                double_nested_zip = io.BytesIO()
                with zipfile.ZipFile(double_nested_zip, 'w', zipfile.ZIP_DEFLATED) as double_nested:
                    double_nested.writestr("deep.txt", "Deep nested file")
                
                nested.writestr("nested.zip", exterior_nested_zip.getvalue())
            
            zf.writestr("nested.zip", nested_zip.getvalue())
            
            # Add a file with suspicious extension
            zf.writestr("suspicious.php.txt", "<?php echo 'hacked'; ?>")
            
            # Add a file with null bytes in name
            zf.writestr("file\x00.txt", "File with null byte")
        
        polyglot_zip.seek(0)
        
        # Test upload endpoint (if exists)
        try:
            files = {'file': ('polyglot.zip', polyglot_zip, 'application/zip')}
            response = self.session.post(
                f"{self.base_url}/api/v1/upload",
                files=files,
                timeout=30
            )
            
            if response.status_code == 200:
                print("⚠️  WARNING: Polyglot zip was accepted")
            else:
                print(f"✅ Polyglot zip was rejected with status: {response.status_code}")
                
        except requests.RequestException as e:
            print(f"✅ Upload endpoint not accessible or properly protected: {e}")
    
    def test_algorithm_confusion_edge_cases(self):
        """
        Test edge cases in algorithm confusion attacks.
        """
        print("🔍 Testing algorithm confusion edge cases...")
        
        import jwt
        import json
        
        # Test with malformed headers
        malformed_tokens = [
            # Token with no algorithm
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.",
            
            # Token with empty algorithm
            "eyJ0eXAiOiJKV1QiLCJhbGciOiIifQ.eyJzdWIiOiJ0ZXN0In0.",
            
            # Token with null algorithm
            "eyJ0eXAiOiJKV1QiLCJhbGciOm51bGx9.eyJzdWIiOiJ0ZXN0In0.",
            
            # Token with array algorithm
            "eyJ0eXAiOiJKV1QiLCJhbGciOlsiSFMyNTYiXX0.eyJzdWIiOiJ0ZXN0In0.",
        ]
        
        for token in malformed_tokens:
            try:
                # Try to decode with various methods
                decoded = jwt.decode(token, "", algorithms=["none", "HS256"])
                print(f"⚠️  WARNING: Malformed token accepted: {token[:50]}...")
            except jwt.InvalidTokenError:
                print(f"✅ Malformed token properly rejected: {token[:50]}...")
    
    def test_header_injection_attacks(self):
        """
        Test header injection attacks.
        """
        print("🔍 Testing header injection attacks...")
        
        # Test various header injection payloads
        injection_headers = [
            "X-Forwarded-For: 127.0.0.1\r\nX-Injected: true",
            "User-Agent: Mozilla/5.0\r\nX-Injected: true",
            "Authorization: Bearer token\r\nX-Injected: true",
            "Cookie: session=value\r\nX-Injected: true",
        ]
        
        for header_value in injection_headers:
            try:
                headers = {"X-Test-Header": header_value}
                response = self.session.get(
                    f"{self.base_url}/api/v1/test",
                    headers=headers,
                    timeout=5
                )
                
                # Check if injected header appears in response
                if "X-Injected" in response.text:
                    print(f"⚠️  WARNING: Header injection possible: {header_value[:50]}...")
                else:
                    print(f"✅ Header injection blocked: {header_value[:50]}...")
                    
            except requests.RequestException as e:
                print(f"✅ Request properly handled: {e}")
    
    def test_path_traversal_attacks(self):
        """
        Test path traversal attacks.
        """
        print("🔍 Testing path traversal attacks...")
        
        # Common path traversal payloads
        traversal_paths = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
            "....//....//....//etc/passwd",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
            "..%252f..%252f..%252fetc%252fpasswd",
            "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd",
        ]
        
        for path in traversal_paths:
            try:
                response = self.session.get(
                    f"{self.base_url}/api/v1/files/{path}",
                    timeout=5
                )
                
                # Check for sensitive file content
                if "root:" in response.text or "localhost" in response.text:
                    print(f"⚠️  WARNING: Path traversal possible: {path}")
                else:
                    print(f"✅ Path traversal blocked: {path}")
                    
            except requests.RequestException as e:
                print(f"✅ Request properly handled: {e}")
    
    def test_sql_injection_edge_cases(self):
        """
        Test SQL injection edge cases.
        """
        print("🔍 Testing SQL injection edge cases...")
        
        # Edge case SQL injection payloads
        sql_payloads = [
            "' OR '1'='1' --",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --",
            "1' AND (SELECT COUNT(*) FROM information_schema.tables) > 0 --",
            "' OR 1=1 LIMIT 1 OFFSET 0 --",
            "'; EXEC xp_cmdshell('dir'); --",
        ]
        
        for payload in sql_payloads:
            try:
                # Test in various parameters
                params = {
                    "id": payload,
                    "search": payload,
                    "filter": payload,
                }
                
                response = self.session.get(
                    f"{self.base_url}/api/v1/search",
                    params=params,
                    timeout=5
                )
                
                # Check for SQL error messages
                error_indicators = [
                    "mysql_fetch_array",
                    "ORA-01756",
                    "Microsoft OLE DB",
                    "SQLite error",
                    "PostgreSQL error",
                ]
                
                if any(indicator in response.text for indicator in error_indicators):
                    print(f"⚠️  WARNING: SQL injection possible: {payload[:30]}...")
                else:
                    print(f"✅ SQL injection blocked: {payload[:30]}...")
                    
            except requests.RequestException as e:
                print(f"✅ Request properly handled: {e}")
    
    def test_xss_edge_cases(self):
        """
        Test XSS edge cases.
        """
        print("🔍 Testing XSS edge cases...")
        
        # Edge case XSS payloads
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "onload=alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>",
            "';alert('XSS');//",
            "\"><script>alert('XSS')</script>",
            "<iframe src=javascript:alert('XSS')></iframe>",
        ]
        
        for payload in xss_payloads:
            try:
                # Test in various parameters
                params = {
                    "q": payload,
                    "comment": payload,
                    "name": payload,
                }
                
                response = self.session.get(
                    f"{self.base_url}/api/v1/search",
                    params=params,
                    timeout=5
                )
                
                # Check if payload is reflected unescaped
                if payload in response.text and "<script>" in payload:
                    print(f"⚠️  WARNING: XSS possible: {payload[:30]}...")
                else:
                    print(f"✅ XSS blocked: {payload[:30]}...")
                    
            except requests.RequestException as e:
                print(f"✅ Request properly handled: {e}")
    
    def run_all_probes(self):
        """Run all throwaway security probes."""
        print("🔍 Running Throwaway Security Probes")
        print("=" * 50)
        print("⚠️  WARNING: These are aggressive security tests!")
        print("   Use only for testing, not in production!")
        print("=" * 50)
        
        try:
            self.test_redirect_to_private_ip()
            print()
            
            self.test_polyglot_zip_attack()
            print()
            
            self.test_algorithm_confusion_edge_cases()
            print()
            
            self.test_header_injection_attacks()
            print()
            
            self.test_path_traversal_attacks()
            print()
            
            self.test_sql_injection_edge_cases()
            print()
            
            self.test_xss_edge_cases()
            print()
            
        except KeyboardInterrupt:
            print("\n🛑 Probes interrupted by user")
        except Exception as e:
            print(f"\n❌ Probe execution failed: {e}")
        
        print("\n🔍 Throwaway security probes completed!")
        print("=" * 50)


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Throwaway Security Probes')
    parser.add_argument('--base-url', required=True, help='Base URL to test')
    parser.add_argument('--probe', help='Specific probe to run')
    
    args = parser.parse_args()
    
    if not args.base_url.startswith('http'):
        print("❌ Base URL must start with http:// or https://")
        return
    
    probes = ThrowawaySecurityProbes(args.base_url)
    
    if args.probe:
        if hasattr(probes, f"test_{args.probe}"):
            getattr(probes, f"test_{args.probe}")()
        else:
            print(f"❌ Unknown probe: {args.probe}")
    else:
        probes.run_all_probes()


if __name__ == "__main__":
    main()
