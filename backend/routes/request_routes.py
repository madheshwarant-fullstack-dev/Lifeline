from flask import Blueprint, request
from services.request_service import (
    create_blood_request,
    get_blood_requests,
    get_request_by_id,
    update_request_status,
    delete_request
)
from middleware.auth_middleware import token_required
from utils.validators import validate_blood_request, VALID_REQUEST_STATUSES
from utils.response import success_response, error_response

request_bp = Blueprint('request_bp', __name__)

@request_bp.route('', methods=['POST'])
@token_required
def create_request_endpoint():
    user = request.user
    data = request.get_json() or {}
    
    errors = validate_blood_request(data)
    if errors:
        return error_response("Validation error in request form.", 400, errors=errors)
        
    created, err = create_blood_request(user, data)
    if err:
        return error_response(err, 400)
        
    return success_response(created, "Blood request created and matched successfully!", 201)

@request_bp.route('', methods=['GET'])
def list_requests():
    filters = {
        "bloodGroup": request.args.get('bloodGroup'),
        "state": request.args.get('state'),
        "city": request.args.get('city'),
        "urgency": request.args.get('urgency'),
        "status": request.args.get('status'),
        "requesterId": request.args.get('requesterId')
    }
    requests = get_blood_requests(filters)
    return success_response(requests, f"Found {len(requests)} requests.")

@request_bp.route('/<request_id>', methods=['GET'])
def get_request(request_id):
    req_doc = get_request_by_id(request_id)
    if not req_doc:
        return error_response("Blood request not found.", 404)
    return success_response(req_doc, "Blood request retrieved.")

@request_bp.route('/<request_id>/status', methods=['PUT'])
@token_required
def update_status_endpoint(request_id):
    user = request.user
    data = request.get_json() or {}
    new_status = data.get('status', '').strip().upper()
    
    if new_status not in VALID_REQUEST_STATUSES:
        return error_response(f"Invalid status. Must be one of: {', '.join(VALID_REQUEST_STATUSES)}", 400)
        
    updated, err = update_request_status(request_id, new_status, user)
    if err:
        return error_response(err, 400)
        
    return success_response(updated, f"Request status updated to {new_status}.")

@request_bp.route('/<request_id>', methods=['DELETE'])
@token_required
def delete_request_endpoint(request_id):
    user = request.user
    ok, err = delete_request(request_id, user)
    if not ok:
        return error_response(err or "Failed to delete request.", 403)
        
    return success_response(None, "Blood request deleted successfully.")
