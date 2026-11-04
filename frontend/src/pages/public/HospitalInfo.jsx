import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FaHospital, 
  FaShieldAlt, 
  FaUserMd, 
  FaCheckCircle, 
  FaFileContract, 
  FaTint,
  FaPhoneAlt,
  FaExclamationCircle
} from 'react-icons/fa';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';

const HospitalInfo = () => {
  return (
    <div className="py-5 bg-light min-vh-100">
      <div className="container" style={{ maxWidth: '980px' }}>
        {/* Header */}
        <div className="text-center mb-5">
          <span className="text-danger fw-bold small text-uppercase tracking-wider d-inline-flex align-items-center gap-1.5 mb-2">
            <FaHospital /> Clinical Partner Network
          </span>
          <h1 className="fw-extrabold text-dark mb-2">Hospital & Blood Bank Information</h1>
          <p className="text-muted small" style={{ maxWidth: '650px', margin: '0 auto' }}>
            Comprehensive guidance for registered hospitals, blood transfusion centers, and clinics coordinating voluntary blood donations on Lifeline.
          </p>
        </div>

        {/* Verification Overview Banner */}
        <div className="bc-card p-4 bg-white border shadow-sm rounded-3 mb-4">
          <div className="row align-items-center g-4">
            <div className="col-md-8">
              <span className="badge bg-danger-subtle text-danger px-2.5 py-1 rounded-pill fw-bold small mb-2">
                ACCREDITATION PROTOCOL
              </span>
              <h4 className="fw-bold text-dark mb-2">Hospital Verification Required</h4>
              <p className="text-muted small mb-0">
                To safeguard clinical standards and eliminate false emergencies, only officially verified healthcare facilities are authorized to broadcast official hospital blood requests to registered donors.
              </p>
            </div>
            <div className="col-md-4 text-md-end">
              <Link to="/register" className="btn btn-blood fw-bold px-4 py-2">
                Register Facility Account
              </Link>
            </div>
          </div>
        </div>

        {/* 3 Pillars of Hospital Coordination */}
        <div className="row g-4 mb-4">
          <div className="col-md-4">
            <div className="bc-card p-4 bg-white h-100 border shadow-sm rounded-3">
              <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3 p-3">
                <FaFileContract size={24} />
              </div>
              <h5 className="fw-bold text-dark mb-2">1. Facility Registration</h5>
              <p className="text-muted small mb-0">
                Submit your official hospital name, clinical registration license number, physical address, and designated medical coordinator contact details.
              </p>
            </div>
          </div>

          <div className="col-md-4">
            <div className="bc-card p-4 bg-white h-100 border shadow-sm rounded-3">
              <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3 p-3">
                <FaShieldAlt size={24} />
              </div>
              <h5 className="fw-bold text-dark mb-2">2. Administrative Review</h5>
              <p className="text-muted small mb-0">
                Our platform administrators verify facility licenses against state and national registries before enabling active blood request publishing permissions.
              </p>
            </div>
          </div>

          <div className="col-md-4">
            <div className="bc-card p-4 bg-white h-100 border shadow-sm rounded-3">
              <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3 p-3">
                <FaUserMd size={24} />
              </div>
              <h5 className="fw-bold text-dark mb-2">3. Donor Coordination</h5>
              <p className="text-muted small mb-0">
                Coordinate with compatible voluntary donors, review preliminary health screenings, and schedule hospital arrival times seamlessly.
              </p>
            </div>
          </div>
        </div>

        {/* Clinical Guidelines Card */}
        <div className="bc-card p-4 p-md-5 bg-white border shadow-sm rounded-3 mb-4">
          <h4 className="fw-bold text-dark mb-3">Clinical Responsibilities & Safety Standards</h4>
          <p className="text-muted small mb-4">
            Lifeline serves as an algorithmic decision-support tool. The final determination of donor eligibility and blood safety rests exclusively with licensed medical professionals.
          </p>

          <div className="row g-3">
            <div className="col-md-6">
              <div className="p-3 bg-light rounded-3 h-100">
                <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-2">
                  <FaCheckCircle className="text-success" /> Pre-Donation Screening Review
                </h6>
                <p className="text-muted small mb-0">
                  Hospitals must evaluate donor health disclosures (illnesses, medications, recent procedures) through authorized medical personnel prior to collection.
                </p>
              </div>
            </div>

            <div className="col-md-6">
              <div className="p-3 bg-light rounded-3 h-100">
                <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-2">
                  <FaCheckCircle className="text-success" /> Mandatory Crossmatching
                </h6>
                <p className="text-muted small mb-0">
                  Standard serological crossmatching, infectious disease testing (HIV, Hepatitis, Syphilis, Malaria), and hemoglobin confirmation must be performed on site.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Support & Hotline */}
        <div className="bc-card p-4 bg-white border shadow-sm rounded-3 mb-4">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
            <div className="d-flex align-items-center gap-3">
              <div className="p-3 bg-danger-subtle text-danger rounded-circle">
                <FaPhoneAlt size={20} />
              </div>
              <div>
                <h6 className="fw-bold mb-0 text-dark">Hospital Support & Verification Desk</h6>
                <small className="text-muted">For urgent facility onboarding or institutional integrations: <strong>support@bloodconnect.org</strong></small>
              </div>
            </div>
            <Link to="/contact" className="btn btn-outline-danger btn-sm fw-bold px-3 py-1.5">
              Contact Hospital Support
            </Link>
          </div>
        </div>

        {/* Medical Disclaimer Alert */}
        <DisclaimerAlert />
      </div>
    </div>
  );
};

export default HospitalInfo;
