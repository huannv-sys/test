"""
API endpoints cho giám sát thiết bị MikroTik
"""

import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from mik.app.database.crud import (
    get_user_by_id, get_device_by_id, get_devices_count,
    get_metrics_for_device, get_recent_alerts, get_alerts_count,
    get_all_alert_rules, get_alert_rule_by_id, create_alert_rule,
    update_alert_rule, delete_alert_rule
)
from mik.app.core.mikrotik import (
    get_device_metrics, get_device_clients, get_interface_traffic
)
from mik.app.core.vpn import get_vpn_stats
from mik.app.utils.security import sanitize_input
from mik.app.utils.time_series import resample_time_series

logger = logging.getLogger('mikrotik_monitor.api.monitoring')
bp = Blueprint('monitoring', __name__, url_prefix='/monitoring')

@bp.route('/api/devices/<int:device_id>/metrics', methods=['GET'])
@jwt_required()
def get_device_metrics_route(device_id):
    """Get current metrics for a device"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    if not user:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get device
    device = get_device_by_id(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    # Get metrics
    metrics = get_device_metrics(device)
    return jsonify(metrics), 200

@bp.route('/api/devices/<int:device_id>/metrics/history', methods=['GET'])
@jwt_required()
def get_metrics_history(device_id):
    """Get historical metrics for a device"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    if not user:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get device
    device = get_device_by_id(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    # Get query parameters
    metric_type = request.args.get('type')
    metric_name = request.args.get('name')
    hours = request.args.get('hours', 24, type=int)
    interval_minutes = request.args.get('interval', 5, type=int)
    
    # Calculate time range
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=hours)
    
    # Get metrics from database
    metrics = get_metrics_for_device(
        device_id=device_id,
        metric_type=metric_type,
        metric_name=metric_name,
        start_time=start_time,
        end_time=end_time
    )
    
    # Resample metrics if needed
    if interval_minutes > 0 and len(metrics) > 0:
        metrics = resample_time_series(metrics, interval_minutes=interval_minutes)
    
    return jsonify({
        "device_id": device_id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "interval_minutes": interval_minutes,
        "metrics": metrics
    }), 200

