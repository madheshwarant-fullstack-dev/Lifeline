from flask import Blueprint, request
from services.request_service import get_request_by_id
from services.matching_service import find_matched_donors_for_request
from utils.response import success_response, error_response

matching_bp = Blueprint('matching_bp', __name__)

@matching_bp.route('/<request_id>', methods=['GET'])
def get_matches_for_request(request_id):
    req_doc = get_request_by_id(request_id)
    if not req_doc:
        return error_response("Blood request not found.", 404)
        
    only_verified = request.args.get('only_verified', 'false').lower() in ('true', '1')
    match_result = find_matched_donors_for_request(req_doc, only_verified=only_verified)
    
    return success_response({
        "request": req_doc,
        **match_result
    }, "Donor matching calculated successfully.")
