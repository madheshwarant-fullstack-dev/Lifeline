from flask import Blueprint, request
from middleware.auth_middleware import token_required, role_required
from services.screening_service import (
    submit_health_screening,
    get_screening_by_request,
    get_screening_by_id,
    list_health_screenings,
    review_health_screening,
    confirm_donation_from_screening
)
from utils.response import success_response, error_response

screening_bp = Blueprint('screening_bp', __name__)

@screening_bp.route('', methods=['POST'])
@role_required('DONOR')
def submit_screening_endpoint():
    user = request.user
    data = request.get_json() or {}
    
    result, err = submit_health_screening(user, data)
    if err:
        return error_response(err, 400)
    return success_response(result, "Screening Submitted – Awaiting Medical Review.", 201)

@screening_bp.route('', methods=['GET'])
@token_required
def list_screenings_endpoint():
    user = request.user
    filters = {
        "status": request.args.get('status'),
        "donorId": request.args.get('donorId'),
        "requestId": request.args.get('requestId')
    }
    screenings, err = list_health_screenings(user, filters)
    if err:
        return error_response(err, 403)
    return success_response(screenings, f"Found {len(screenings)} screening records.")

@screening_bp.route('/request/<request_id>', methods=['GET'])
@token_required
def get_by_request_endpoint(request_id):
    user = request.user
    screening, err = get_screening_by_request(user, request_id)
    if err:
        return error_response(err, 404)
    return success_response(screening, "Screening details retrieved.")

@screening_bp.route('/<screening_id>', methods=['GET'])
@token_required
def get_by_id_endpoint(screening_id):
    user = request.user
    screening, err = get_screening_by_id(user, screening_id)
    if err:
        return error_response(err, 404)
    return success_response(screening, "Screening record loaded.")

@screening_bp.route('/<screening_id>/review', methods=['PUT'])
@role_required('ADMIN', 'HOSPITAL')
def review_screening_endpoint(screening_id):
    user = request.user
    data = request.get_json() or {}
    
    updated, err = review_health_screening(user, screening_id, data)
    if err:
        return error_response(err, 400)
    decision = updated.get("medicalReview", {}).get("decision", "REVIEWED")
    return success_response(updated, f"Medical screening review recorded: {decision}.")

@screening_bp.route('/<screening_id>/confirm', methods=['POST'])
@role_required('ADMIN', 'HOSPITAL')
def confirm_donation_endpoint(screening_id):
    user = request.user
    data = request.get_json() or {}
    
    res, err = confirm_donation_from_screening(user, screening_id, data)
    if err:
        return error_response(err, 400)
    return success_response(res, "Hospital donation successfully verified and completed.")
