"""
Tích hợp Stripe Checkout cho MikroTik Monitor
Cho phép người dùng thanh toán cho các tính năng nâng cao hoặc dịch vụ bổ sung
"""

import os
import stripe
from flask import current_app, redirect, request, url_for

# Cấu hình Stripe API key
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

def get_domain():
    """Lấy domain của ứng dụng phù hợp với môi trường"""
    if os.environ.get('REPLIT_DEPLOYMENT'):
        return os.environ.get('REPLIT_DEV_DOMAIN')
    elif os.environ.get('REPLIT_DOMAINS'):
        return os.environ.get('REPLIT_DOMAINS').split(',')[0]
    else:
        return request.host

def create_checkout_session(items, success_url=None, cancel_url=None):
    """
    Tạo phiên thanh toán Stripe Checkout
    
    Args:
        items (list): Danh sách các mặt hàng cần thanh toán
            Mỗi mặt hàng là một dict với cấu trúc: 
            {
                'price': 'price_id',  # Stripe Price ID
                'quantity': 1
            }
        success_url (str, optional): URL chuyển hướng khi thanh toán thành công
        cancel_url (str, optional): URL chuyển hướng khi hủy thanh toán
        
    Returns:
        str: URL checkout của Stripe
    """
    if not items:
        raise ValueError("Phải có ít nhất một mặt hàng để thanh toán")
    
    domain = get_domain()
    
    # Sử dụng URL mặc định nếu không được cung cấp
    if not success_url:
        success_url = f"https://{domain}/payment/success"
    if not cancel_url:
        cancel_url = f"https://{domain}/payment/cancel"
    
    try:
        checkout_session = stripe.checkout.Session.create(
            line_items=items,
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            automatic_tax={'enabled': True},
        )
        return checkout_session.url
    except stripe.error.StripeError as e:
        current_app.logger.error(f"Lỗi Stripe: {str(e)}")
        raise

def create_subscription_checkout(price_id, success_url=None, cancel_url=None):
    """
    Tạo phiên thanh toán đăng ký Stripe Checkout
    
    Args:
        price_id (str): Stripe Price ID cho gói đăng ký
        success_url (str, optional): URL chuyển hướng khi thanh toán thành công
        cancel_url (str, optional): URL chuyển hướng khi hủy thanh toán
        
    Returns:
        str: URL checkout của Stripe
    """
    domain = get_domain()
    
    # Sử dụng URL mặc định nếu không được cung cấp
    if not success_url:
        success_url = f"https://{domain}/subscription/success"
    if not cancel_url:
        cancel_url = f"https://{domain}/subscription/cancel"
    
    try:
        checkout_session = stripe.checkout.Session.create(
            line_items=[{
                'price': price_id,
                'quantity': 1
            }],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return checkout_session.url
    except stripe.error.StripeError as e:
        current_app.logger.error(f"Lỗi Stripe: {str(e)}")
        raise

def handle_webhook(payload, sig_header):
    """
    Xử lý webhook từ Stripe
    
    Args:
        payload (bytes): Nội dung webhook
        sig_header (str): Chữ ký Stripe webhook
        
    Returns:
        dict: Dữ liệu sự kiện đã xử lý
    """
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        current_app.logger.error(f"Payload không hợp lệ: {str(e)}")
        raise
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        current_app.logger.error(f"Chữ ký không hợp lệ: {str(e)}")
        raise
    
    # Xử lý các loại sự kiện
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        process_payment_success(session)
    elif event['type'] == 'customer.subscription.created':
        subscription = event['data']['object']
        process_subscription_created(subscription)
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        process_subscription_updated(subscription)
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        process_subscription_deleted(subscription)
    
    return event

def process_payment_success(session):
    """
    Xử lý thanh toán thành công
    
    Args:
        session (dict): Dữ liệu phiên Stripe
    """
    # TODO: Cập nhật trạng thái đơn hàng trong database
    # TODO: Gửi email xác nhận
    # TODO: Kích hoạt tính năng đã mua
    current_app.logger.info(f"Thanh toán thành công: {session['id']}")

def process_subscription_created(subscription):
    """
    Xử lý khi tạo đăng ký mới
    
    Args:
        subscription (dict): Dữ liệu đăng ký
    """
    # TODO: Cập nhật trạng thái đăng ký trong database
    # TODO: Kích hoạt tính năng đăng ký
    current_app.logger.info(f"Đăng ký mới được tạo: {subscription['id']}")

def process_subscription_updated(subscription):
    """
    Xử lý khi cập nhật đăng ký
    
    Args:
        subscription (dict): Dữ liệu đăng ký
    """
    # TODO: Cập nhật trạng thái đăng ký trong database
    current_app.logger.info(f"Đăng ký được cập nhật: {subscription['id']}")

def process_subscription_deleted(subscription):
    """
    Xử lý khi hủy đăng ký
    
    Args:
        subscription (dict): Dữ liệu đăng ký
    """
    # TODO: Cập nhật trạng thái đăng ký trong database
    # TODO: Vô hiệu hóa tính năng đăng ký
    current_app.logger.info(f"Đăng ký bị hủy: {subscription['id']}")