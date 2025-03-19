"""
Quản lý phiên và kết nối database
"""

import os
import time
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import scoped_session, sessionmaker

from mik.app import db
from mik.app.database.models import Setting

logger = logging.getLogger('mikrotik_monitor.db')

def wait_for_db(app, max_retries=5, retry_interval=2):
    """Wait for database to be available with retry mechanism"""
    engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
    attempt = 0
    
    while attempt < max_retries:
        try:
            # Đơn giản chỉ cần thử kết nối và thực hiện truy vấn đơn giản
            connection = engine.connect()
            connection.execute(text("SELECT 1"))
            connection.close()
            logger.info("Database connection successful")
            return True
        except Exception as e:
            attempt += 1
            logger.warning(f"Database connection attempt {attempt}/{max_retries} failed: {e}")
            
            if attempt < max_retries:
                logger.info(f"Retrying in {retry_interval} seconds...")
                time.sleep(retry_interval)
    
    logger.error(f"Could not connect to database after {max_retries} attempts")
    return False

def get_session():
    """Get a database session"""
    engine = db.engine
    session_factory = sessionmaker(bind=engine)
    return scoped_session(session_factory)

def initialize_db(app):
    """Initialize database with default settings"""
    with app.app_context():
        # Tạo các bảng nếu chưa tồn tại
        db.create_all()
        
        # Tạo các cài đặt mặc định
        default_settings = {
            'app_name': 'MikroTik Monitor',
            'app_version': '1.0.0',
            'monitoring_interval': '60',
            'alert_check_interval': '30',
            'data_retention_days': '30',
            'mikrotik_connection_timeout': '10',
            'mikrotik_command_timeout': '15'
        }
        
        # Kiểm tra và thêm các cài đặt mặc định
        for key, value in default_settings.items():
            setting = Setting.query.filter_by(key=key).first()
            if not setting:
                setting = Setting(key=key, value=value)
                db.session.add(setting)
                logger.info(f"Added default setting: {key}={value}")
        
        # Lưu vào database
        try:
            db.session.commit()
            logger.info("Database initialized with default settings")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error initializing database: {e}")
            raise