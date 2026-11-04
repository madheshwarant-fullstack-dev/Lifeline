import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BsDropletFill, 
  BsTelephoneFill, 
  BsEnvelope, 
  BsGeoAltFill, 
  BsShieldCheck, 
  BsChevronRight, 
  BsTwitterX, 
  BsLinkedin, 
  BsFacebook, 
  BsInstagram, 
  BsHeartPulse,
  BsShieldLock,
  BsFileEarmarkText
} from 'react-icons/bs';
import './Footer.css';

const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

const Footer = () => {
  const [activeModal, setActiveModal] = useState(null);
  const currentYear = new Date().getFullYear();

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveModal(null);
      }
    };
    if (activeModal) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeModal]);

  return (
    <footer className="lifeline-footer pt-5 pb-4 mt-auto" role="contentinfo">
      <div className="container">
        {/* 4 Responsive Columns */}
        <div className="row g-4 pb-2">
          
          {/* Column 1: Brand & Emergency Hotline */}
          <div className="col-12 col-md-6 col-lg-3">
            <Link 
              to="/" 
              className="d-flex align-items-center gap-2 mb-3 text-decoration-none" 
              aria-label="LifeLine Home"
            >
              <span className="brand-logo-badge">
                <BsDropletFill />
              </span>
              <div className="d-flex flex-column">
                <span className="fw-bolder fs-4 text-white lh-1" style={{ letterSpacing: '-0.5px' }}>
                  Life<span className="text-danger">Line</span>
                </span>
                <span className="text-danger fw-semibold text-uppercase" style={{ fontSize: '9px', letterSpacing: '0.8px' }}>
                  EMERGENCY BLOOD NETWORK
                </span>
              </div>
            </Link>

            <p className="text-secondary small mb-3 pe-lg-2 lh-base" style={{ color: '#94a3b8' }}>
              A high-precision healthcare platform bridging voluntary blood donors, accredited hospital blood banks, and urgent transfusion requests across India.
            </p>

            {/* Verified Emergency Contact */}
            <a 
              href="tel:180012025663" 
              className="footer-emergency-card text-decoration-none"
              title="Call LifeLine Emergency Hotline"
              aria-label="Call 24/7 LifeLine National Emergency Hotline 1800-120-BLOOD"
            >
              <div className="footer-emergency-icon">
                <BsTelephoneFill />
              </div>
              <div className="d-flex flex-column">
                <div className="d-flex align-items-center text-white small fw-bold">
                  <span className="footer-pulse-dot" aria-hidden="true"></span>
                  24/7 Verified Emergency
                </div>
                <span className="text-danger fw-extrabold fs-6 lh-1">
                  1800-120-BLOOD
                </span>
                <small className="text-white-50" style={{ fontSize: '11px' }}>
                  Toll-Free Across India
                </small>
              </div>
            </a>
          </div>

          {/* Column 2: Quick Links */}
          <div className="col-12 col-md-6 col-lg-3">
            <h6 className="footer-col-title">
              <span className="text-danger">•</span> Quick Links
            </h6>
            <ul className="footer-nav-list">
              <li>
                <Link to="/" className="footer-link">
                  <BsChevronRight className="footer-link-arrow" /> Home
                </Link>
              </li>
              <li>
                <Link to="/find-donors" className="footer-link">
                  <BsChevronRight className="footer-link-arrow" /> Find Blood
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="footer-link">
                  <BsChevronRight className="footer-link-arrow" /> How It Works
                </Link>
              </li>
              <li>
                <Link to="/hospital-info" className="footer-link">
                  <BsChevronRight className="footer-link-arrow" /> Hospital Info
                </Link>
              </li>
              <li>
                <Link to="/register" className="footer-link">
                  <BsChevronRight className="footer-link-arrow" /> Become a Donor
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources & Blood Compatibility */}
          <div className="col-12 col-md-6 col-lg-3">
            <h6 className="footer-col-title">
              <span className="text-danger">•</span> Resources & Safety
            </h6>
            <ul className="footer-nav-list mb-3">
              <li>
                <Link to="/blood-groups" className="footer-link">
                  <BsChevronRight className="footer-link-arrow" /> Blood Compatibility
                </Link>
              </li>
              <li>
                <button 
                  type="button" 
                  className="footer-link"
                  onClick={() => setActiveModal('safety')}
                  aria-haspopup="dialog"
                >
                  <BsChevronRight className="footer-link-arrow" /> Donor Safety Guidelines
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  className="footer-link"
                  onClick={() => setActiveModal('privacy')}
                  aria-haspopup="dialog"
                >
                  <BsChevronRight className="footer-link-arrow" /> Privacy Policy
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  className="footer-link"
                  onClick={() => setActiveModal('terms')}
                  aria-haspopup="dialog"
                >
                  <BsChevronRight className="footer-link-arrow" /> Terms & Conditions
                </button>
              </li>
            </ul>

            {/* Simplified Blood Compatibility Badges */}
            <div className="pt-1">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="small text-white-50 fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                  BLOOD GROUPS
                </span>
                <Link to="/blood-groups" className="small text-danger text-decoration-none fw-semibold" style={{ fontSize: '11px' }}>
                  Checker &rarr;
                </Link>
              </div>
              <div className="footer-blood-badges" aria-label="Blood type compatibility quick access">
                {BLOOD_TYPES.map((type) => (
                  <Link
                    key={type}
                    to="/blood-groups"
                    className="footer-blood-pill"
                    title={`View clinical compatibility for blood type ${type}`}
                  >
                    {type}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Column 4: Contact & Social Links */}
          <div className="col-12 col-md-6 col-lg-3">
            <h6 className="footer-col-title">
              <span className="text-danger">•</span> Contact & Support
            </h6>
            <div className="d-flex flex-column gap-3">
              {/* Verified Email */}
              <div className="footer-contact-item">
                <BsEnvelope className="footer-contact-icon" aria-hidden="true" />
                <div>
                  <div className="text-white small fw-bold lh-1 mb-1">LifeLine Support</div>
                  <a 
                    href="mailto:support@bloodconnect.org" 
                    className="footer-contact-link small"
                  >
                    support@bloodconnect.org
                  </a>
                </div>
              </div>

              {/* Verified Headquarters */}
              <div className="footer-contact-item">
                <BsGeoAltFill className="footer-contact-icon" aria-hidden="true" />
                <div>
                  <div className="text-white small fw-bold lh-1 mb-1">National Coordination Grid</div>
                  <span className="small text-secondary" style={{ color: '#94a3b8' }}>
                    Connaught Place, New Delhi, Delhi 110001, India
                  </span>
                </div>
              </div>

              {/* Clinical Verification Badge */}
              <div className="footer-contact-item">
                <BsShieldCheck className="footer-contact-icon text-success" aria-hidden="true" />
                <span className="small text-secondary" style={{ color: '#94a3b8' }}>
                  Verified Clinical Protocol • 15-Minute Emergency Response
                </span>
              </div>

              {/* Social Media Links */}
              <div>
                <span className="text-white-50 small fw-semibold d-block mb-2" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                  CONNECT WITH LIFELINE
                </span>
                <div className="footer-social-group">
                  <a 
                    href="https://twitter.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="footer-social-btn"
                    aria-label="Follow LifeLine on Twitter"
                  >
                    <BsTwitterX />
                  </a>
                  <a 
                    href="https://linkedin.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="footer-social-btn"
                    aria-label="Connect with LifeLine on LinkedIn"
                  >
                    <BsLinkedin />
                  </a>
                  <a 
                    href="https://facebook.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="footer-social-btn"
                    aria-label="Follow LifeLine on Facebook"
                  >
                    <BsFacebook />
                  </a>
                  <a 
                    href="https://instagram.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="footer-social-btn"
                    aria-label="Follow LifeLine on Instagram"
                  >
                    <BsInstagram />
                  </a>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Subtle Horizontal Divider */}
        <hr className="footer-divider" />

        {/* Bottom Copyright Section */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2 footer-bottom-text text-center text-md-start">
          <div>
            &copy; {currentYear} <strong className="text-white">LifeLine Emergency Donor Network</strong>. All rights reserved.
          </div>
          <div className="small">
            Algorithmic Matching Aid • Transfusion Serology Subject to Licensed Hospital Blood Bank Authorization
          </div>
        </div>
      </div>

      {/* Accessible Modals for Safety Guidelines, Privacy Policy, Terms & Conditions */}
      {activeModal && (
        <div 
          className="footer-modal-overlay" 
          onClick={() => setActiveModal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="footer-modal-title"
        >
          <div 
            className="footer-modal-card" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="footer-modal-header">
              <div className="d-flex align-items-center gap-2">
                {activeModal === 'safety' && <BsHeartPulse className="text-danger fs-5" />}
                {activeModal === 'privacy' && <BsShieldLock className="text-danger fs-5" />}
                {activeModal === 'terms' && <BsFileEarmarkText className="text-danger fs-5" />}
                <h5 className="modal-title fw-bold text-white mb-0" id="footer-modal-title">
                  {activeModal === 'safety' && 'Donor Safety & Eligibility Guidelines'}
                  {activeModal === 'privacy' && 'Healthcare Privacy & Data Protection Policy'}
                  {activeModal === 'terms' && 'Platform Terms & Medical Conditions'}
                </h5>
              </div>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={() => setActiveModal(null)}
                aria-label="Close dialog"
              ></button>
            </div>

            <div className="footer-modal-body">
              {activeModal === 'safety' && (
                <div className="d-flex flex-column gap-3">
                  <div className="p-3 rounded bg-dark border border-secondary border-opacity-25">
                    <strong className="text-white d-block mb-1">Mandatory 90-Day Donation Hiatus</strong>
                    <p className="mb-0 text-secondary small">
                      LifeLine algorithmically enforces a minimum 90-day rest period between consecutive whole blood donations to prevent donor iron depletion and safeguard long-term health.
                    </p>
                  </div>
                  <div>
                    <h6 className="text-danger fw-bold small text-uppercase mb-2">Core Eligibility Criteria</h6>
                    <ul className="list-unstyled d-flex flex-column gap-1 small text-secondary mb-0">
                      <li>• <strong>Age Requirement:</strong> 18 to 65 years old in good physical health.</li>
                      <li>• <strong>Weight Minimum:</strong> Minimum 50 kg (110 lbs) for standard whole blood donation.</li>
                      <li>• <strong>Hemoglobin Levels:</strong> ≥ 12.5 g/dL measured prior to collection.</li>
                      <li>• <strong>Vitals:</strong> Normal blood pressure, pulse, and temperature at collection time.</li>
                    </ul>
                  </div>
                  <div>
                    <h6 className="text-danger fw-bold small text-uppercase mb-2">Clinical Pre-Donation Screening</h6>
                    <p className="small text-secondary mb-0">
                      Before every transfusion session, donors complete a five-point medical screening checklist covering recent medications, international travel, illness, and procedures to protect both the donor and patient.
                    </p>
                  </div>
                </div>
              )}

              {activeModal === 'privacy' && (
                <div className="d-flex flex-column gap-3">
                  <div className="p-3 rounded bg-dark border border-secondary border-opacity-25">
                    <strong className="text-white d-block mb-1">Zero Commercial Data Sale Guarantee</strong>
                    <p className="mb-0 text-secondary small">
                      LifeLine is an altruistic emergency healthcare network. Your personal and medical information is never sold, rented, or monetized for commercial advertising.
                    </p>
                  </div>
                  <div>
                    <h6 className="text-danger fw-bold small text-uppercase mb-2">Masked Contact Protection</h6>
                    <p className="small text-secondary mb-2">
                      Donor phone numbers and home addresses are never published to public scrapers or unauthenticated directories. Contact coordination is securely routed solely upon an accepted emergency request.
                    </p>
                  </div>
                  <div>
                    <h6 className="text-danger fw-bold small text-uppercase mb-2">Healthcare Encryption Standards</h6>
                    <p className="small text-secondary mb-0">
                      All screening responses and patient requests are stored in encrypted databases in full alignment with national digital healthcare security recommendations (DISHA / NDHM guidelines).
                    </p>
                  </div>
                </div>
              )}

              {activeModal === 'terms' && (
                <div className="d-flex flex-column gap-3">
                  <div className="p-3 rounded bg-dark border border-secondary border-opacity-25">
                    <strong className="text-white d-block mb-1">Coordination Aid Disclaimer</strong>
                    <p className="mb-0 text-secondary small">
                      LifeLine is an administrative decision-support tool. Final serological crossmatching, infectious disease screening, and blood collection must be performed exclusively by certified medical professionals at licensed blood banks.
                    </p>
                  </div>
                  <div>
                    <h6 className="text-danger fw-bold small text-uppercase mb-2">Voluntary Non-Commercial Pledge</h6>
                    <p className="small text-secondary mb-2">
                      In accordance with national blood safety legislation, blood donation through LifeLine is strictly voluntary and non-remunerated. Demanding or offering commercial payment for blood is prohibited.
                    </p>
                  </div>
                  <div>
                    <h6 className="text-danger fw-bold small text-uppercase mb-2">Emergency Response Protocol</h6>
                    <p className="small text-secondary mb-0">
                      While LifeLine dispatches real-time automated emergency notifications to compatible donors, life-threatening acute traumas must always be coordinated concurrently with hospital trauma wards and emergency services.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="footer-modal-footer">
              <button 
                type="button" 
                className="btn btn-sm btn-danger px-3 py-1.5 fw-semibold"
                onClick={() => setActiveModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
