"""
Tiện ích tạo QR code cho thông tin sức khỏe thiết bị
"""

import json
import base64
import io
import qrcode
from PIL import Image, ImageDraw, ImageFont
import logging

logger = logging.getLogger(__name__)

def generate_device_health_qrcode(device_data, metrics_data=None):
    """
    Tạo QR code chứa thông tin sức khỏe thiết bị
    
    Args:
        device_data (dict): Thông tin cơ bản của thiết bị
        metrics_data (dict, optional): Dữ liệu metric về sức khỏe thiết bị
        
    Returns:
        str: Chuỗi base64 của hình ảnh QR code
    """
    try:
        # Tạo dữ liệu cần mã hóa
        qr_data = {
            "device_id": device_data.get("id"),
            "name": device_data.get("name"),
            "ip_address": device_data.get("ip_address"),
            "model": device_data.get("model"),
            "status": device_data.get("status", "unknown"),
            "timestamp": device_data.get("updated_at")
        }
        
        # Thêm dữ liệu metric nếu có
        if metrics_data:
            qr_data["metrics"] = {
                "cpu": metrics_data.get("cpu_load", 0),
                "memory": metrics_data.get("memory_usage", 0),
                "uptime": metrics_data.get("uptime", ""),
                "temperature": metrics_data.get("temperature", 0)
            }
        
        # Chuyển thành chuỗi JSON
        json_data = json.dumps(qr_data)
        
        # Tạo QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(json_data)
        qr.make(fit=True)
        
        # Tạo hình ảnh QR code
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        # Thêm tiêu đề và thông tin thiết bị vào QR code
        qr_with_title = add_title_to_qrcode(
            qr_img, 
            f"MikroTik: {device_data.get('name')}", 
            f"IP: {device_data.get('ip_address')}"
        )
        
        # Chuyển thành chuỗi base64
        buffered = io.BytesIO()
        qr_with_title.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return img_str
    except Exception as e:
        logger.error(f"Lỗi khi tạo QR code: {e}")
        return None

def add_title_to_qrcode(qr_img, title, subtitle=None):
    """
    Thêm tiêu đề và phụ đề vào hình ảnh QR code
    
    Args:
        qr_img (PIL.Image): Hình ảnh QR code
        title (str): Tiêu đề
        subtitle (str, optional): Phụ đề
        
    Returns:
        PIL.Image: Hình ảnh QR code đã thêm tiêu đề
    """
    # Lấy kích thước QR code
    qr_width, qr_height = qr_img.size
    
    # Tính toán chiều cao cho tiêu đề (khoảng 15% chiều cao QR)
    title_height = int(qr_height * 0.15)
    if subtitle:
        title_height = int(qr_height * 0.2)  # Tăng thêm nếu có phụ đề
    
    # Tạo hình ảnh mới với chiều cao tăng thêm phần tiêu đề
    new_img = Image.new('RGB', (qr_width, qr_height + title_height), color='white')
    
    # Dán QR code vào phần dưới
    new_img.paste(qr_img, (0, title_height))
    
    # Vẽ tiêu đề
    draw = ImageDraw.Draw(new_img)
    
    # Tạo font cho tiêu đề (sử dụng font mặc định)
    try:
        title_font_size = int(title_height * 0.6)
        subtitle_font_size = int(title_height * 0.4)
        
        # Sử dụng font tùy chỉnh nếu có, nếu không sử dụng font mặc định
        title_font = ImageFont.load_default(title_font_size)
        subtitle_font = ImageFont.load_default(subtitle_font_size)
        
    except Exception:
        # Nếu không thể tạo font tùy chỉnh, sử dụng font mặc định
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
    
    # Vẽ tiêu đề ở giữa
    title_width = draw.textlength(title, font=title_font)
    title_position = ((qr_width - title_width) // 2, title_height // 10)
    draw.text(title_position, title, fill='black', font=title_font)
    
    # Vẽ phụ đề nếu có
    if subtitle:
        subtitle_width = draw.textlength(subtitle, font=subtitle_font)
        subtitle_position = ((qr_width - subtitle_width) // 2, title_height // 2)
        draw.text(subtitle_position, subtitle, fill='black', font=subtitle_font)
    
    return new_img

def generate_quick_status_qrcode(status_data):
    """
    Tạo QR code cho trạng thái nhanh của thiết bị
    
    Args:
        status_data (dict): Dữ liệu trạng thái thiết bị
        
    Returns:
        str: Chuỗi base64 của hình ảnh QR code
    """
    try:
        # Tạo URL hoặc uri scheme để mở ứng dụng hoặc trang web với thông tin thiết bị
        device_id = status_data.get("id", "")
        status_url = f"mikrotikmonitor://device/{device_id}/status"
        
        # Tạo QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr.add_data(status_url)
        qr.make(fit=True)
        
        # Tạo hình ảnh QR code
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        # Chuyển thành chuỗi base64
        buffered = io.BytesIO()
        qr_img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return img_str
    except Exception as e:
        logger.error(f"Lỗi khi tạo QR code trạng thái nhanh: {e}")
        return None