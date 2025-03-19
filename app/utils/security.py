"""
Các tiện ích bảo mật cho ứng dụng
"""

import os
import base64
import secrets
import string
import logging
from datetime import datetime, timedelta

from werkzeug.security import generate_password_hash, check_password_hash
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from flask import current_app
from flask_jwt_extended import create_access_token, create_refresh_token

logger = logging.getLogger('mikrotik_monitor.security')

def hash_password(password):
    """Generate a password hash for user authentication"""
    return generate_password_hash(password)

def verify_password(password, password_hash):
    """Verify a password against a hash for user authentication"""
    return check_password_hash(password_hash, password)

def _get_encryption_key():
    """Get encryption key from environment or generate one"""
    key = os.environ.get('ENCRYPTION_KEY')
    if not key:
        # Use SECRET_KEY with a salt for encryption if no ENCRYPTION_KEY provided
        secret_key = current_app.config['SECRET_KEY']
        if not secret_key:
            logger.error("No SECRET_KEY configured, using fallback (less secure)")
            secret_key = "mikrotik_monitor_default_key"  # Fallback, less secure
        
        # Derive a key using PBKDF2
        salt = b'mikrotik_monitor_salt'  # Consistent salt
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000
        )
        key = base64.urlsafe_b64encode(kdf.derive(secret_key.encode()))
    else:
        # Ensure key is properly base64 encoded
        if not key.endswith('='):
            # Pad if needed
            key += '=' * (4 - len(key) % 4)
        key = key.encode()
    
    return key

def encrypt_device_password(password):
    """Encrypt a device password"""
    if not password:
        return ''
    
    try:
        key = _get_encryption_key()
        cipher = Fernet(key)
        encrypted = cipher.encrypt(password.encode())
        return f"enc:{encrypted.decode()}"
    except Exception as e:
        logger.error(f"Error encrypting password: {e}")
        # Return a marker to show encryption failed, but don't expose the original
        return f"enc_failed:{password[:2]}***"

def decrypt_device_password(encrypted_password):
    """Decrypt a device password"""
    if not encrypted_password or not encrypted_password.startswith('enc:'):
        return encrypted_password
    
    try:
        # Remove the prefix
        encrypted_data = encrypted_password[4:]
        
        key = _get_encryption_key()
        cipher = Fernet(key)
        decrypted = cipher.decrypt(encrypted_data.encode())
        return decrypted.decode()
    except Exception as e:
        logger.error(f"Error decrypting password: {e}")
        # Return a marker so calling code can detect error
        return "dec_failed"

def generate_random_password(length=12):
    """Generate a secure random password"""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    # Ensure at least one of each character type
    password = (
        secrets.choice(string.ascii_lowercase) +
        secrets.choice(string.ascii_uppercase) +
        secrets.choice(string.digits) +
        secrets.choice(string.punctuation) +
        ''.join(secrets.choice(alphabet) for _ in range(length-4))
    )
    # Shuffle the password to avoid predictable pattern
    char_list = list(password)
    secrets.SystemRandom().shuffle(char_list)
    return ''.join(char_list)

def generate_tokens(identity):
    """Generate JWT access and refresh tokens"""
    # Use identity (user_id) from parameter
    additional_claims = {
        'iat': datetime.utcnow()
    }
    
    # Create tokens
    access_token = create_access_token(
        identity=identity, 
        additional_claims=additional_claims,
        fresh=True
    )
    
    refresh_token = create_refresh_token(
        identity=identity,
        additional_claims=additional_claims
    )
    
    return {
        'access_token': access_token,
        'refresh_token': refresh_token
    }

def sanitize_input(input_str):
    """Sanitize input to prevent injection attacks"""
    if not input_str:
        return input_str
    
    # Replace potentially dangerous characters
    sanitized = input_str
    sanitized = sanitized.replace('<', '&lt;')
    sanitized = sanitized.replace('>', '&gt;')
    sanitized = sanitized.replace('"', '&quot;')
    sanitized = sanitized.replace("'", '&#39;')
    
    return sanitized