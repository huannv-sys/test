"""
Các routes chính cho ứng dụng web
"""

import logging
import functools
from flask import (
    Blueprint, render_template, redirect, url_for, request, 
    jsonify, current_app, g, flash
)
from flask_login import login_required, current_user
from flask_socketio import emit

from mik.app import socketio
from mik.app.database.crud import get_devices_count, get_alerts_count, get_recent_alerts

logger = logging.getLogger('mikrotik_monitor.routes')
bp = Blueprint('main', __name__)

def role_required(role):
    """Decorator để yêu cầu vai trò người dùng cụ thể"""
    def wrapper(fn):
        @functools.wraps(fn)
        def decorator(*args, **kwargs):
            # Kiểm tra người dùng đã đăng nhập
            if not current_user or not current_user.is_authenticated:
                flash('Bạn cần đăng nhập để truy cập trang này.', 'warning')
                return redirect(url_for('auth.login', next=request.url))
            
            # Kiểm tra vai trò
            if current_user.role != role and current_user.role != 'admin':
                flash(f'Bạn cần có quyền {role} để truy cập trang này.', 'warning')
                return redirect(url_for('main.dashboard'))
            
            return fn(*args, **kwargs)
        return decorator
    return wrapper

@bp.route('/')
def index():
    """Trang chủ / landing page"""
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    return render_template('login.html')

@bp.route('/dashboard')
@login_required
def dashboard():
    """Trang dashboard chính"""
    devices_count = get_devices_count()
    alerts_count = get_alerts_count()
    recent_alerts = get_recent_alerts(limit=5)
    
    return render_template(
        'dashboard.html',
        devices_count=devices_count,
        alerts_count=alerts_count,
        recent_alerts=recent_alerts
    )

@bp.route('/devices')
@login_required
def devices():
    """Trang quản lý thiết bị"""
    return render_template('devices.html')

@bp.route('/monitoring')
@login_required
def monitoring():
    """Trang giám sát thiết bị"""
    return render_template('monitoring.html')

@bp.route('/topology')
@login_required
def topology():
    """Network topology page"""
    return render_template('topology.html')

@bp.route('/vpn-monitoring')
@login_required
def vpn_monitoring():
    """VPN monitoring page"""
    return render_template('vpn_monitoring.html')

@bp.route('/users')
@login_required
@role_required('admin')
def users():
    """Trang quản lý người dùng (chỉ admin)"""
    return render_template('users.html')

@bp.route('/settings')
@login_required
@role_required('admin')
def settings():
    """Trang cài đặt hệ thống (chỉ admin)"""
    return render_template('settings.html')

# WebSocket event handlers

@socketio.on('connect')
def handle_connect():
    """Xử lý kết nối WebSocket"""
    if current_user.is_authenticated:
        logger.info(f"User {current_user.username} connected via WebSocket")
    else:
        logger.info("Anonymous user connected via WebSocket")

@socketio.on('disconnect')
def handle_disconnect():
    """Xử lý ngắt kết nối WebSocket"""
    if current_user.is_authenticated:
        logger.info(f"User {current_user.username} disconnected from WebSocket")
    else:
        logger.info("Anonymous user disconnected from WebSocket")

@socketio.on('update_request')
def handle_update_request(data):
    """Xử lý yêu cầu cập nhật dữ liệu thông qua WebSocket"""
    if not current_user.is_authenticated:
        emit('error', {'message': 'Authentication required'})
        return
    
    request_type = data.get('type')
    device_id = data.get('device_id')
    
    if request_type == 'device_status':
        # Gửi yêu cầu cập nhật trạng thái thiết bị
        if device_id:
            # TODO: Cập nhật trạng thái thiết bị
            emit('device_update', {
                'device_id': device_id,
                'status': 'updating'
            })
    elif request_type == 'dashboard':
        # TODO: Cập nhật dữ liệu dashboard
        pass

# Error handlers

def register_error_handlers(app):
    """Đăng ký các xử lý lỗi cho ứng dụng"""
    
    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('404.html'), 404
    
    @app.errorhandler(500)
    def internal_server_error(e):
        logger.error(f"Internal server error: {e}")
        return render_template('500.html'), 500

def init_app(app):
    """Khởi tạo routes cho ứng dụng Flask"""
    app.register_blueprint(bp)
    register_error_handlers(app)
    
    # Add context processor for templates
    @app.context_processor
    def utility_processor():
        return {
            'app_name': app.config.get('APP_NAME', 'MikroTik Monitor'),
            'app_version': app.config.get('APP_VERSION', '1.0.0')
        }