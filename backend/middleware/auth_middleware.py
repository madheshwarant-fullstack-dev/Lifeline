import functools
import jwt
from flask import request
from bson import ObjectId
from config import Config
from database.connection import get_db, serialize_doc
from utils.response import error_response

def token_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return error_response("Authentication token is missing. Please log in.", 401)
        
        parts = auth_header.split(' ')
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return error_response("Invalid authorization token format. Format must be 'Bearer <token>'.", 401)
        
        token = parts[1]
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
            user_id = payload.get('sub') or payload.get('userId')
            if not user_id:
                return error_response("Invalid token payload.", 401)
            
            db = get_db()
            user = db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                return error_response("User account no longer exists.", 401)
            
            if user.get('status') == 'BLOCKED':
                return error_response("Your account has been suspended by an administrator.", 403)
            
            # Attach user to request object
            request.user = serialize_doc(user)
            # Remove password hash from attached user
            if 'password' in request.user:
                del request.user['password']

        except jwt.ExpiredSignatureError:
            return error_response("Session expired. Please log in again.", 401)
        except (jwt.InvalidTokenError, Exception) as e:
            return error_response("Invalid or corrupted authentication token.", 401)
            
        return f(*args, **kwargs)
    return decorated

def role_required(*roles):
    """
    Requires the authenticated user to have one of the specified roles.
    Example: @role_required('ADMIN') or @role_required('DONOR', 'ADMIN')
    """
    def decorator(f):
        @functools.wraps(f)
        @token_required
        def decorated_function(*args, **kwargs):
            user = getattr(request, 'user', None)
            if not user:
                return error_response("Authentication required.", 401)
            
            user_role = user.get('role', '').upper()
            allowed_roles = [r.upper() for r in roles]
            
            if user_role not in allowed_roles:
                return error_response(
                    f"Access forbidden: requires one of the following roles: {', '.join(allowed_roles)}.",
                    403
                )
            return f(*args, **kwargs)
        return decorated_function
    return decorator
