from datetime import datetime, timezone
from bson import ObjectId
from database.connection import get_db, serialize_doc

def create_notification(recipient_id, recipient_email, title, message, notif_type="SYSTEM", related_id=None):
    """Creates a notification record in MongoDB"""
    db = get_db()
    notif_doc = {
        "recipientId": str(recipient_id),
        "recipientEmail": recipient_email,
        "title": title,
        "message": message,
        "type": notif_type,
        "relatedId": str(related_id) if related_id else None,
        "isRead": False,
        "createdAt": datetime.now(timezone.utc)
    }
    result = db.notifications.insert_one(notif_doc)
    notif_doc["_id"] = result.inserted_id
    return serialize_doc(notif_doc)

def get_user_notifications(recipient_id, limit=50):
    db = get_db()
    notifications = list(db.notifications.find(
        {"recipientId": str(recipient_id)}
    ).sort("createdAt", -1).limit(limit))
    return serialize_doc(notifications)

def mark_notification_read(notification_id, recipient_id):
    db = get_db()
    result = db.notifications.update_one(
        {"_id": ObjectId(notification_id), "recipientId": str(recipient_id)},
        {"$set": {"isRead": True}}
    )
    return result.modified_count > 0

def mark_all_notifications_read(recipient_id):
    db = get_db()
    result = db.notifications.update_many(
        {"recipientId": str(recipient_id), "isRead": False},
        {"$set": {"isRead": True}}
    )
    return result.modified_count

def get_unread_count(recipient_id):
    db = get_db()
    return db.notifications.count_documents(
        {"recipientId": str(recipient_id), "isRead": False}
    )
