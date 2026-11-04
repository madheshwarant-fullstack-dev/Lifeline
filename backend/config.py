import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env file reliably regardless of invocation working directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_file = os.path.join(backend_dir, '.env')
if os.path.exists(env_file):
    load_dotenv(dotenv_path=env_file)
else:
    load_dotenv()

class Config:
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1", "t")
    
    # MongoDB Atlas
    MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI") or "mongodb+srv://lifeline_admin:Lifeline-123@lifeline.hpq3jzn.mongodb.net/lifeline?retryWrites=true&w=majority"
    DB_NAME = os.getenv("DB_NAME") or os.getenv("DATABASE_NAME") or "lifeline"
    
    # JWT
    JWT_SECRET = os.getenv("JWT_SECRET", "lifeline secret")
    JWT_EXPIRES_IN = int(os.getenv("JWT_EXPIRES_IN", 86400))  # 24 hours in seconds
    
    # CORS
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # Email SMTP Settings
    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "True").lower() in ("true", "1", "t")
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", "noreply@bloodconnect.org")
