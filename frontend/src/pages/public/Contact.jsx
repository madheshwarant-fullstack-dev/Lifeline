import React, { useState } from 'react';
import { FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, FaPaperPlane, FaCheckCircle, FaHeadset } from 'react-icons/fa';

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="py-5 bg-light min-vh-100">
      <div className="container">
        <div className="text-center max-w-700 mx-auto mb-5">
          <span className="text-danger fw-bold small text-uppercase tracking-wider">Get in Touch</span>
          <h1 className="fw-extrabold text-dark mb-2">Emergency Support & Contact</h1>
          <p className="text-muted small">
            Have questions regarding donor enrollment, hospital API integration, or urgent coordination? Reach out anytime.
          </p>
        </div>

        <div className="row g-4 justify-content-center">
          <div className="col-lg-4">
            <div className="bc-card p-4 bg-white h-100 shadow-sm d-flex flex-column gap-4">
              <div className="d-flex align-items-start gap-3">
                <span className="p-3 bg-danger-subtle text-danger rounded-circle fs-5">
                  <FaPhoneAlt />
                </span>
                <div>
                  <h6 className="fw-bold mb-1">Emergency 24/7 Hotline</h6>
                  <p className="text-danger fw-bold mb-0">1800-120-BLOOD</p>
                  <small className="text-muted">Toll-free across all Indian States & UTs</small>
                </div>
              </div>

              <div className="d-flex align-items-start gap-3">
                <span className="p-3 bg-primary-subtle text-primary rounded-circle fs-5">
                  <FaEnvelope />
                </span>
                <div>
                  <h6 className="fw-bold mb-1">Email Coordinator</h6>
                  <p className="text-dark fw-semibold mb-0">help@bloodconnect.org</p>
                  <small className="text-muted">Response within 15 minutes</small>
                </div>
              </div>

              <div className="d-flex align-items-start gap-3">
                <span className="p-3 bg-success-subtle text-success rounded-circle fs-5">
                  <FaMapMarkerAlt />
                </span>
                <div>
                  <h6 className="fw-bold mb-1">India Headquarters</h6>
                  <p className="text-muted mb-0 small">
                    National Transfusion Grid, Connaught Place, New Delhi, Delhi 110001, India
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="bc-card p-4 p-lg-5 bg-white shadow-sm">
              <h4 className="fw-bold mb-3">Send a Message</h4>
              {submitted ? (
                <div className="alert alert-success d-flex align-items-center gap-2 py-3" role="alert">
                  <FaCheckCircle size={20} />
                  <div>
                    <strong>Thank you!</strong> Your message has been received by our on-call coordinator team.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Your Name</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter Your Name"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Email Address</label>
                      <input
                        type="email"
                        className="form-control"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Enter Your Email"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold">Subject</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Hospital Partnership / Donor Question"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold">Message</label>
                      <textarea
                        className="form-control"
                        rows="4"
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Provide details about your inquiry..."
                      />
                    </div>
                    <div className="col-12">
                      <button type="submit" className="btn btn-blood fw-bold px-4 d-flex align-items-center gap-2">
                        <FaPaperPlane size={14} /> Send Message
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
