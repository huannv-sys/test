"""
API endpoints cho quản lý thiết bị MikroTik
"""

import logging
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from mik.app.database.crud import (
    get_all_devices, get_device_by_id, create_device, 
    update_device, delete_device, get_user_by_id
)
from mik.app.core.mikrotik import (
    get_device_metrics, get_device_clients, get_interface_traffic,
    backup_config, send_command_to_device
)
from mik.app.core.discovery import scan_network
from mik.app.utils.security import sanitize_input
from mik.app.utils.network import validate_subnet

logger = logging.getLogger('mikrotik_monitor.api.devices')
bp = Blueprint('devices', __name__, url_prefix='/devices')

@bp.route('/api/devices', methods=['GET'])
@jwt_required()
def get_devices():
    """Get all devices"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    if not user:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get all devices
    devices = get_all_devices()
    return jsonify(devices), 200

@bp.route('/api/devices/<int:device_id>', methods=['GET'])
@jwt_required()
def get_device(device_id):
    """Get a specific device"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    if not user:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get device
    device = get_device_by_id(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    return jsonify(device.to_dict()), 200

@bp.route('/api/devices', methods=['POST'])
@jwt_required()
def add_device():
    """Add a new device"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    
    # Chỉ admin và operator có thể thêm thiết bị
    if not user or (user.role != 'admin' and user.role != 'operator'):
        return jsonify({"error": "Unauthorized access"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400
    
    # Validate required fields
    name = sanitize_input(data.get('name', ''))
    ip_address = sanitize_input(data.get('ip_address', ''))
    username = sanitize_input(data.get('username', ''))
    password = data.get('password', '')
    
    if not name or not ip_address or not username or not password:
        return jsonify({"error": "Name, IP address, username, and password are required"}), 400
    
    # Get optional fields
    api_port = data.get('api_port', 8728)
    use_ssl = data.get('use_ssl', True)
    model = sanitize_input(data.get('model', ''))
    location = sanitize_input(data.get('location', ''))
    notes = sanitize_input(data.get('notes', ''))
    
    try:
        # Create device
        device = create_device(
            name=name,
            ip_address=ip_address,
            username=username,
            password=password,
            api_port=api_port,
            use_ssl=use_ssl,
            model=model,
            location=location,
            notes=notes
        )
        
        logger.info(f"Device added by user {user.username}: {name} ({ip_address})")
        return jsonify({"message": "Device added successfully", "device": device.to_dict()}), 201
    
    except Exception as e:
        logger.error(f"Error adding device: {e}")
        return jsonify({"error": str(e)}), 500

@bp.route('/api/devices/<int:device_id>', methods=['PUT'])
@jwt_required()
def update_device_route(device_id):
    """Update a device"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    
    # Chỉ admin và operator có thể cập nhật thiết bị
    if not user or (user.role != 'admin' and user.role != 'operator'):
        return jsonify({"error": "Unauthorized access"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400
    
    # Get device to update
    device = get_device_by_id(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    # Get fields to update
    name = sanitize_input(data.get('name'))
    ip_address = sanitize_input(data.get('ip_address'))
    username = sanitize_input(data.get('username'))
    password = data.get('password')
    api_port = data.get('api_port')
    use_ssl = data.get('use_ssl')
    model = sanitize_input(data.get('model'))
    location = sanitize_input(data.get('location'))
    notes = sanitize_input(data.get('notes'))
    
    try:
        # Update device
        updated_device = update_device(
            device_id=device_id,
            name=name,
            ip_address=ip_address,
            username=username,
            password=password,
            api_port=api_port,
            use_ssl=use_ssl,
            model=model,
            location=location,
            notes=notes
        )
        
        logger.info(f"Device updated by user {user.username}: {device.name} (ID: {device_id})")
        return jsonify({"message": "Device updated successfully", "device": updated_device.to_dict()}), 200
    
    except Exception as e:
        logger.error(f"Error updating device: {e}")
        return jsonify({"error": str(e)}), 500

@bp.route('/api/devices/<int:device_id>', methods=['DELETE'])
@jwt_required()
def delete_device_route(device_id):
    """Delete a device"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    
    # Chỉ admin có thể xóa thiết bị
    if not user or user.role != 'admin':
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get device to delete
    device = get_device_by_id(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    # Delete device
    success = delete_device(device_id)
    if not success:
        return jsonify({"error": "Error deleting device"}), 500
    
    logger.info(f"Device deleted by user {user.username}: {device.name} (ID: {device_id})")
    return jsonify({"message": "Device deleted successfully"}), 200

@bp.route('/api/devices/<int:device_id>/metrics', methods=['GET'])
@jwt_required()
def get_metrics(device_id):
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

@bp.route('/api/devices/<int:device_id>/backup', methods=['POST'])
@jwt_required()
def backup_device_config(device_id):
    """Backup device configuration"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    
    # Chỉ admin và operator có thể sao lưu cấu hình
    if not user or (user.role != 'admin' and user.role != 'operator'):
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get device
    device = get_device_by_id(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    # Backup configuration
    backup_result = backup_config(device)
    if not backup_result or backup_result.get('status') != 'success':
        error_msg = backup_result.get('error', 'Unknown error') if backup_result else 'Failed to backup'
        return jsonify({"error": f"Failed to backup: {error_msg}"}), 500
    
    logger.info(f"Configuration backup created by user {user.username}: {device.name} (ID: {device_id})")
    return jsonify(backup_result), 200

@bp.route('/api/scan', methods=['POST'])
@jwt_required()
def scan_for_devices():
    """Scan network for MikroTik devices"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    
    # Chỉ admin và operator có thể quét mạng
    if not user or (user.role != 'admin' and user.role != 'operator'):
        return jsonify({"error": "Unauthorized access"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400
    
    subnet = sanitize_input(data.get('subnet', ''))
    if not subnet:
        return jsonify({"error": "Network subnet is required"}), 400
    
    # Validate subnet
    if not validate_subnet(subnet):
        return jsonify({"error": "Invalid subnet format"}), 400
    
    # Get optional parameters
    ports = data.get('ports', [8728, 8729])
    
    try:
        # Scan for devices
        logger.info(f"Starting network scan by user {user.username}: {subnet}")
        discovered_devices = scan_network(subnet, ports=ports)
        
        return jsonify({
            "message": "Network scan completed",
            "subnet": subnet,
            "discovered_devices": discovered_devices,
            "count": len(discovered_devices)
        }), 200
    
    except Exception as e:
        logger.error(f"Error scanning network: {e}")
        return jsonify({"error": str(e)}), 500

@bp.route('/api/devices/<int:device_id>/command', methods=['POST'])
@jwt_required()
def send_command(device_id):
    """Send CLI command to device"""
    # Get user
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    
    # Chỉ admin có thể gửi lệnh
    if not user or user.role != 'admin':
        return jsonify({"error": "Unauthorized access"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400
    
    command = data.get('command', '')
    if not command:
        return jsonify({"error": "Command is required"}), 400
    
    # Get device
    device = get_device_by_id(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    # Send command
    command_result = send_command_to_device(device, command)
    
    logger.info(f"Command sent to device by user {user.username}: {device.name} (ID: {device_id}): {command}")
    return jsonify(command_result), 200