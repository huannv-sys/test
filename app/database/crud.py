"""
Các thao tác CRUD (Create, Read, Update, Delete) cho database
"""

import time
import logging
import functools
from datetime import datetime
from contextlib import contextmanager

from sqlalchemy.exc import SQLAlchemyError

from mik.app import db
from mik.app.database.models import User, Device, Metric, AlertRule, Alert, Setting
from mik.app.utils.security import hash_password, encrypt_device_password

logger = logging.getLogger('mikrotik_monitor.crud')

# Số lượng mục mặc định trên mỗi trang
DEFAULT_PAGE_SIZE = 10

def track_db_performance(func):
    """Decorator để theo dõi hiệu suất truy vấn database"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        elapsed = time.time() - start_time
        
        if elapsed > 0.5:  # Ghi log nếu truy vấn mất hơn 0.5 giây
            logger.warning(f"Slow DB query detected: {func.__name__} took {elapsed:.2f}s")
        
        return result
    return wrapper

@contextmanager
def session_manager(commit=True):
    """Context manager để quản lý phiên SQLAlchemy"""
    try:
        yield
        if commit:
            db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error: {e}")
        raise
    except Exception as e:
        db.session.rollback()
        logger.error(f"Unexpected error during database operation: {e}")
        raise

# User CRUD operations

@track_db_performance
def get_user_by_username(username):
    """Get a user by username with efficient query"""
    return User.query.filter_by(username=username).first()

@track_db_performance
def get_user_by_id(user_id):
    """Get a user by ID with optimized query"""
    return User.query.get(user_id)

@track_db_performance
def get_user_by_email(email):
    """Get a user by email address with index optimization"""
    return User.query.filter_by(email=email).first()

@track_db_performance
def get_all_users(page=1, per_page=DEFAULT_PAGE_SIZE, role=None, search=None):
    """Get all users with pagination and optional filtering
    
    Args:
        page (int): Page number (1-indexed)
        per_page (int): Number of items per page
        role (str, optional): Filter by role
        search (str, optional): Search in username or email
        
    Returns:
        dict: Dict with pagination info and users
    """
    query = User.query
    
    # Apply filters if provided
    if role:
        query = query.filter_by(role=role)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.username.ilike(search_term)) | (User.email.ilike(search_term))
        )
    
    # Apply pagination
    total = query.count()
    query = query.order_by(User.username)
    users = query.offset((page - 1) * per_page).limit(per_page).all()
    
    return {
        'items': [user.to_dict() for user in users],
        'page': page,
        'per_page': per_page,
        'total': total,
        'pages': (total + per_page - 1) // per_page
    }

@track_db_performance
def create_user(username, password, email, role='user'):
    """Create a new user with validation
    
    Args:
        username (str): Username
        password (str): Password hash
        email (str): Email address
        role (str, optional): User role. Defaults to 'user'.
        
    Returns:
        User: Created user object
        
    Raises:
        ValueError: If validation fails
    """
    # Validate username is unique
    if get_user_by_username(username):
        raise ValueError(f"Username '{username}' already exists")
    
    # Validate email is unique
    if get_user_by_email(email):
        raise ValueError(f"Email '{email}' already in use")
    
    # Validate role is valid
    valid_roles = ['admin', 'user', 'operator']
    if role not in valid_roles:
        raise ValueError(f"Invalid role: '{role}'. Valid roles are: {', '.join(valid_roles)}")
    
    # Create and save the user
    user = User(
        username=username,
        password_hash=hash_password(password),
        email=email,
        role=role
    )
    
    with session_manager():
        db.session.add(user)
    
    logger.info(f"User created: {username} (role: {role})")
    return user

@track_db_performance
def update_user(user_id, username=None, password=None, email=None, role=None):
    """Update user details with validation
    
    Args:
        user_id (int): User ID
        username (str, optional): New username
        password (str, optional): New password hash
        email (str, optional): New email address
        role (str, optional): New role
        
    Returns:
        User: Updated user object or None if not found
        
    Raises:
        ValueError: If validation fails
    """
    user = get_user_by_id(user_id)
    if not user:
        return None
    
    # Update username if provided and validate uniqueness
    if username and username != user.username:
        existing_user = get_user_by_username(username)
        if existing_user and existing_user.id != user_id:
            raise ValueError(f"Username '{username}' already exists")
        user.username = username
    
    # Update email if provided and validate uniqueness
    if email and email != user.email:
        existing_user = get_user_by_email(email)
        if existing_user and existing_user.id != user_id:
            raise ValueError(f"Email '{email}' already in use")
        user.email = email
    
    # Update password if provided
    if password:
        user.password_hash = hash_password(password)
    
    # Update role if provided and validate
    if role:
        valid_roles = ['admin', 'user', 'operator']
        if role not in valid_roles:
            raise ValueError(f"Invalid role: '{role}'. Valid roles are: {', '.join(valid_roles)}")
        user.role = role
    
    with session_manager():
        db.session.add(user)
    
    logger.info(f"User updated: {user.username} (ID: {user_id})")
    return user

@track_db_performance
def delete_user(user_id):
    """Delete a user by ID
    
    Args:
        user_id (int): User ID
        
    Returns:
        bool: True if deleted, False if not found
    """
    user = get_user_by_id(user_id)
    if not user:
        return False
    
    username = user.username  # Save for logging
    
    with session_manager():
        db.session.delete(user)
    
    logger.info(f"User deleted: {username} (ID: {user_id})")
    return True

@track_db_performance
def update_user_last_login(username):
    """Update user's last login timestamp
    
    Args:
        username (str): Username
        
    Returns:
        bool: True if updated, False if user not found
    """
    user = get_user_by_username(username)
    if not user:
        return False
    
    user.last_login = datetime.utcnow()
    
    with session_manager():
        db.session.add(user)
    
    return True

# Device CRUD operations

@track_db_performance
def get_all_devices():
    """Get all devices"""
    devices = Device.query.order_by(Device.name).all()
    return [device.to_dict() for device in devices]

@track_db_performance
def get_device_by_id(device_id):
    """Get a device by ID"""
    device = Device.query.get(device_id)
    return device

@track_db_performance
def create_device(name, ip_address, username, password, api_port=8728, use_ssl=True, model=None, location=None, notes=None):
    """Create a new device"""
    # Encrypt the password for storage
    encrypted_password = encrypt_device_password(password)
    
    device = Device(
        name=name,
        ip_address=ip_address,
        username=username,
        password_hash=encrypted_password,
        api_port=api_port,
        use_ssl=use_ssl,
        model=model,
        location=location,
        notes=notes
    )
    
    with session_manager():
        db.session.add(device)
    
    logger.info(f"Device created: {name} ({ip_address})")
    return device

@track_db_performance
def update_device(device_id, name=None, ip_address=None, username=None, password=None, api_port=None, use_ssl=None, model=None, location=None, notes=None):
    """Update device details"""
    device = get_device_by_id(device_id)
    if not device:
        return None
    
    if name:
        device.name = name
    
    if ip_address:
        device.ip_address = ip_address
    
    if username:
        device.username = username
    
    if password:
        device.password_hash = encrypt_device_password(password)
    
    if api_port is not None:
        device.api_port = api_port
    
    if use_ssl is not None:
        device.use_ssl = use_ssl
    
    if model is not None:
        device.model = model
    
    if location is not None:
        device.location = location
    
    if notes is not None:
        device.notes = notes
    
    device.updated_at = datetime.utcnow()
    
    with session_manager():
        db.session.add(device)
    
    logger.info(f"Device updated: {device.name} (ID: {device_id})")
    return device

@track_db_performance
def delete_device(device_id):
    """Delete a device"""
    device = get_device_by_id(device_id)
    if not device:
        return False
    
    device_name = device.name  # Save for logging
    
    with session_manager():
        db.session.delete(device)
    
    logger.info(f"Device deleted: {device_name} (ID: {device_id})")
    return True

@track_db_performance
def get_devices_count():
    """Get count of devices"""
    return Device.query.count()

# Metrics CRUD operations

@track_db_performance
def save_device_metrics(device_id, metrics_data):
    """Save device metrics to database"""
    metrics_objects = []
    
    for metric_type, metrics in metrics_data.items():
        for metric_name, value in metrics.items():
            metric = Metric(
                device_id=device_id,
                metric_type=metric_type,
                metric_name=metric_name,
                value=float(value),
                timestamp=datetime.utcnow()
            )
            metrics_objects.append(metric)
    
    with session_manager():
        db.session.add_all(metrics_objects)
    
    logger.debug(f"Saved {len(metrics_objects)} metrics for device ID {device_id}")
    return len(metrics_objects)

@track_db_performance
def get_metrics_for_device(device_id, metric_type=None, metric_name=None, start_time=None, end_time=None, limit=100):
    """Get metrics for a device with optional filters"""
    query = Metric.query.filter_by(device_id=device_id)
    
    if metric_type:
        query = query.filter_by(metric_type=metric_type)
    
    if metric_name:
        query = query.filter_by(metric_name=metric_name)
    
    if start_time:
        query = query.filter(Metric.timestamp >= start_time)
    
    if end_time:
        query = query.filter(Metric.timestamp <= end_time)
    
    query = query.order_by(Metric.timestamp.desc())
    
    if limit:
        query = query.limit(limit)
    
    metrics = query.all()
    return [metric.to_dict() for metric in metrics]

# Alert rules CRUD operations

@track_db_performance
def get_all_alert_rules(enabled_only=False):
    """Get all alert rules"""
    query = AlertRule.query
    
    if enabled_only:
        query = query.filter_by(enabled=True)
    
    rules = query.order_by(AlertRule.name).all()
    return [rule.to_dict() for rule in rules]

@track_db_performance
def get_alert_rules():
    """Get all alert rules"""
    return AlertRule.query.all()

@track_db_performance
def get_alert_rule_by_id(rule_id):
    """Get an alert rule by ID"""
    return AlertRule.query.get(rule_id)

@track_db_performance
def create_alert_rule(name, device_id, metric, condition, threshold, duration=0, enabled=True, 
                      notify_email=False, notify_telegram=False, email_recipients='', message_template=''):
    """Create a new alert rule"""
    rule = AlertRule(
        name=name,
        device_id=device_id,
        metric=metric,
        condition=condition,
        threshold=threshold,
        duration=duration,
        enabled=enabled,
        notify_email=notify_email,
        notify_telegram=notify_telegram,
        email_recipients=email_recipients,
        message_template=message_template
    )
    
    with session_manager():
        db.session.add(rule)
    
    logger.info(f"Alert rule created: {name} for device ID {device_id}")
    return rule

@track_db_performance
def update_alert_rule(rule_id, name=None, device_id=None, metric=None, condition=None, threshold=None, 
                     duration=None, enabled=None, notify_email=None, notify_telegram=None, 
                     email_recipients=None, message_template=None):
    """Update an alert rule"""
    rule = get_alert_rule_by_id(rule_id)
    if not rule:
        return None
    
    if name:
        rule.name = name
    
    if device_id:
        rule.device_id = device_id
    
    if metric:
        rule.metric = metric
    
    if condition:
        rule.condition = condition
    
    if threshold is not None:
        rule.threshold = threshold
    
    if duration is not None:
        rule.duration = duration
    
    if enabled is not None:
        rule.enabled = enabled
    
    if notify_email is not None:
        rule.notify_email = notify_email
    
    if notify_telegram is not None:
        rule.notify_telegram = notify_telegram
    
    if email_recipients is not None:
        rule.email_recipients = email_recipients
    
    if message_template is not None:
        rule.message_template = message_template
    
    rule.updated_at = datetime.utcnow()
    
    with session_manager():
        db.session.add(rule)
    
    logger.info(f"Alert rule updated: {rule.name} (ID: {rule_id})")
    return rule

@track_db_performance
def delete_alert_rule(rule_id):
    """Delete an alert rule"""
    rule = get_alert_rule_by_id(rule_id)
    if not rule:
        return False
    
    rule_name = rule.name  # Save for logging
    
    with session_manager():
        db.session.delete(rule)
    
    logger.info(f"Alert rule deleted: {rule_name} (ID: {rule_id})")
    return True

# Alert CRUD operations

@track_db_performance
def create_alert(rule_id, device_id, metric, value, threshold, condition):
    """Create a new alert"""
    alert = Alert(
        rule_id=rule_id,
        device_id=device_id,
        metric=metric,
        value=value,
        threshold=threshold,
        condition=condition,
        timestamp=datetime.utcnow(),
        acknowledged=False
    )
    
    with session_manager():
        db.session.add(alert)
    
    logger.info(f"Alert created: {metric} {condition} {threshold} (value: {value}) for device ID {device_id}")
    return alert

@track_db_performance
def get_recent_alerts(limit=20):
    """Get recent alerts"""
    alerts = Alert.query.order_by(Alert.timestamp.desc()).limit(limit).all()
    return [alert.to_dict() for alert in alerts]

@track_db_performance
def get_alerts_count():
    """Get count of unacknowledged alerts"""
    return Alert.query.filter_by(acknowledged=False).count()

@track_db_performance
def acknowledge_alert(alert_id, user_id):
    """Acknowledge an alert"""
    alert = Alert.query.get(alert_id)
    if not alert:
        return False
    
    alert.acknowledged = True
    alert.acknowledged_by = user_id
    alert.acknowledged_at = datetime.utcnow()
    
    with session_manager():
        db.session.add(alert)
    
    logger.info(f"Alert acknowledged: ID {alert_id} by user ID {user_id}")
    return True

# Settings CRUD operations

@track_db_performance
def get_settings():
    """Get all settings as dictionary"""
    settings = Setting.query.all()
    return {setting.key: setting.value for setting in settings}

@track_db_performance
def get_setting(key, default=None):
    """Get a specific setting"""
    setting = Setting.query.filter_by(key=key).first()
    return setting.value if setting else default

@track_db_performance
def update_settings(settings_dict):
    """Update multiple settings at once"""
    updated_count = 0
    
    with session_manager():
        for key, value in settings_dict.items():
            setting = Setting.query.filter_by(key=key).first()
            
            if setting:
                # Update existing setting
                setting.value = value
                db.session.add(setting)
            else:
                # Create new setting
                setting = Setting(key=key, value=value)
                db.session.add(setting)
            
            updated_count += 1
    
    logger.info(f"Updated {updated_count} settings")
    return updated_count