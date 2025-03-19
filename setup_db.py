#!/usr/bin/env python3
"""
Script đơn giản để thiết lập và kiểm tra database

Script này thực hiện:
1. Tạo thư mục và tệp database nếu chưa tồn tại
2. Khởi tạo các bảng cần thiết
3. Tạo tài khoản admin mặc định nếu chưa có
4. Kiểm tra cấu trúc database
"""

import os
import sys
import logging
import sqlite3
import hashlib
from pathlib import Path

# Thiết lập logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'setup_db.log'))
    ]
)
logger = logging.getLogger(__name__)

def hash_password(password):
    """Tạo băm mật khẩu an toàn"""
    # Sử dụng SHA-256 cho mật khẩu
    return hashlib.sha256(password.encode()).hexdigest()

def create_tables(conn):
    """Tạo các bảng cần thiết"""
    try:
        cursor = conn.cursor()
        
        # Bảng users
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
        ''')
        
        # Bảng devices
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            api_port INTEGER DEFAULT 8728,
            status TEXT DEFAULT 'unknown',
            device_type TEXT DEFAULT 'router',
            model TEXT,
            serial_number TEXT,
            firmware_version TEXT,
            last_seen TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            group_id INTEGER,
            notes TEXT,
            location TEXT,
            coordinates TEXT,
            FOREIGN KEY (group_id) REFERENCES device_groups(id)
        )
        ''')
        
        # Bảng metrics
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id INTEGER NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            cpu_load REAL,
            memory_usage REAL,
            uptime INTEGER,
            disk_usage REAL,
            temperature REAL,
            client_count INTEGER,
            traffic_in REAL,
            traffic_out REAL,
            FOREIGN KEY (device_id) REFERENCES devices(id)
        )
        ''')
        
        # Bảng alert_rules
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS alert_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            metric TEXT NOT NULL,
            condition TEXT NOT NULL,
            threshold REAL NOT NULL,
            device_id INTEGER,
            group_id INTEGER,
            enabled BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notify_email BOOLEAN DEFAULT 0,
            notify_sms BOOLEAN DEFAULT 0,
            notify_telegram BOOLEAN DEFAULT 0,
            severity TEXT DEFAULT 'warning',
            FOREIGN KEY (device_id) REFERENCES devices(id),
            FOREIGN KEY (group_id) REFERENCES device_groups(id)
        )
        ''')
        
        # Bảng alerts
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_id INTEGER NOT NULL,
            device_id INTEGER NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            value REAL,
            message TEXT,
            status TEXT DEFAULT 'active',
            acknowledged_by INTEGER,
            acknowledged_at TIMESTAMP,
            resolved_at TIMESTAMP,
            FOREIGN KEY (rule_id) REFERENCES alert_rules(id),
            FOREIGN KEY (device_id) REFERENCES devices(id),
            FOREIGN KEY (acknowledged_by) REFERENCES users(id)
        )
        ''')
        
        # Bảng device_groups
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS device_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Bảng settings
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            description TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        conn.commit()
        logger.info("Các bảng cơ sở dữ liệu đã được tạo thành công")
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Lỗi khi tạo bảng: {e}")
        return False

def create_admin_user(conn):
    """Tạo người dùng admin nếu chưa có"""
    try:
        cursor = conn.cursor()
        
        # Kiểm tra xem đã có người dùng admin chưa
        cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
        user_count = cursor.fetchone()[0]
        
        # Nếu chưa có người dùng admin, tạo người dùng admin mặc định
        if user_count == 0:
            # Lấy thông tin người dùng từ biến môi trường hoặc sử dụng giá trị mặc định
            admin_username = os.environ.get('DATABASE_INIT_USER', 'admin')
            admin_password = os.environ.get('DATABASE_INIT_PASSWORD', 'mikrotik_monitor_admin')
            admin_email = os.environ.get('DATABASE_INIT_EMAIL', 'admin@example.com')
            
            # Băm mật khẩu
            password_hash = hash_password(admin_password)
            
            # Thêm người dùng admin
            cursor.execute('''
            INSERT INTO users (username, email, password_hash, role)
            VALUES (?, ?, ?, 'admin')
            ''', (admin_username, admin_email, password_hash))
            
            conn.commit()
            logger.info(f"Đã tạo người dùng admin với username: {admin_username}")
            return True
        else:
            logger.info("Người dùng admin đã tồn tại")
            return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Lỗi khi tạo người dùng admin: {e}")
        return False

def verify_database_structure(conn):
    """Kiểm tra cấu trúc database"""
    try:
        cursor = conn.cursor()
        
        # Lấy danh sách các bảng cần kiểm tra từ biến môi trường hoặc sử dụng danh sách mặc định
        tables_to_verify = os.environ.get('DATABASE_TABLES_VERIFY', 'users,devices,metrics,alert_rules,alerts,settings').split(',')
        
        # Kiểm tra từng bảng
        for table in tables_to_verify:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not cursor.fetchone():
                logger.warning(f"Bảng {table} không tồn tại trong database")
                return False
            else:
                logger.info(f"Bảng {table} đã được xác minh")
        
        logger.info("Cấu trúc cơ sở dữ liệu đã được xác nhận")
        return True
    except Exception as e:
        logger.error(f"Lỗi khi kiểm tra cấu trúc database: {e}")
        return False

def setup_database():
    """Thiết lập database ban đầu"""
    try:
        # Thiết lập đường dẫn tới database
        db_path_env = os.environ.get('DATABASE_PATH')
        if db_path_env:
            if os.path.isabs(db_path_env):
                db_path = db_path_env
            else:
                db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), db_path_env)
        else:
            # Đường dẫn mặc định
            instance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
            if not os.path.exists(instance_path):
                os.makedirs(instance_path)
                logger.info(f"Đã tạo thư mục instance: {instance_path}")
            db_path = os.path.join(instance_path, 'mikrotik_monitor.db')
        
        # Tạo thư mục cha của database nếu chưa tồn tại
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        logger.info(f"Sử dụng database tại: {db_path}")
        
        # Kết nối đến database
        conn = sqlite3.connect(db_path)
        
        # Tạo các bảng
        if not create_tables(conn):
            logger.error("Không thể tạo các bảng cần thiết")
            conn.close()
            return False
        
        # Tạo người dùng admin
        if not create_admin_user(conn):
            logger.error("Không thể tạo người dùng admin")
            conn.close()
            return False
        
        # Kiểm tra cấu trúc database
        if not verify_database_structure(conn):
            logger.warning("Cấu trúc database không đầy đủ")
        
        # Đóng kết nối
        conn.close()
        
        logger.info("Thiết lập database hoàn tất")
        return True
    except Exception as e:
        logger.error(f"Lỗi không xác định khi thiết lập database: {e}")
        return False

if __name__ == "__main__":
    # Nếu script được chạy trực tiếp
    if setup_database():
        logger.info("Thiết lập database thành công")
        sys.exit(0)
    else:
        logger.error("Thiết lập database thất bại")
        sys.exit(1)