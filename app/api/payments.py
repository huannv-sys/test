"""
API endpoints cho thanh toán và đăng ký
"""

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.payments import stripe
from app.database import crud
from app.utils.security import validate_admin_role

payments_bp = Blueprint('payments', __name__, url_prefix='/api/payments')

@payments_bp.route('/create-checkout', methods=['POST'])
@jwt_required()
def create_checkout_session():
    """Tạo một phiên Stripe Checkout mới"""
    try:
        data = request.get_json()
        plan = data.get('plan', 'pro')
        period = data.get('period', 'yearly')
        
        # Định nghĩa các gói và giá
        price_ids = {
            'pro': {
                'monthly': 'price_monthly_id',  # Thay bằng Stripe Price ID thực tế
                'yearly': 'price_yearly_id'     # Thay bằng Stripe Price ID thực tế
            },
            'enterprise': {
                'monthly': 'price_enterprise_monthly_id',  # Thay bằng Stripe Price ID thực tế
                'yearly': 'price_enterprise_yearly_id'     # Thay bằng Stripe Price ID thực tế
            }
        }
        
        # Lấy Price ID dựa trên gói và kỳ hạn
        price_id = price_ids.get(plan, {}).get(period)
        if not price_id:
            return jsonify({"error": "Gói không hợp lệ"}), 400
        
        # Tạo phiên thanh toán
        items = [{
            'price': price_id,
            'quantity': 1
        }]
        
        checkout_url = stripe.create_checkout_session(items)
        
        return jsonify({"url": checkout_url})
    except Exception as e:
        current_app.logger.error(f"Lỗi khi tạo phiên thanh toán: {str(e)}")
        return jsonify({"error": "Không thể tạo phiên thanh toán"}), 500

@payments_bp.route('/create-subscription', methods=['POST'])
@jwt_required()
def create_subscription():
    """Tạo một đăng ký Stripe mới"""
    try:
        data = request.get_json()
        price_id = data.get('price_id')
        
        if not price_id:
            return jsonify({"error": "ID giá không được cung cấp"}), 400
        
        checkout_url = stripe.create_subscription_checkout(price_id)
        
        return jsonify({"url": checkout_url})
    except Exception as e:
        current_app.logger.error(f"Lỗi khi tạo đăng ký: {str(e)}")
        return jsonify({"error": "Không thể tạo đăng ký"}), 500

@payments_bp.route('/webhook', methods=['POST'])
def webhook():
    """Webhook Stripe để xử lý các sự kiện thanh toán"""
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    
    try:
        event = stripe.handle_webhook(payload, sig_header)
        return jsonify({"status": "success"})
    except ValueError as e:
        current_app.logger.error(f"Lỗi webhook Stripe (Invalid payload): {str(e)}")
        return jsonify({"error": "Invalid payload"}), 400
    except stripe.stripe.error.SignatureVerificationError as e:
        current_app.logger.error(f"Lỗi webhook Stripe (Invalid signature): {str(e)}")
        return jsonify({"error": "Invalid signature"}), 400
    except Exception as e:
        current_app.logger.error(f"Lỗi webhook Stripe: {str(e)}")
        return jsonify({"error": "Server error"}), 500

@payments_bp.route('/subscription-status', methods=['GET'])
@jwt_required()
def subscription_status():
    """Lấy trạng thái đăng ký của người dùng hiện tại"""
    user_id = get_jwt_identity()
    
    try:
        # Lấy thông tin đăng ký từ database
        # TODO: Cài đặt logic lấy thông tin đăng ký
        
        # Giá trị mẫu (cần thay thế bằng dữ liệu thực tế)
        subscription = {
            "status": "active",
            "plan": "pro",
            "period": "yearly",
            "current_period_end": "2024-03-19T00:00:00Z",
            "cancel_at_period_end": False
        }
        
        return jsonify(subscription)
    except Exception as e:
        current_app.logger.error(f"Lỗi khi lấy trạng thái đăng ký: {str(e)}")
        return jsonify({"error": "Không thể lấy thông tin đăng ký"}), 500

@payments_bp.route('/subscription-history', methods=['GET'])
@jwt_required()
def subscription_history():
    """Lấy lịch sử đăng ký của người dùng hiện tại"""
    user_id = get_jwt_identity()
    
    try:
        # Lấy lịch sử đăng ký từ database
        # TODO: Cài đặt logic lấy lịch sử đăng ký
        
        # Giá trị mẫu (cần thay thế bằng dữ liệu thực tế)
        history = [
            {
                "id": "sub_12345",
                "plan": "pro",
                "status": "active",
                "start_date": "2023-03-19T00:00:00Z",
                "end_date": "2024-03-19T00:00:00Z",
                "amount": 499000,
                "currency": "VND"
            }
        ]
        
        return jsonify(history)
    except Exception as e:
        current_app.logger.error(f"Lỗi khi lấy lịch sử đăng ký: {str(e)}")
        return jsonify({"error": "Không thể lấy lịch sử đăng ký"}), 500

@payments_bp.route('/cancel-subscription', methods=['POST'])
@jwt_required()
def cancel_subscription():
    """Hủy đăng ký của người dùng hiện tại"""
    user_id = get_jwt_identity()
    
    try:
        # Hủy đăng ký
        # TODO: Cài đặt logic hủy đăng ký
        
        return jsonify({"status": "success", "message": "Đăng ký đã được hủy thành công"})
    except Exception as e:
        current_app.logger.error(f"Lỗi khi hủy đăng ký: {str(e)}")
        return jsonify({"error": "Không thể hủy đăng ký"}), 500

@payments_bp.route('/invoices', methods=['GET'])
@jwt_required()
def get_invoices():
    """Lấy danh sách hóa đơn của người dùng hiện tại"""
    user_id = get_jwt_identity()
    
    try:
        # Lấy danh sách hóa đơn từ database
        # TODO: Cài đặt logic lấy danh sách hóa đơn
        
        # Giá trị mẫu (cần thay thế bằng dữ liệu thực tế)
        invoices = [
            {
                "id": "inv_12345",
                "number": "INV-001",
                "amount": 499000,
                "currency": "VND",
                "status": "paid",
                "created_at": "2023-03-19T00:00:00Z",
                "paid_at": "2023-03-19T00:00:01Z",
                "pdf_url": "https://example.com/invoice-12345.pdf"
            }
        ]
        
        return jsonify(invoices)
    except Exception as e:
        current_app.logger.error(f"Lỗi khi lấy danh sách hóa đơn: {str(e)}")
        return jsonify({"error": "Không thể lấy danh sách hóa đơn"}), 500