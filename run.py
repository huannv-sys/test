#!/usr/bin/env python3
"""
Tệp khởi động chính cho ứng dụng MikroTik Monitor
"""

import os
import sys
import signal
import logging
import sqlite3
import atexit
from pathlib import Path
from importlib import import_module

# Kiểm tra nếu Flask được cài đặt
try:
    from flask import Flask, jsonify
except ImportError:
    logging.error("Flask không được cài đặt. Hãy cài đặt bằng lệnh: sudo apt-get install python3-flask")
    sys.exit(1)

# Thiết lập logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app.log'))
    ]
)
logger = logging.getLogger(__name__)

def check_database():
    """Kiểm tra và thiết lập database nếu cần"""
    try:
        # Thiết lập đường dẫn đến database
        instance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
        if not os.path.exists(instance_path):
            os.makedirs(instance_path)
            logger.info(f"Đã tạo thư mục instance: {instance_path}")
        
        db_path = os.path.join(instance_path, 'mikrotik_monitor.db')
        if not os.path.exists(db_path):
            logger.info(f"Database không tồn tại, đang tạo tại: {db_path}")
            
            # Chạy setup_db.py nếu tồn tại
            setup_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'setup_db.py')
            if os.path.exists(setup_db_path):
                logger.info("Đang chạy setup_db.py để thiết lập database...")
                # Lưu thư mục hiện tại
                original_dir = os.getcwd()
                # Chuyển đến thư mục chứa setup_db.py
                os.chdir(os.path.dirname(os.path.abspath(__file__)))
                
                try:
                    import setup_db
                    setup_db.setup_database()
                    logger.info("Database đã được thiết lập thành công")
                except Exception as e:
                    logger.error(f"Lỗi khi thiết lập database: {e}")
                
                # Quay lại thư mục ban đầu
                os.chdir(original_dir)
            else:
                # Tạo file database trống nếu không có setup_db.py
                conn = sqlite3.connect(db_path)
                conn.close()
                logger.warning("File setup_db.py không tìm thấy, đã tạo database trống")
    except Exception as e:
        logger.error(f"Lỗi khi kiểm tra database: {e}")
        return False
    
    return True

def start_app():
    """Khởi động ứng dụng Flask đơn giản"""
    try:
        from flask import Flask, jsonify
    except ImportError:
        logger.error("Flask không được cài đặt. Hãy cài đặt bằng: sudo apt-get install python3-flask")
        sys.exit(1)
    
    # Thiết lập biến môi trường
    os.environ['FLASK_APP'] = 'run.py'
    
    # Tạo ứng dụng Flask đơn giản
    app = Flask(__name__)
    
    # Lấy thông tin cổng và host từ biến môi trường hoặc mặc định
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5002))  # Đổi cổng mặc định thành 5002
    
    logger.info(f"Khởi động MikroTik Monitor đơn giản trên {host}:{port}...")
    
    # Bắt tín hiệu để tắt ứng dụng đúng cách
    def signal_handler(sig, frame):
        logger.info("Nhận tín hiệu thoát, đang đóng ứng dụng...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Đăng ký hàm xử lý khi thoát
    def cleanup():
        logger.info("Đang dọn dẹp và đóng ứng dụng...")
    
    atexit.register(cleanup)
    
    # Định nghĩa route cơ bản
    @app.route('/')
    def index():
        from datetime import datetime
        return """
        <html>
            <head>
                <title>MikroTik Monitor</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                    h1 { color: #2c3e50; }
                    .status { background-color: #f8f9fa; padding: 20px; border-radius: 5px; }
                    .success { color: #28a745; }
                </style>
            </head>
            <body>
                <h1>MikroTik Monitor</h1>
                <div class="status">
                    <h2>Trạng thái máy chủ</h2>
                    <p><span class="success">✓</span> Máy chủ đang hoạt động</p>
                    <p>Thời gian máy chủ: """ + str(datetime.now()) + """</p>
                </div>
                <h2>Thông tin đăng nhập</h2>
                <p>Username: admin</p>
                <p>Password: mikrotik_monitor_admin</p>
            </body>
        </html>
        """
    
    @app.route('/api/status')
    def status():
        from datetime import datetime
        return jsonify({
            'status': 'ok',
            'server_time': str(datetime.now()),
            'version': '1.0.0'
        })
    
    # Khởi động ứng dụng Flask
    app.run(host=host, port=port, debug=os.getenv('FLASK_DEBUG', '0') == '1')

if __name__ == "__main__":
    try:
        # Kiểm tra và thiết lập database
        if check_database():
            # Khởi động ứng dụng
            start_app()
        else:
            logger.error("Không thể khởi động ứng dụng do lỗi database")
            sys.exit(1)
    except ImportError as e:
        logger.error(f"Lỗi import module: {e}")
        logger.error("Đảm bảo rằng bạn đã cài đặt đầy đủ các gói phụ thuộc và PYTHONPATH được thiết lập đúng")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Lỗi không xác định khi khởi động ứng dụng: {e}")
        sys.exit(1)