"""
Khởi tạo ứng dụng MikroTik Monitor
"""

import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_jwt_extended import JWTManager
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import DeclarativeBase

# Khởi tạo base class cho SQLAlchemy 2.0+
class Base(DeclarativeBase):
    pass

# Khởi tạo các extension
db = SQLAlchemy(model_class=Base)
login_manager = LoginManager()
jwt = JWTManager()
scheduler = BackgroundScheduler(daemon=True)

def create_app():
    """Tạo và cấu hình ứng dụng Flask"""
    # Tạo ứng dụng Flask
    app = Flask(__name__)
    
    # Tải cấu hình
    app.config.from_object('mik.app.config.Config')
    
    # Khởi tạo các extension
    db.init_app(app)
    login_manager.init_app(app)
    jwt.init_app(app)
    
    # Đảm bảo thư mục instance tồn tại
    try:
        os.makedirs(app.instance_path, exist_ok=True)
    except OSError:
        pass
    
    # Tạo các bảng database nếu chưa tồn tại
    with app.app_context():
        db.create_all()
    
    # Các hàm tiện ích cho template
    @app.context_processor
    def utility_processor():
        return {
            'app_name': app.config.get('APP_NAME', 'MikroTik Monitor'),
            'app_version': app.config.get('APP_VERSION', '1.0.0')
        }
    
    # Đăng ký các blueprint
    from mik.app.main.routes import init_app as init_main
    init_main(app)
    
    from mik.app.api.auth import bp as auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    
    from mik.app.api.devices import bp as devices_bp
    app.register_blueprint(devices_bp, url_prefix='/api/devices')
    
    from mik.app.api.monitoring import bp as monitoring_bp
    app.register_blueprint(monitoring_bp, url_prefix='/api/monitoring')
    
    from mik.app.api.topology import bp as topology_bp
    app.register_blueprint(topology_bp, url_prefix='/api/topology')
    
    from mik.app.api.config import bp as config_bp
    app.register_blueprint(config_bp, url_prefix='/api/config')
    
    from mik.app.api.qrcodes import qrcode_bp
    app.register_blueprint(qrcode_bp)
    
    # Khởi động các tác vụ nền
    from mik.app.tasks.monitoring import initialize_monitoring_tasks
    from mik.app.tasks.alerts import initialize_alert_tasks
    
    with app.app_context():
        initialize_monitoring_tasks()
        initialize_alert_tasks()
    
    # Đảm bảo scheduler chạy
    if not scheduler.running:
        scheduler.start()
    
    return app