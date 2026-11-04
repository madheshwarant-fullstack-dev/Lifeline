from flask import Blueprint, request
import jwt
from config import Config
from services.donor_service import (
    get_donor_by_id,
    get_donor_by_user_id,
    update_donor_profile,
    toggle_availability,
    search_donors,
    get_donor_dashboard_stats,
    respond_to_request,
    contact_donor
)
from middleware.auth_middleware import token_required, role_required
from utils.response import success_response, error_response

donor_bp = Blueprint('donor_bp', __name__)

def check_is_admin():
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        try:
            token = auth_header.split(' ')[1]
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
            return payload.get('role') == 'ADMIN'
        except Exception:
            return False
    return False

@donor_bp.route('', methods=['GET'])
def list_donors():
    filters = {
        "bloodGroup": request.args.get('bloodGroup'),
        "state": request.args.get('state'),
        "city": request.args.get('city'),
        "availability": request.args.get('availability'),
        "verificationStatus": request.args.get('verificationStatus'),
        "search": request.args.get('search')
    }
    is_admin = check_is_admin()
    donors = search_donors(filters, is_admin=is_admin)
    return success_response(donors, f"Found {len(donors)} donors.")

@donor_bp.route('/search', methods=['GET'])
def search_donor_endpoint():
    filters = {
        "bloodGroup": request.args.get('bloodGroup'),
        "state": request.args.get('state'),
        "city": request.args.get('city'),
        "availability": request.args.get('availability'),
        "verificationStatus": request.args.get('verificationStatus'),
        "search": request.args.get('search')
    }
    is_admin = check_is_admin()
    donors = search_donors(filters, is_admin=is_admin)
    return success_response(donors, f"Search completed with {len(donors)} results.")

@donor_bp.route('/<donor_id>/contact', methods=['POST'])
@token_required
def contact_donor_endpoint(donor_id):
    user = request.user
    data = request.get_json() or {}
    res, err = contact_donor(user, donor_id, data)
    if err:
        return error_response(err, 400)
    return success_response(res, "Direct notification sent to donor.")

@donor_bp.route('/dashboard', methods=['GET'])
@role_required('DONOR')
def get_donor_dashboard():
    user = request.user
    stats = get_donor_dashboard_stats(user['id'])
    if not stats:
        return error_response("Donor record not found for this account.", 404)
    return success_response(stats, "Donor dashboard data retrieved.")

@donor_bp.route('/availability', methods=['POST'])
@role_required('DONOR')
def set_availability():
    user = request.user
    data = request.get_json() or {}
    is_available = data.get('availability', True)
    updated = toggle_availability(user['id'], is_available)
    return success_response(updated, f"Availability set to {'Available' if is_available else 'Unavailable'}.")

@donor_bp.route('/requests/<request_id>/respond', methods=['POST'])
@role_required('DONOR')
def respond_request_endpoint(request_id):
    user = request.user
    data = request.get_json() or {}
    action = data.get('action', 'ACCEPT')
    
    result, error_msg = respond_to_request(user['id'], request_id, action)
    if error_msg:
        return error_response(error_msg, 400)
    return success_response(result, result.get("message", "Response recorded."))

@donor_bp.route('/<donor_id>', methods=['GET'])
def get_single_donor(donor_id):
    donor = get_donor_by_id(donor_id)
    if not donor:
        return error_response("Donor not found.", 404)
    return success_response(donor, "Donor retrieved successfully.")

@donor_bp.route('/<donor_id>', methods=['PUT'])
@token_required
def update_donor(donor_id):
    user = request.user
    donor = get_donor_by_id(donor_id)
    if not donor:
        return error_response("Donor not found.", 404)
        
    # Check authorization: user must own the donor profile or be admin
    if user['role'] != 'ADMIN' and donor.get('userId') != user['id']:
        return error_response("You are not authorized to update this donor profile.", 403)
        
    data = request.get_json() or {}
    updated = update_donor_profile(donor['userId'], data)
    return success_response(updated, "Donor profile updated successfully.")
