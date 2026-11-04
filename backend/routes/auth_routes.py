from flask import Blueprint, request
from services.auth_service import register_user, login_user, get_current_user_profile
from middleware.auth_middleware import token_required
from utils.validators import validate_registration
from utils.response import success_response, error_response

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    errors = validate_registration(data)
    if errors:
        return error_response("Validation failed", 400, errors=errors)
    
    result, error_msg = register_user(data)
    if error_msg:
        return error_response(error_msg, 400)
    
    return success_response(result, "Registration successful!", 201)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '')
    password = data.get('password', '')

    if not email or not password:
        return error_response("Email and password are required.", 400)

    result, error_msg = login_user(email, password)
    if error_msg:
        return error_response(error_msg, 401)

    return success_response(result, "Login successful!")

@auth_bp.route('/logout', methods=['POST'])
def logout():
    # Stateless JWT logout acknowledged by client clearing token
    return success_response(None, "Logged out successfully.")

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_me():
    user = getattr(request, 'user', None)
    if not user:
        return error_response("Not authenticated", 401)
    
    profile = get_current_user_profile(user['id'])
    if not profile:
        return error_response("User profile not found", 404)
        
    return success_response(profile, "Profile retrieved successfully.")
