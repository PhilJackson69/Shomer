"""
Input validation and sanitization utilities.

Provides comprehensive input cleaning, HTML sanitization, and file upload validation
for security-hardened data processing.
"""

import re
import mimetypes
import hashlib
import zipfile
import tarfile
from typing import List, Tuple, Optional, Dict, Any
from pathlib import Path
import bleach
from bleach.css_sanitizer import CSSSanitizer
from ipaddress import ip_address, ip_network
import requests
from urllib.parse import urlparse
import magic


# Allowed HTML tags for rich text content
ALLOWED_HTML_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 'b', 'i', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote',
    'a', 'img',
]

# Allowed HTML attributes
ALLOWED_HTML_ATTRIBUTES = {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'span': ['class'],
    'div': ['class'],
    'p': ['class'],
}

# Allowed URL schemes
ALLOWED_URL_SCHEMES = ['http', 'https', 'mailto']

# File upload configuration
ALLOWED_FILE_EXTENSIONS = {
    'image': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    'document': ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
    'video': ['.mp4', '.avi', '.mov', '.wmv', '.webm'],
    'audio': ['.mp3', '.wav', '.ogg', '.m4a'],
}

ALLOWED_MIME_TYPES = {
    'image': [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
    ],
    'document': [
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'application/rtf'
    ],
    'video': [
        'video/mp4', 'video/avi', 'video/quicktime', 'video/x-ms-wmv', 'video/webm'
    ],
    'audio': [
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'
    ],
}

# File size limits (in bytes) - Enhanced security limits
MAX_FILE_SIZES = {
    'image': 10 * 1024 * 1024,  # 10MB
    'document': 25 * 1024 * 1024,  # 25MB
    'video': 100 * 1024 * 1024,  # 100MB
    'audio': 50 * 1024 * 1024,  # 50MB
    'archive': 50 * 1024 * 1024,  # 50MB for archives
}

# Image dimension limits
MAX_IMAGE_DIMENSIONS = {
    'width': 8192,   # 8K width
    'height': 8192,  # 8K height
}

# PDF page limits
MAX_PDF_PAGES = 50

# Archive security limits
MAX_ARCHIVE_DEPTH = 2  # Maximum nested archive depth
MAX_ARCHIVE_RATIO = 30  # Maximum compression ratio (30:1)

# SSRF Protection - Blocked IP ranges
BLOCKED_IP_RANGES = [
    "0.0.0.0/8",        # Current network
    "10.0.0.0/8",       # Private network
    "100.64.0.0/10",    # Carrier-grade NAT
    "127.0.0.0/8",      # Loopback
    "169.254.0.0/16",   # Link-local
    "172.16.0.0/12",    # Private network
    "192.168.0.0/16",   # Private network
    "::/128",           # IPv6 unspecified
    "fc00::/7",         # IPv6 unique local
    "fe80::/10",        # IPv6 link-local
]

# Dangerous file extensions to block
DANGEROUS_EXTENSIONS = {
    '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
    '.sh', '.ps1', '.py', '.rb', '.pl', '.php', '.asp', '.jsp', '.cgi',
    '.dll', '.so', '.dylib', '.deb', '.rpm', '.msi', '.app', '.dmg',
    '.phtml', '.php3', '.php4', '.php5', '.pht', '.phtm',
}


def sanitize_html(content: str, allowed_tags: Optional[List[str]] = None) -> str:
    """
    Sanitize HTML content to prevent XSS attacks.
    
    Args:
        content: HTML content to sanitize
        allowed_tags: Override default allowed tags
        
    Returns:
        Sanitized HTML content
    """
    if not content:
        return content
    
    tags = allowed_tags or ALLOWED_HTML_TAGS
    
    # Configure CSS sanitizer
    css_sanitizer = CSSSanitizer(allowed_css_properties=[
        'color', 'background-color', 'font-size', 'font-weight', 'font-style',
        'text-align', 'text-decoration', 'margin', 'padding', 'border',
    ])
    
    # Sanitize HTML
    sanitized = bleach.clean(
        content,
        tags=tags,
        attributes=ALLOWED_HTML_ATTRIBUTES,
        protocols=ALLOWED_URL_SCHEMES,
        css_sanitizer=css_sanitizer,
        strip=True,
    )
    
    return sanitized


