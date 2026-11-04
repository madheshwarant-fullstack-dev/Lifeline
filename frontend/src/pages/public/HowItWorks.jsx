import React from 'react';
import { Link } from 'react-router-dom';
import { FaUserPlus, FaSearchLocation, FaHeart, FaHospital, FaShieldAlt, FaPhoneAlt, FaCheckCircle } from 'react-icons/fa';

const HowItWorks = () => {
  return (
    <div className="py-5 bg-light min-vh-100">
      <div className="container">
        {/* Header */}
        <div className="text-center max-w-700 mx-auto mb-5">
          <span className="text-danger fw-bold small text-uppercase tracking-wider">Platform Architecture</span>
          <h1 className="fw-extrabold text-dark mb-2">How Lifeline Operates</h1>
          <p className="text-muted small">
            Designed to eliminate coordination friction during life-threatening acute blood shortages.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="row g-4 mb-5">
          {/* Pillar 1: Donors */}
          <div className="col-lg-4">
            <div className="bc-card p-4 bg-white h-100 border-top border-4 border-danger">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="p-2.5 rounded-3 bg-danger-subtle text-danger fs-5">
                  <FaHeart />
                </span>
                <h4 className="fw-bold mb-0">For Voluntary Donors</h4>
              </div>
              <p className="text-muted small mb-4">
                Register once, set your availability, and get notified only when a compatible patient within your city or state urgently needs your exact blood type.
              </p>
              <ul className="list-unstyled small d-flex flex-column gap-2.5 mb-4">
                <li className="d-flex align-items-start gap-2">
                  <FaCheckCircle className="text-danger mt-1 flex-shrink-0" />
                  <span>Toggle availability status with 1 click anytime</span>
                </li>
                <li className="d-flex align-items-start gap-2">
                  <FaCheckCircle className="text-danger mt-1 flex-shrink-0" />
                  <span>Receive direct SMS & email alerts for emergency requests</span>
                </li>
                <li className="d-flex align-items-start gap-2">
                  <FaCheckCircle className="text-danger mt-1 flex-shrink-0" />
                  <span>Automatic 90-day cooldown tracker protects your health</span>
                </li>
              </ul>
              <Link to="/register" className="btn btn-outline-danger btn-sm w-100 fw-bold mt-auto">
                Register as Donor
              </Link>
            </div>
          </div>

          {/* Pillar 2: Requesters */}
          <div className="col-lg-4">
            <div className="bc-card p-4 bg-white h-100 border-top border-4 border-primary">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="p-2.5 rounded-3 bg-primary-subtle text-primary fs-5">
                  <FaSearchLocation />
                </span>
                <h4 className="fw-bold mb-0">For Blood Requesters</h4>
              </div>
              <p className="text-muted small mb-4">
                Families and caregivers facing hospital shortages can submit emergency requests and instantly view scored compatible donor candidates.
              </p>
              <ul className="list-unstyled small d-flex flex-column gap-2.5 mb-4">
                <li className="d-flex align-items-start gap-2">
                  <FaCheckCircle className="text-primary mt-1 flex-shrink-0" />
                  <span>Algorithmic ranking by compatibility and proximity</span>
                </li>
                <li className="d-flex align-items-start gap-2">
                  <FaCheckCircle className="text-primary mt-1 flex-shrink-0" />
                  <span>Automatic broadcasting to nearby verified donors</span>
                </li>
                <li className="d-flex align-items-start gap-2">
                  <FaCheckCircle className="text-primary mt-1 flex-shrink-0" />
                  <span>Real-time status updates from dispatch to donation</span>
                </li>
              </ul>
              <Link to="/requester/create-request" className="btn btn-outline-primary btn-sm w-100 fw-bold mt-auto">
                Create Blood Request
              </Link>
            </div>
          </div>

          {/* Pillar 3: Hospitals */}
          <div className="col-lg-4">
            <div className="bc-card p-4 bg-white h-100 border-top border-4 border-success">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="p-2.5 rounded-3 bg-success-subtle text-success fs-5">
                  <FaHospital />
                </span>
                <h4 className="fw-bold mb-0">For Hospitals & Clinics</h4>
              </div>
              <p className="text-muted small mb-4">
                Accredited blood banks and intensive care units coordinate urgent blood transfers and verify donations directly.
              </p>
              <ul className="list-unstyled small d-flex flex-column gap-2.5 mb-4">
                <li className="d-flex align-items-start gap-2">
                  <FaCheckCircle className="text-success mt-1 flex-shrink-0" />
                  <span>Coordinate scheduled transfusion sessions</span>
                </li>
                <li className="d-flex align-items-start gap-2">
                  <FaCheckCircle className="text-success mt-1 flex-shrink-0" />
                  <span>Confirm and sign off on completed donor records</span>
                </li>
                <li className="d-flex align-items-start gap-2">
                  <FaCheckCircle className="text-success mt-1 flex-shrink-0" />
                  <span>Ensure strict adherence to hospital blood safety</span>
                </li>
              </ul>
              <Link to="/register" className="btn btn-outline-success btn-sm w-100 fw-bold mt-auto">
                Register Facility
              </Link>
            </div>
          </div>
        </div>

        {/* Safety & Protocol Details */}
        <div className="bc-card p-4 p-lg-5 bg-white shadow-sm mb-4">
          <div className="row align-items-center g-4">
            <div className="col-md-2 text-center text-md-start">
              <span className="p-3 bg-danger-subtle text-danger rounded-circle d-inline-flex fs-1">
                <FaShieldAlt />
              </span>
            </div>
            <div className="col-md-10">
              <h4 className="fw-bold mb-2">Hospital Grade Safety & Confidentiality Standards</h4>
              <p className="text-muted small mb-0">
                Lifeline prioritizes patient and donor privacy. Personal phone numbers and home addresses are never publicly scraped. Transfusions take place strictly within licensed healthcare facilities where qualified medical staff conduct all clinical crossmatching and testing protocols.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
