"""
Cấu hình cho ứng dụng MikroTik Monitor
"""

import os
from datetime import timedelta

class Config:
    """Cấu hình ứng dụng"""
    # Thông tin ứng dụng
    APP_NAME = "MikroTik Monitor"
    APP_VERSION = "1.0.0"
    
    # Cấu hình Flask
    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"
    SECRET_KEY = os.environ.get("SECRET_KEY")
    
    # Cấu hình database
    instance_path = os.path.abspath(os.path.join(os.getcwd(), 'instance'))
    db_path = os.path.join(instance_path, 'mikrotik_monitor.db')
    
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or f"sqlite:///{db_path}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
    }
    
    # Cấu hình JWT
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    if not JWT_SECRET_KEY:
        # Nếu không có JWT_SECRET_KEY, sử dụng SECRET_KEY
        JWT_SECRET_KEY = SECRET_KEY
    
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "60")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30")))
    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    
    JWT_COOKIE_CSRF_PROTECT = os.environ.get("JWT_COOKIE_CSRF_PROTECT", "1") == "1"
    JWT_COOKIE_SECURE = os.environ.get("JWT_COOKIE_SECURE", "0") == "1" or not DEBUG
    
    JWT_ACCESS_COOKIE_PATH = "/"
    JWT_REFRESH_COOKIE_PATH = "/"
    
    # Cấu hình CSRF
    WTF_CSRF_ENABLED = True
    WTF_CSRF_SECRET_KEY = os.environ.get("WTF_CSRF_SECRET_KEY", SECRET_KEY)
    
    # Cấu hình quản lý thiết bị
    MONITORING_INTERVAL = int(os.environ.get("MONITORING_INTERVAL", "60"))  # giây
    ALERT_CHECK_INTERVAL = int(os.environ.get("ALERT_CHECK_INTERVAL", "30"))  # giây
    
    # Cấu hình kết nối MikroTik
    MIKROTIK_CONNECTION_TIMEOUT = int(os.environ.get("MIKROTIK_CONNECTION_TIMEOUT", "10"))
    MIKROTIK_COMMAND_TIMEOUT = int(os.environ.get("MIKROTIK_COMMAND_TIMEOUT", "15"))
    
    # Cấu hình email cho thông báo
    MAIL_SERVER = os.environ.get("MAIL_SERVER")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER")
    
    # Cấu hình Telegram cho thông báo
    TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
    TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")