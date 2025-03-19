"""
API endpoints cho xác thực và quản lý người dùng
"""

import logging
from flask import Blueprint, request, jsonify, render_template, redirect, url_for, flash, current_app
from flask_wtf import FlaskForm
from flask_jwt_extended import (
    create_access_token, create_refresh_token, current_user, 
    jwt_required, get_jwt_identity, get_jwt, set_access_cookies, 
    set_refresh_cookies, unset_jwt_cookies
)
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired

from mik.app import jwt
from mik.app.database.crud import (
    get_user_by_username, verify_password, update_user_last_login,
    get_all_users, get_user_by_id, create_user, update_user, delete_user
)
from mik.app.utils.security import sanitize_input

logger = logging.getLogger('mikrotik_monitor.auth')
bp = Blueprint('auth', __name__, url_prefix='/auth')

# Form cho trang đăng nhập
class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

@bp.route('/login', methods=['GET', 'POST'])
def login():
    """User login form and handler"""
    form = LoginForm()
    
    if form.validate_on_submit():
        username = sanitize_input(form.username.data)
        password = form.password.data
        
        user = get_user_by_username(username)
        if user and verify_password(password, user.password_hash):
            # Create tokens
            access_token = create_access_token(identity=user.id)
            refresh_token = create_refresh_token(identity=user.id)
            
            # Update last login
            update_user_last_login(username)
            
            # Redirect to dashboard with cookies set
            resp = redirect(url_for('main.dashboard'))
            set_access_cookies(resp, access_token)
            set_refresh_cookies(resp, refresh_token)
            
            flash(f'Xin chào, {username}!', 'success')
            return resp
        else:
            flash('Tên đăng nhập hoặc mật khẩu không chính xác.', 'danger')
    
    return render_template('login.html', form=form)

@bp.route('/api/login', methods=['POST'])
def api_login():
    """API login endpoint for programmatic access"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400
    
    username = sanitize_input(data.get('username', ''))
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    user = get_user_by_username(username)
    if user and verify_password(password, user.password_hash):
        # Create tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        # Update last login
        update_user_last_login(username)
        
        # Return tokens in response
        return jsonify({
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role
            }
        }), 200
    else:
        return jsonify({"error": "Invalid username or password"}), 401

@bp.route('/logout')
def logout():
    """User logout"""
    resp = redirect(url_for('auth.login'))
    unset_jwt_cookies(resp)
    flash('Bạn đã đăng xuất thành công.', 'info')
    return resp

@bp.route('/api/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)
    return jsonify({"access_token": access_token}), 200

# User management API endpoints
@bp.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users"""
    # Check if user is admin
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    
    if not user or user.role != 'admin':
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    role = request.args.get('role')
    search = request.args.get('search')
    
    # Get users with pagination
    users = get_all_users(page=page, per_page=per_page, role=role, search=search)
    return jsonify(users), 200

@bp.route('/api/users', methods=['POST'])
@jwt_required()
def add_user():
    """Add a new user"""
    # Check if user is admin
    identity = get_jwt_identity()
    current_user = get_user_by_id(identity)
    
    if not current_user or current_user.role != 'admin':
        return jsonify({"error": "Unauthorized access"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400
    
    # Validate required fields
    username = sanitize_input(data.get('username', ''))
    password = data.get('password', '')
    email = sanitize_input(data.get('email', ''))
    role = sanitize_input(data.get('role', 'user'))
    
    if not username or not password or not email:
        return jsonify({"error": "Username, password, and email are required"}), 400
    
    try:
        # Create user
        user = create_user(username, password, email, role)
        return jsonify({"message": "User created successfully", "user": user.to_dict()}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        return jsonify({"error": "Internal server error"}), 500

@bp.route('/api/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user_route(user_id):
    """Update a user"""
    # Check if user is admin
    identity = get_jwt_identity()
    current_user = get_user_by_id(identity)
    
    if not current_user or (current_user.role != 'admin' and current_user.id != user_id):
        return jsonify({"error": "Unauthorized access"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400
    
    # Get fields to update
    username = sanitize_input(data.get('username'))
    password = data.get('password')
    email = sanitize_input(data.get('email'))
    role = sanitize_input(data.get('role'))
    
    # Regular users can only update their own password
    if current_user.role != 'admin' and (username or email or role):
        return jsonify({"error": "You can only update your password"}), 403
    
    try:
        # Update user
        user = update_user(user_id, username, password, email, role)
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({"message": "User updated successfully", "user": user.to_dict()}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        return jsonify({"error": "Internal server error"}), 500

@bp.route('/api/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user_route(user_id):
    """Delete a user"""
    # Check if user is admin
    identity = get_jwt_identity()
    current_user = get_user_by_id(identity)
    
    if not current_user or current_user.role != 'admin':
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Admin cannot delete themselves
    if user_id == identity:
        return jsonify({"error": "You cannot delete your own account"}), 400
    
    # Delete user
    success = delete_user(user_id)
    if not success:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify({"message": "User deleted successfully"}), 200

@bp.route('/api/me', methods=['GET'])
@jwt_required()
def get_current_user_profile():
    """Get current user profile"""
    identity = get_jwt_identity()
    user = get_user_by_id(identity)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify(user.to_dict()), 200

# JWT error handlers
@jwt.unauthorized_loader
def unauthorized_callback(reason):
    """Handle JWT unauthorized error"""
    if request.path.startswith('/api/'):
        return jsonify({"error": "Unauthorized access", "reason": reason}), 401
    else:
        flash('Bạn cần đăng nhập để truy cập trang này.', 'warning')
        return redirect(url_for('auth.login'))

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    """Handle JWT expired token error"""
    if request.path.startswith('/api/'):
        return jsonify({"error": "Token has expired", "refresh": True}), 401
    else:
        flash('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 'warning')
        return redirect(url_for('auth.login'))