"""
API endpoints cho chức năng tạo QR code
"""

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging

from mik.app.database import crud
from mik.app.utils.qrcode_generator import generate_device_health_qrcode, generate_quick_status_qrcode
from mik.app.core.mikrotik import get_device_metrics

qrcode_bp = Blueprint('qrcode', __name__, url_prefix='/api/qrcode')
logger = logging.getLogger(__name__)

@qrcode_bp.route('/device/<int:device_id>', methods=['GET'])
@jwt_required()
def get_device_qrcode(device_id):
    """
    Lấy QR code cho thiết bị cụ thể
    ---
    parameters:
      - name: device_id
        in: path
        type: integer
        required: true
        description: ID của thiết bị
      - name: include_metrics
        in: query
        type: boolean
        required: false
        description: Bao gồm dữ liệu metric trong QR code
    responses:
      200:
        description: QR code đã được tạo thành công
      404:
        description: Không tìm thấy thiết bị
      500:
        description: Lỗi server
    """
    try:
        # Lấy thông tin thiết bị từ database
        device = crud.get_device_by_id(device_id)
        if not device:
            return jsonify({"error": "Device not found"}), 404
        
        # Chuyển đổi device thành dict
        device_data = device.to_dict()
        
        # Kiểm tra xem có bao gồm dữ liệu metric không
        include_metrics = request.args.get('include_metrics', 'false').lower() == 'true'
        metrics_data = None
        
        if include_metrics:
            try:
                # Lấy dữ liệu metric mới nhất
                metrics = get_device_metrics(device)
                if isinstance(metrics, dict) and metrics.get('status') != 'offline':
                    metrics_data = metrics
            except Exception as e:
                logger.warning(f"Không thể lấy dữ liệu metric cho thiết bị {device_id}: {e}")
        
        # Tạo QR code
        qr_image_base64 = generate_device_health_qrcode(device_data, metrics_data)
        
        if not qr_image_base64:
            return jsonify({"error": "Failed to generate QR code"}), 500
        
        return jsonify({
            "device_id": device_id,
            "device_name": device_data.get("name"),
            "qrcode_base64": qr_image_base64
        })
        
    except Exception as e:
        logger.error(f"Lỗi khi tạo QR code cho thiết bị {device_id}: {e}")
        return jsonify({"error": str(e)}), 500

@qrcode_bp.route('/quick-status/<int:device_id>', methods=['GET'])
@jwt_required()
def get_quick_status_qrcode(device_id):
    """
    Lấy QR code trạng thái nhanh cho thiết bị
    ---
    parameters:
      - name: device_id
        in: path
        type: integer
        required: true
        description: ID của thiết bị
    responses:
      200:
        description: QR code đã được tạo thành công
      404:
        description: Không tìm thấy thiết bị
      500:
        description: Lỗi server
    """
    try:
        # Lấy thông tin thiết bị từ database
        device = crud.get_device_by_id(device_id)
        if not device:
            return jsonify({"error": "Device not found"}), 404
        
        # Chuyển đổi device thành dict
        device_data = device.to_dict()
        
        # Tạo QR code trạng thái nhanh
        qr_image_base64 = generate_quick_status_qrcode(device_data)
        
        if not qr_image_base64:
            return jsonify({"error": "Failed to generate QR code"}), 500
        
        return jsonify({
            "device_id": device_id,
            "device_name": device_data.get("name"),
            "qrcode_base64": qr_image_base64
        })
        
    except Exception as e:
        logger.error(f"Lỗi khi tạo QR code trạng thái nhanh cho thiết bị {device_id}: {e}")
        return jsonify({"error": str(e)}), 500

@qrcode_bp.route('/batch', methods=['POST'])
@jwt_required()
def batch_generate_qrcodes():
    """
    Tạo hàng loạt QR codes cho nhiều thiết bị
    ---
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            device_ids:
              type: array
              items:
                type: integer
              description: Danh sách ID thiết bị
            include_metrics:
              type: boolean
              description: Bao gồm dữ liệu metric
    responses:
      200:
        description: QR codes đã được tạo thành công
      400:
        description: Yêu cầu không hợp lệ
      500:
        description: Lỗi server
    """
    try:
        data = request.get_json()
        if not data or not isinstance(data.get('device_ids', []), list):
            return jsonify({"error": "Invalid request. Expected device_ids array"}), 400
        
        device_ids = data.get('device_ids', [])
        include_metrics = data.get('include_metrics', False)
        
        qrcodes = []
        for device_id in device_ids:
            try:
                # Lấy thông tin thiết bị từ database
                device = crud.get_device_by_id(device_id)
                if not device:
                    continue
                
                # Chuyển đổi device thành dict
                device_data = device.to_dict()
                
                # Lấy dữ liệu metric nếu cần
                metrics_data = None
                if include_metrics:
                    try:
                        # Lấy dữ liệu metric mới nhất
                        metrics = get_device_metrics(device)
                        if isinstance(metrics, dict) and metrics.get('status') != 'offline':
                            metrics_data = metrics
                    except Exception:
                        pass
                
                # Tạo QR code
                qr_image_base64 = generate_device_health_qrcode(device_data, metrics_data)
                
                if qr_image_base64:
                    qrcodes.append({
                        "device_id": device_id,
                        "device_name": device_data.get("name"),
                        "qrcode_base64": qr_image_base64
                    })
            except Exception as e:
                logger.error(f"Lỗi khi tạo QR code cho thiết bị {device_id}: {e}")
        
        return jsonify({
            "total": len(qrcodes),
            "qrcodes": qrcodes
        })
        
    except Exception as e:
        logger.error(f"Lỗi khi tạo hàng loạt QR codes: {e}")
        return jsonify({"error": str(e)}), 500