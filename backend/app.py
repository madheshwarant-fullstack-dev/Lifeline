import os
import sys
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
import traceback
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from database.connection import get_db
from database.seed_data import seed_database
from utils.response import error_response, success_response

# Import Blueprints
from routes.auth_routes import auth_bp
from routes.donor_routes import donor_bp
from routes.request_routes import request_bp
from routes.matching_routes import matching_bp
from routes.donation_routes import donation_bp
from routes.notification_routes import notification_bp
from routes.admin_routes import admin_bp
from routes.screening_routes import screening_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable CORS for frontend
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "Access-Control-Allow-Credentials"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )

    # Ensure DB connection & initialize seed data
    with app.app_context():
        try:
            get_db()
            seed_database()
        except Exception as e:
            print(f"[App Init Warning] DB initialization warning: {e}")

    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(donor_bp, url_prefix='/api/donors')
    app.register_blueprint(request_bp, url_prefix='/api/requests')
    app.register_blueprint(matching_bp, url_prefix='/api/matching')
    app.register_blueprint(donation_bp, url_prefix='/api/donations')
    app.register_blueprint(notification_bp, url_prefix='/api/notifications')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(screening_bp, url_prefix='/api/screenings')

    # Health check route
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return success_response({
            "service": "Lifeline REST API",
            "status": "online",
            "version": "1.0.0",
            "database": "connected"
        }, "Lifeline backend is healthy and operating.")

    # Public Platform Live Telemetry Statistics
    @app.route('/api/stats', methods=['GET'])
    def public_stats():
        try:
            db = get_db()
            total_donors = db.donors.count_documents({})
            available_donors = db.donors.count_documents({"availability": True})
            total_requests = db.blood_requests.count_documents({})
            successful_donations = db.donations.count_documents({"status": "COMPLETED"})
            fulfilled_requests = db.blood_requests.count_documents({
                "status": {"$in": ["DONATION_COMPLETED", "FULFILLED", "CLOSED"]}
            })
            effective_donations = max(successful_donations, fulfilled_requests)
            emergency_requests = db.blood_requests.count_documents({"urgency": "EMERGENCY"})
            total_hospitals = db.hospitals.count_documents({})
            active_states = len(db.donors.distinct("state")) or 1
            
            return success_response({
                "totalDonors": total_donors,
                "availableDonors": available_donors,
                "totalRequests": total_requests,
                "successfulDonations": effective_donations,
                "emergencyRequests": emergency_requests,
                "totalHospitals": total_hospitals,
                "activeStates": active_states
            }, "Live blood donation platform statistics")
        except Exception as e:
            return error_response(f"Failed to fetch live statistics: {str(e)}", 500)

    # Centralized Error Handlers
    @app.errorhandler(400)
    def bad_request(e):
        return error_response("Bad request. Please verify the submitted data.", 400)

    @app.errorhandler(404)
    def not_found(e):
        return error_response("The requested resource was not found.", 404)

    @app.errorhandler(405)
    def method_not_allowed(e):
        return error_response("HTTP method not allowed for this route.", 405)

    @app.errorhandler(500)
    def internal_error(e):
        print(f"[Internal Server Error]: {traceback.format_exc()}")
        return error_response("An internal server error occurred. Our engineers have been alerted.", 500)

    @app.errorhandler(Exception)
    def handle_unexpected_error(e):
        print(f"[Unhandled Exception]: {str(e)}\n{traceback.format_exc()}")
        return error_response("An unexpected server error occurred.", 500)

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    print(f"[Lifeline] Flask Backend server starting on http://localhost:{port} ...")
    app.run(host='0.0.0.0', port=port, debug=Config.DEBUG)
