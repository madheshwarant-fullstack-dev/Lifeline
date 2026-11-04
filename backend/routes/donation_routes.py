from flask import Blueprint, request
from services.donation_service import record_donation, get_donations, update_donation_status
from middleware.auth_middleware import token_required, role_required
from utils.response import success_response, error_response

donation_bp = Blueprint('donation_bp', __name__)

@donation_bp.route('', methods=['POST'])
@token_required
def create_donation():
    data = request.get_json() or {}
    user = request.user

    # If donor is creating or logging a donation
    if user['role'] == 'DONOR' and not data.get('donorId'):
        from services.donor_service import get_donor_by_user_id
        donor = get_donor_by_user_id(user['id'])
        if donor:
            data['donorId'] = donor['id']
            data['donorName'] = donor['name']
            data['bloodGroup'] = donor['bloodGroup']

    created = record_donation(data)
    return success_response(created, "Donation record created.", 201)

@donation_bp.route('', methods=['GET'])
@token_required
def list_donations():
    user = request.user
    filters = {
        "bloodGroup": request.args.get('bloodGroup'),
        "status": request.args.get('status'),
        "requestId": request.args.get('requestId')
    }

    # If regular donor, restrict to their donations unless admin
    if user['role'] == 'DONOR':
        from services.donor_service import get_donor_by_user_id
        donor = get_donor_by_user_id(user['id'])
        if donor:
            filters['donorId'] = donor['id']
        else:
            return success_response([], "No donor record found.")
    elif request.args.get('donorId'):
        filters['donorId'] = request.args.get('donorId')

    donations = get_donations(filters)
    return success_response(donations, f"Found {len(donations)} donation records.")

@donation_bp.route('/<donation_id>', methods=['PUT'])
@token_required
def update_donation(donation_id):
    user = request.user
    data = request.get_json() or {}
    new_status = data.get('status', 'COMPLETED')
    notes = data.get('notes')

    updated, err = update_donation_status(donation_id, new_status, notes)
    if err:
        return error_response(err, 400)
    return success_response(updated, f"Donation updated to {new_status}.")