def sanitize_text_input(text: str, max_length: int = 10000) -> str:
    """
    Sanitize plain text input.
    
    Args:
        text: Text to sanitize
        max_length: Maximum allowed length
        
    Returns:
        Sanitized text
    """
    if not text:
        return text
    
    # Remove null bytes and control characters
    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Trim and limit length
    text = text.strip()[:max_length]
    
    return text


def validate_file_upload(
    filename: str, 
    content_type: str, 
    file_size: int,
    allowed_categories: Optional[List[str]] = None
) -> Tuple[bool, Optional[str]]:
    """
    Validate file upload for security.
    
    Args:
        filename: Original filename
        content_type: MIME content type
        file_size: File size in bytes
        allowed_categories: List of allowed file categories
        
    Returns:
        (is_valid, error_message)
    """
    if not filename:
        return False, "No filename provided"
    
    # Get file extension
    file_path = Path(filename)
    extension = file_path.suffix.lower()
    
    # Check for dangerous extensions
    if extension in DANGEROUS_EXTENSIONS:
        return False, f"Dangerous file type not allowed: {extension}"
    
    # Determine file category
    category = None
    for cat, extensions in ALLOWED_FILE_EXTENSIONS.items():
        if extension in extensions:
            category = cat
            break
    
    if not category:
        return False, f"Unsupported file type: {extension}"
    
    # Check if category is allowed
    if allowed_categories and category not in allowed_categories:
        return False, f"File category not allowed: {category}"
    
    # Validate MIME type
    if category in ALLOWED_MIME_TYPES:
        if content_type not in ALLOWED_MIME_TYPES[category]:
            return False, f"MIME type mismatch: {content_type} not allowed for {category}"
    
    # Check file size
    if category in MAX_FILE_SIZES:
        if file_size > MAX_FILE_SIZES[category]:
            max_mb = MAX_FILE_SIZES[category] // (1024 * 1024)
            return False, f"File too large: {file_size} bytes (max {max_mb}MB for {category})"
    
    return True, None


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal and other issues.
    
    Args:
        filename: Original filename
        
    Returns:
        Sanitized filename
    """
    if not filename:
        return "unnamed"
    
    # Remove path components
    filename = Path(filename).name
    
    # Remove dangerous characters
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', filename)
    
    # Limit length
    filename = filename[:255]
    
    # Ensure it's not empty after sanitization
    if not filename or filename == '.' or filename == '..':
        filename = "unnamed"
    
    return filename


def validate_url(url: str) -> Tuple[bool, Optional[str]]:
    """
    Validate URL for security.
    
    Args:
        url: URL to validate
        
    Returns:
        (is_valid, error_message)
    """
    if not url:
        return False, "No URL provided"
    
    # Basic URL pattern
    url_pattern = re.compile(
        r'^https?://'  # http or https
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain
        r'localhost|'  # localhost
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # IP
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE
    )
    
    if not url_pattern.match(url):
        return False, "Invalid URL format"
    
    # Check for dangerous protocols
    dangerous_protocols = ['javascript:', 'data:', 'vbscript:', 'file:']
    if any(url.lower().startswith(proto) for proto in dangerous_protocols):
        return False, "Dangerous protocol not allowed"
    
    return True, None


def sanitize_json_input(data: Dict[str, Any], max_depth: int = 10) -> Dict[str, Any]:
    """
    Sanitize JSON input data.
    
    Args:
        data: JSON data to sanitize
        max_depth: Maximum nesting depth
        
    Returns:
        Sanitized JSON data
    """
    if not isinstance(data, dict):
        return data
    
    if max_depth <= 0:
        return {}
    
    sanitized = {}
    for key, value in data.items():
        # Sanitize key
        clean_key = sanitize_text_input(str(key), max_length=100)
        
        # Sanitize value based on type
        if isinstance(value, str):
            clean_value = sanitize_text_input(value)
        elif isinstance(value, dict):
            clean_value = sanitize_json_input(value, max_depth - 1)
        elif isinstance(value, list):
            clean_value = [
                sanitize_text_input(item) if isinstance(item, str) else item
                for item in value[:100]  # Limit list size
            ]
        else:
            clean_value = value
        
        sanitized[clean_key] = clean_value
    
    return sanitized


class InputValidator:
    """Comprehensive input validation class."""
    
    def __init__(self):
        self.errors = []
    
    def validate_text(self, text: str, field_name: str, max_length: int = 1000) -> str:
        """Validate and sanitize text input."""
        if not text:
            return text
        
        if len(text) > max_length:
            self.errors.append(f"{field_name} exceeds maximum length of {max_length}")
            return text[:max_length]
        
        return sanitize_text_input(text, max_length)
    
    def validate_email(self, email: str) -> str:
        """Validate email address."""
        if not email:
            return email
        
        email_pattern = re.compile(
            r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        )
        
        if not email_pattern.match(email):
            self.errors.append("Invalid email format")
        
        return email.lower().strip()
    
    def validate_phone(self, phone: str) -> str:
        """Validate phone number."""
        if not phone:
            return phone
        
        # Remove all non-digit characters
        digits = re.sub(r'\D', '', phone)
        
        # Check if it's a valid length (7-15 digits)
        if len(digits) < 7 or len(digits) > 15:
            self.errors.append("Invalid phone number format")
        
        return digits
    
    def validate_file(self, filename: str, content_type: str, file_size: int) -> bool:
        """Validate file upload."""
        is_valid, error = validate_file_upload(filename, content_type, file_size)
        if not is_valid:
            self.errors.append(error)
        return is_valid
    
    def validate_url(self, url: str) -> str:
        """Validate URL."""
        is_valid, error = validate_url(url)
        if not is_valid:
            self.errors.append(error)
        return url
    
    def has_errors(self) -> bool:
        """Check if validation has errors."""
        return len(self.errors) > 0
    
    def get_errors(self) -> List[str]:
        """Get list of validation errors."""
        return self.errors.copy()
    
    def clear_errors(self):
        """Clear validation errors."""
        self.errors.clear()


def is_private_ip(ip_str: str) -> bool:
    """
    Check if an IP address is in a private/blocked range.
    
    Args:
        ip_str: IP address string
        
    Returns:
        True if IP is private/blocked, False otherwise
    """
    try:
        ip_obj = ip_address(ip_str)
        for blocked_range in BLOCKED_IP_RANGES:
            if ip_obj in ip_network(blocked_range):
                return True
        return False
    except ValueError:
        return True  # Invalid IP addresses are considered blocked


def validate_url_for_ssrf(url: str, allow_redirects: bool = False) -> Tuple[bool, Optional[str]]:
    """
    Validate URL for SSRF attacks.
    
    Args:
        url: URL to validate
        allow_redirects: Whether to follow redirects
        
    Returns:
        (is_valid, error_message)
    """
    if not url:
        return False, "No URL provided"
    
    try:
        parsed = urlparse(url)
        
        # Only allow HTTP/HTTPS
        if parsed.scheme not in ['http', 'https']:
            return False, f"Unsupported scheme: {parsed.scheme}"
        
        # Resolve hostname to IP
        import socket
        try:
            hostname = parsed.hostname
            if not hostname:
                return False, "No hostname in URL"
            
            # Resolve hostname
            ip_addresses = socket.getaddrinfo(hostname, None)
            for addr_info in ip_addresses:
                ip = addr_info[4][0]
                if is_private_ip(ip):
                    return False, f"Private IP address blocked: {ip}"
        except socket.gaierror:
            return False, "Unable to resolve hostname"
        
        # Check for redirects if not allowed
        if not allow_redirects:
            try:
                response = requests.head(url, timeout=5, allow_redirects=False)
                if response.status_code in [301, 302, 303, 307, 308]:
                    location = response.headers.get('Location', '')
                    if location:
                        parsed_redirect = urlparse(location)
                        redirect_ip = socket.getaddrinfo(parsed_redirect.hostname, None)[0][4][0]
                        if is_private_ip(redirect_ip):
                            return False, f"Redirect to private IP blocked: {redirect_ip}"
            except requests.RequestException:
                pass  # Continue validation if request fails
        
        return True, None
        
    except Exception as e:
        return False, f"URL validation error: {str(e)}"


def validate_file_with_libmagic(file_content: bytes, filename: str) -> Tuple[bool, Optional[str]]:
    """
    Validate file using libmagic for MIME type detection.
    
    Args:
        file_content: File content as bytes
        filename: Original filename
        
    Returns:
        (is_valid, error_message)
    """
    try:
        # Detect MIME type using libmagic
        detected_mime = magic.from_buffer(file_content, mime=True)
        
        # Get expected MIME type from filename
        expected_mime, _ = mimetypes.guess_type(filename)
        
        # Check if detected MIME matches expected
        if expected_mime and detected_mime != expected_mime:
            return False, f"MIME type mismatch: expected {expected_mime}, detected {detected_mime}"
        
        # Check for dangerous MIME types
        dangerous_mimes = [
            'application/x-executable',
            'application/x-msdownload',
            'application/x-msdos-program',
            'application/x-wine-extension-ini',
            'text/x-php',
            'application/x-php',
            'application/x-httpd-php',
        ]
        
        if detected_mime in dangerous_mimes:
            return False, f"Dangerous MIME type detected: {detected_mime}"
        
        return True, None
        
    except Exception as e:
        return False, f"File validation error: {str(e)}"


def validate_image_dimensions(file_content: bytes) -> Tuple[bool, Optional[str]]:
    """
    Validate image dimensions to prevent oversized images.
    
    Args:
        file_content: Image file content
        
    Returns:
        (is_valid, error_message)
    """
    try:
        from PIL import Image
        import io
        
        image = Image.open(io.BytesIO(file_content))
        width, height = image.size
        
        if width > MAX_IMAGE_DIMENSIONS['width']:
            return False, f"Image width too large: {width}px (max {MAX_IMAGE_DIMENSIONS['width']}px)"
        
        if height > MAX_IMAGE_DIMENSIONS['height']:
            return False, f"Image height too large: {height}px (max {MAX_IMAGE_DIMENSIONS['height']}px)"
        
        return True, None
        
    except Exception as e:
        return False, f"Image dimension validation error: {str(e)}"


def validate_pdf_pages(file_content: bytes) -> Tuple[bool, Optional[str]]:
    """
    Validate PDF page count to prevent oversized PDFs.
    
    Args:
        file_content: PDF file content
        
    Returns:
        (is_valid, error_message)
    """
    try:
        import PyPDF2
        import io
        
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        page_count = len(pdf_reader.pages)
        
        if page_count > MAX_PDF_PAGES:
            return False, f"PDF has too many pages: {page_count} (max {MAX_PDF_PAGES})"
        
        return True, None
        
    except Exception as e:
        return False, f"PDF validation error: {str(e)}"


def validate_archive_security(file_content: bytes, filename: str) -> Tuple[bool, Optional[str]]:
    """
    Validate archive files for zip bombs and excessive compression.
    
    Args:
        file_content: Archive file content
        filename: Original filename
        
    Returns:
        (is_valid, error_message)
    """
    try:
        file_obj = io.BytesIO(file_content)
        
        # Check file extension
        ext = Path(filename).suffix.lower()
        
        if ext == '.zip':
            with zipfile.ZipFile(file_obj, 'r') as zip_file:
                total_uncompressed = 0
                total_compressed = 0
                max_depth = 0
                
                for info in zip_file.infolist():
                    # Check for nested archives
                    if info.filename.count('/') > max_depth:
                        max_depth = info.filename.count('/')
                    
                    # Check compression ratio
                    if info.compress_size > 0:
                        ratio = info.file_size / info.compress_size
                        if ratio > MAX_ARCHIVE_RATIO:
                            return False, f"Excessive compression ratio: {ratio:.1f}:1 (max {MAX_ARCHIVE_RATIO}:1)"
                    
                    total_uncompressed += info.file_size
                    total_compressed += info.compress_size
                
                # Check overall compression ratio
                if total_compressed > 0:
                    overall_ratio = total_uncompressed / total_compressed
                    if overall_ratio > MAX_ARCHIVE_RATIO:
                        return False, f"Overall compression ratio too high: {overall_ratio:.1f}:1"
                
                # Check archive depth
                if max_depth > MAX_ARCHIVE_DEPTH:
                    return False, f"Archive depth too deep: {max_depth} levels (max {MAX_ARCHIVE_DEPTH})"
        
        elif ext in ['.tar', '.tar.gz', '.tgz']:
            with tarfile.open(fileobj=file_obj, mode='r:*') as tar_file:
                total_size = 0
                max_depth = 0
                
                for member in tar_file.getmembers():
                    if member.isfile():
                        total_size += member.size
                        depth = member.name.count('/')
                        if depth > max_depth:
                            max_depth = depth
                
                # Check archive depth
                if max_depth > MAX_ARCHIVE_DEPTH:
                    return False, f"Archive depth too deep: {max_depth} levels (max {MAX_ARCHIVE_DEPTH})"
        
        return True, None
        
    except Exception as e:
        return False, f"Archive validation error: {str(e)}"


def enhanced_validate_file_upload(
    filename: str, 
    content_type: str, 
    file_size: int,
    file_content: bytes,
    allowed_categories: Optional[List[str]] = None
) -> Tuple[bool, Optional[str]]:
    """
    Enhanced file upload validation with libmagic, dimension checks, and archive security.
    
    Args:
        filename: Original filename
        content_type: MIME content type
        file_size: File size in bytes
        file_content: File content as bytes
        allowed_categories: List of allowed file categories
        
    Returns:
        (is_valid, error_message)
    """
    # Basic validation first
    is_valid, error = validate_file_upload(filename, content_type, file_size, allowed_categories)
    if not is_valid:
        return is_valid, error
    
    # Libmagic validation
    is_valid, error = validate_file_with_libmagic(file_content, filename)
    if not is_valid:
        return is_valid, error
    
    # Category-specific validations
    file_path = Path(filename)
    extension = file_path.suffix.lower()
    
    # Image validation
    if extension in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
        is_valid, error = validate_image_dimensions(file_content)
        if not is_valid:
            return is_valid, error
    
    # PDF validation
    elif extension == '.pdf':
        is_valid, error = validate_pdf_pages(file_content)
        if not is_valid:
            return is_valid, error
    
    # Archive validation
    elif extension in ['.zip', '.tar', '.tar.gz', '.tgz']:
        is_valid, error = validate_archive_security(file_content, filename)
        if not is_valid:
            return is_valid, error
    
    return True, None


if __name__ == "__main__":
    # CLI utility for testing validation
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "test":
            # Test HTML sanitization
            test_html = "<script>alert('xss')</script><p>Safe content</p>"
            print(f"Original: {test_html}")
            print(f"Sanitized: {sanitize_html(test_html)}")
            
            # Test file validation
            is_valid, error = validate_file_upload("test.jpg", "image/jpeg", 1024)
            print(f"File validation: {is_valid}, Error: {error}")
            
            # Test URL validation
            is_valid, error = validate_url("https://example.com")
            print(f"URL validation: {is_valid}, Error: {error}")
        else:
            print("Usage: python -m app.core.validation test")
    else:
        print("Usage: python -m app.core.validation test")
