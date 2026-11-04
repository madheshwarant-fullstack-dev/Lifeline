from flask import Blueprint, request
from services.notification_service import (
    get_user_notifications,
    mark_notification_read,
    mark_all_notifications_read,
    get_unread_count
)
from middleware.auth_middleware import token_required
from utils.response import success_response, error_response

notification_bp = Blueprint('notification_bp', __name__)

@notification_bp.route('', methods=['GET'])
@token_required
def get_notifications():
    user = request.user
    notifications = get_user_notifications(user['id'])
    unread_count = get_unread_count(user['id'])
    return success_response({
        "notifications": notifications,
        "unreadCount": unread_count
    }, "Notifications retrieved.")

@notification_bp.route('/<notification_id>/read', methods=['PUT'])
@token_required
def mark_read(notification_id):
    user = request.user
    success = mark_notification_read(notification_id, user['id'])
    if not success:
        return error_response("Notification not found or already read.", 404)
    return success_response(None, "Notification marked as read.")

@notification_bp.route('/read-all', methods=['PUT'])
@token_required
def mark_all_read():
    user = request.user
    count = mark_all_notifications_read(user['id'])
    return success_response({"count": count}, f"Marked {count} notifications as read.")
