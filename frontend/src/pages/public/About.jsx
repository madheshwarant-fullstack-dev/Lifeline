import React from 'react';
import { BsHeartFill, BsShieldCheck, BsAwardFill } from 'react-icons/bs';

const About = () => {
  return (
    <div className="py-5 bg-light min-vh-100">
      <div className="container">
        <div className="text-center max-w-700 mx-auto mb-5">
          <span className="text-danger fw-bold small text-uppercase tracking-wider">Our Mission</span>
          <h1 className="fw-extrabold text-dark mb-3">Connecting Humanity in Critical Moments</h1>
          <p className="lead text-secondary fs-6">
            Lifeline was founded to eliminate tragic delays in emergency medicine caused by localized blood shortages and fractured donor coordination.
          </p>
        </div>

        {/* Vision & Mission Cards */}
        <div className="row g-4 mb-5">
          <div className="col-md-6">
            <div className="bc-card p-4 bg-white h-100 shadow-sm border-start border-4 border-danger">
              <h4 className="fw-bold text-dark mb-2">Our Mission</h4>
              <p className="text-muted small mb-0">
                To build the world’s most responsive, trusted, and medically compliant digital donor network, empowering healthcare systems and patient families to connect with verified blood donors during emergency and routine medical procedures.
              </p>
            </div>
          </div>
          <div className="col-md-6">
            <div className="bc-card p-4 bg-white h-100 shadow-sm border-start border-4 border-primary">
              <h4 className="fw-bold text-dark mb-2">Our Vision</h4>
              <p className="text-muted small mb-0">
                A world where no patient succumbs to trauma, surgery complications, or treatable anemia due to the unavailability of safe, compatible blood products.
              </p>
            </div>
          </div>
        </div>

        {/* Key Values */}
        <div className="bc-card p-4 p-lg-5 bg-white mb-5 shadow-sm">
          <h3 className="fw-bold mb-4 text-center">Core Principles</h3>
          <div className="row g-4 text-center">
            <div className="col-md-4">
              <div className="p-3">
                <BsHeartFill className="text-danger mb-3" size={36} />
                <h5 className="fw-bold">Altruistic Donation</h5>
                <p className="text-muted small">
                  We champion purely voluntary, non-remunerated blood donation adhering to World Health Organization ethics.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3">
                <BsShieldCheck className="text-primary mb-3" size={36} />
                <h5 className="fw-bold">Clinical Safety</h5>
                <p className="text-muted small">
                  We honor physician expertise and licensed blood bank verification as the final arbiters of patient transfusion safety.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3">
                <BsAwardFill className="text-warning mb-3" size={36} />
                <h5 className="fw-bold">Rapid Accuracy</h5>
                <p className="text-muted small">
                  Our matching engine reduces search time from hours to seconds through precise ABO/Rh algorithmic sorting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
