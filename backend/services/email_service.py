import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Config

def send_email(to_email, subject, body_html, body_text=None):
    """
    Sends an email notification via SMTP.
    Falls back gracefully to logging in development mode if credentials are unset or SMTP is unreachable.
    """
    if not to_email:
        return False

    # Check if SMTP credentials are configured
    if not Config.MAIL_USERNAME or not Config.MAIL_PASSWORD:
        print(f"[EmailService - Dev Simulation]")
        print(f"  To: {to_email}")
        print(f"  Subject: {subject}")
        print(f"  Body Preview: {body_text or body_html[:120]}...")
        return True

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = Config.MAIL_DEFAULT_SENDER
        msg['To'] = to_email

        if body_text:
            msg.attach(MIMEText(body_text, 'plain'))
        if body_html:
            msg.attach(MIMEText(body_html, 'html'))

        with smtplib.SMTP(Config.MAIL_SERVER, Config.MAIL_PORT, timeout=5) as server:
            if Config.MAIL_USE_TLS:
                server.starttls()
            server.login(Config.MAIL_USERNAME, Config.MAIL_PASSWORD)
            server.sendmail(Config.MAIL_DEFAULT_SENDER, [to_email], msg.as_string())
        
        print(f"[EmailService] Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"[EmailService] Notice: Email could not be sent to {to_email} ({e}). Safe fallback.")
        return False

def send_registration_email(user_name, user_email, role):
    subject = "Welcome to Lifeline - Life Saving Network"
    html = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
        <h2 style="color: #dc3545;">Welcome to Lifeline, {user_name}!</h2>
        <p>Thank you for joining our mission to save lives. Your account has been registered with the role: <strong>{role}</strong>.</p>
        <p>Through Lifeline, you can help connect blood donors with urgent emergency requests in seconds.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #777;">Lifeline Platform • Saving Lives Together</p>
    </div>
    """
    send_email(user_email, subject, html, f"Welcome to Lifeline, {user_name}! Registered as {role}.")

def send_donor_verified_email(donor_name, donor_email, status):
    subject = f"Lifeline Donor Verification: {status.capitalize()}"
    status_text = "congratulations! Your donor account has been verified. You will now appear in donor matching." if status == 'VERIFIED' else "your donor verification was not approved at this time."
    html = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #dc3545;">Donor Verification Update</h2>
        <p>Hello {donor_name},</p>
        <p>We are writing to update you that {status_text}</p>
        <p>Thank you for standing by to help patients in emergency need.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #777;">Lifeline Platform</p>
    </div>
    """
    send_email(donor_email, subject, html)

def send_emergency_request_email(donor_email, donor_name, request_data):
    city = request_data.get('city', '')
    state = request_data.get('state', '')
    loc_label = f"{city}, {state}" if state else city
    subject = f"URGENT EMERGENCY: {request_data.get('bloodGroup')} Blood Needed in {loc_label}"
    html = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; border-left: 4px solid #dc3545;">
        <h2 style="color: #dc3545;">Emergency Blood Alert</h2>
        <p>Dear {donor_name},</p>
        <p>An urgent blood request matching your profile has just been registered:</p>
        <ul>
            <li><strong>Blood Group:</strong> {request_data.get('bloodGroup')}</li>
            <li><strong>Units Required:</strong> {request_data.get('unitsRequired')} unit(s)</li>
            <li><strong>Patient:</strong> {request_data.get('patientName')}</li>
            <li><strong>Hospital:</strong> {request_data.get('hospitalName')}, {loc_label}</li>
            <li><strong>Required Date:</strong> {request_data.get('requiredDate')}</li>
            <li><strong>Contact:</strong> {request_data.get('contactNumber')}</li>
        </ul>
        <p>If you are available to donate, please log into your Lifeline dashboard to accept and respond.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #777;">Lifeline Emergency Broadcast System</p>
    </div>
    """
    send_email(donor_email, subject, html)

def send_donation_status_email(to_email, recipient_name, status, details):
    subject = f"Lifeline Update: Request {status.replace('_', ' ').capitalize()}"
    html = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #dc3545;">Blood Donation Update</h2>
        <p>Hello {recipient_name},</p>
        <p>{details}</p>
        <p>Status: <strong>{status}</strong></p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #777;">Lifeline Platform</p>
    </div>
    """
    send_email(to_email, subject, html)