@bp.route('/api/devices/<int:device_id>/clients', methods=['GET'])
@jwt_required()
def get_clients_route(device_id):
    """Get clients connected to a device"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    if not user:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get device
    device = get_device_by_id(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    # Get clients
    clients = get_device_clients(device)
    return jsonify(clients), 200

@bp.route('/api/devices/<int:device_id>/traffic', methods=['GET'])
@jwt_required()
def get_traffic_route(device_id):
    """Get interface traffic for a device"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    if not user:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get device
    device = get_device_by_id(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    # Get query parameters
    interface_name = request.args.get('interface')
    
    # Get traffic data
    traffic = get_interface_traffic(device, interface_name=interface_name)
    return jsonify(traffic), 200

@bp.route('/api/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_metrics():
    """Get summary metrics for dashboard"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    if not user:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get overall statistics
    devices_count = get_devices_count()
    alerts_count = get_alerts_count()
    recent_alerts = get_recent_alerts(limit=5)
    
    # Get device metrics (for now, just return counts)
    return jsonify({
        "devices_count": devices_count,
        "alerts_count": alerts_count,
        "recent_alerts": recent_alerts,
        "timestamp": datetime.utcnow().isoformat()
    }), 200

@bp.route('/api/alerts', methods=['GET'])
@jwt_required()
def get_alerts():
    """Get recent alerts"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    if not user:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get query parameters
    limit = request.args.get('limit', 20, type=int)
    
    # Get alerts
    alerts = get_recent_alerts(limit=limit)
    return jsonify(alerts), 200

@bp.route('/api/alert-rules', methods=['GET'])
@jwt_required()
def get_alert_rules_route():
    """Get alert rules"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    if not user:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get query parameters
    enabled_only = request.args.get('enabled_only', 'false').lower() == 'true'
    
    # Get alert rules
    rules = get_all_alert_rules(enabled_only=enabled_only)
    return jsonify(rules), 200

@bp.route('/api/alert-rules', methods=['POST'])
@jwt_required()
def add_alert_rule():
    """Add a new alert rule"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    
    # Chỉ admin và operator có thể thêm rule
    if not user or (user.role != 'admin' and user.role != 'operator'):
        return jsonify({"error": "Unauthorized access"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400
    
    # Validate required fields
    name = sanitize_input(data.get('name', ''))
    device_id = data.get('device_id')
    metric = sanitize_input(data.get('metric', ''))
    condition = sanitize_input(data.get('condition', ''))
    threshold = data.get('threshold')
    
    if not name or not device_id or not metric or not condition or threshold is None:
        return jsonify({"error": "Name, device_id, metric, condition, and threshold are required"}), 400
    
    # Convert threshold to float
    try:
        threshold = float(threshold)
    except ValueError:
        return jsonify({"error": "Threshold must be a number"}), 400
    
    # Get optional fields
    duration = data.get('duration', 0)
    enabled = data.get('enabled', True)
    notify_email = data.get('notify_email', False)
    notify_telegram = data.get('notify_telegram', False)
    email_recipients = sanitize_input(data.get('email_recipients', ''))
    message_template = sanitize_input(data.get('message_template', ''))
    
    # Validate device exists
    device = get_device_by_id(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    try:
        # Create alert rule
        rule = create_alert_rule(
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
        
        logger.info(f"Alert rule created by user {user.username}: {name}")
        return jsonify({"message": "Alert rule created successfully", "rule": rule.to_dict()}), 201
    
    except Exception as e:
        logger.error(f"Error creating alert rule: {e}")
        return jsonify({"error": str(e)}), 500

@bp.route('/api/alert-rules/<int:rule_id>', methods=['PUT'])
@jwt_required()
def update_alert_rule_route(rule_id):
    """Update an alert rule"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    
    # Chỉ admin và operator có thể cập nhật rule
    if not user or (user.role != 'admin' and user.role != 'operator'):
        return jsonify({"error": "Unauthorized access"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400
    
    # Get rule to update
    rule = get_alert_rule_by_id(rule_id)
    if not rule:
        return jsonify({"error": "Alert rule not found"}), 404
    
    # Get fields to update
    name = sanitize_input(data.get('name'))
    device_id = data.get('device_id')
    metric = sanitize_input(data.get('metric'))
    condition = sanitize_input(data.get('condition'))
    threshold = data.get('threshold')
    duration = data.get('duration')
    enabled = data.get('enabled')
    notify_email = data.get('notify_email')
    notify_telegram = data.get('notify_telegram')
    email_recipients = sanitize_input(data.get('email_recipients'))
    message_template = sanitize_input(data.get('message_template'))
    
    # Convert threshold to float if provided
    if threshold is not None:
        try:
            threshold = float(threshold)
        except ValueError:
            return jsonify({"error": "Threshold must be a number"}), 400
    
    try:
        # Update alert rule
        updated_rule = update_alert_rule(
            rule_id=rule_id,
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
        
        logger.info(f"Alert rule updated by user {user.username}: {rule.name} (ID: {rule_id})")
        return jsonify({"message": "Alert rule updated successfully", "rule": updated_rule.to_dict()}), 200
    
    except Exception as e:
        logger.error(f"Error updating alert rule: {e}")
        return jsonify({"error": str(e)}), 500

@bp.route('/api/alert-rules/<int:rule_id>', methods=['DELETE'])
@jwt_required()
def delete_alert_rule_route(rule_id):
    """Delete an alert rule"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    
    # Chỉ admin có thể xóa rule
    if not user or user.role != 'admin':
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get rule to delete
    rule = get_alert_rule_by_id(rule_id)
    if not rule:
        return jsonify({"error": "Alert rule not found"}), 404
    
    # Delete rule
    success = delete_alert_rule(rule_id)
    if not success:
        return jsonify({"error": "Error deleting alert rule"}), 500
    
    logger.info(f"Alert rule deleted by user {user.username}: {rule.name} (ID: {rule_id})")
    return jsonify({"message": "Alert rule deleted successfully"}), 200

@bp.route('/api/devices/<int:device_id>/vpn', methods=['GET'])
@jwt_required()
def get_vpn_route(device_id):
    """Get VPN information for a device"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    if not user:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get device
    device = get_device_by_id(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    # Get VPN data
    vpn_data = get_vpn_stats(device)
    return jsonify(vpn_data), 200