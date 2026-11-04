import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BLOOD_GROUPS, INDIAN_STATES, DEFAULT_STATE, DEFAULT_CITY, getCitiesByState } from '../../utils/constants';
import { FaTint, FaUser, FaEnvelope, FaPhone, FaLock, FaExclamationCircle } from 'react-icons/fa';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'DONOR',
    bloodGroup: 'O+',
    dateOfBirth: '',
    gender: 'Male',
    state: DEFAULT_STATE,
    city: DEFAULT_CITY,
    address: '',
    emergencyContact: ''
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleStateChange = (e) => {
    const newState = e.target.value;
    const cities = getCitiesByState(newState);
    setFormData({
      ...formData,
      state: newState,
      city: cities[0] || ''
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const user = await register(formData);
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'DONOR') navigate('/donor/dashboard');
      else navigate('/requester/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.join(', ') || 'Registration failed. Please check form inputs.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-5 bg-light min-vh-100">
      <div className="container" style={{ maxWidth: '680px' }}>
        <div className="text-center mb-4">
          <Link to="/" className="d-inline-flex align-items-center gap-2 text-decoration-none mb-2">
            <span className="brand-logo-badge">
              <FaTint />
            </span>
            <span className="fw-bolder fs-3 text-dark">
              Life<span className="text-danger">Line</span>
            </span>
          </Link>
          <h4 className="fw-bold text-dark">Create an Account</h4>
          <p className="text-muted small">Join our network to donate blood or request emergency blood units</p>
        </div>

        <div className="bc-card p-4 p-sm-5 bg-white shadow-sm">
          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 small py-2.5 mb-4" role="alert">
              <FaExclamationCircle className="flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleRegister}>
            {/* Role Selection */}
            <div className="mb-4">
              <label className="form-label small fw-bold text-secondary">I want to register as:</label>
              <div className="row g-2">
                <div className="col-4">
                  <input
                    type="radio"
                    className="btn-check"
                    name="role"
                    id="role-donor"
                    value="DONOR"
                    checked={formData.role === 'DONOR'}
                    onChange={handleChange}
                  />
                  <label className="btn btn-outline-danger w-100 fw-bold py-2 small" htmlFor="role-donor">
                    Blood Donor
                  </label>
                </div>
                <div className="col-4">
                  <input
                    type="radio"
                    className="btn-check"
                    name="role"
                    id="role-requester"
                    value="REQUESTER"
                    checked={formData.role === 'REQUESTER'}
                    onChange={handleChange}
                  />
                  <label className="btn btn-outline-primary w-100 fw-bold py-2 small" htmlFor="role-requester">
                    Blood Requester
                  </label>
                </div>
                <div className="col-4">
                  <input
                    type="radio"
                    className="btn-check"
                    name="role"
                    id="role-hospital"
                    value="HOSPITAL"
                    checked={formData.role === 'HOSPITAL'}
                    onChange={handleChange}
                  />
                  <label className="btn btn-outline-success w-100 fw-bold py-2 small" htmlFor="role-hospital">
                    Hospital / Clinic
                  </label>
                </div>
              </div>
            </div>

            <div className="row g-3">
              {/* Full Name */}
              <div className="col-md-6">
                <label className="form-label small fw-bold text-secondary">
                  {formData.role === 'HOSPITAL' ? 'Hospital / Facility Name' : 'Full Name'}
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light text-muted border-end-0">
                    <FaUser size={13} />
                  </span>
                  <input
                    type="text"
                    name="name"
                    required
                    className="form-control border-start-0"
                    placeholder={formData.role === 'HOSPITAL' ? 'Enter hospital or facility name' : 'Enter your full name'}
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="col-md-6">
                <label className="form-label small fw-bold text-secondary">Email Address</label>
                <div className="input-group">
                  <span className="input-group-text bg-light text-muted border-end-0">
                    <FaEnvelope size={13} />
                  </span>
                  <input
                    type="email"
                    name="email"
                    required
                    className="form-control border-start-0"
                    placeholder="Enter your email address"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="col-md-6">
                <label className="form-label small fw-bold text-secondary">Phone Number</label>
                <div className="input-group">
                  <span className="input-group-text bg-light text-muted border-end-0">
                    <FaPhone size={13} />
                  </span>
                  <input
                    type="tel"
                    name="phone"
                    required
                    className="form-control border-start-0"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Blood Group (if Donor) */}
              {formData.role === 'DONOR' && (
                <div className="col-md-6">
                  <label className="form-label small fw-bold text-danger">Blood Group *</label>
                  <select
                    name="bloodGroup"
                    className="form-select border-danger"
                    value={formData.bloodGroup}
                    onChange={handleChange}
                    required
                  >
                    {BLOOD_GROUPS.map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date of Birth & Gender (for Donors / Requesters) */}
              {formData.role !== 'HOSPITAL' && (
                <>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-secondary">Date of Birth</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      className="form-control"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-secondary">Gender</label>
                    <select name="gender" className="form-select" value={formData.gender} onChange={handleChange}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </>
              )}

              {/* State */}
              <div className="col-md-4">
                <label className="form-label small fw-bold text-secondary">State / UT *</label>
                <select name="state" className="form-select" value={formData.state} onChange={handleStateChange}>
                  {INDIAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* City */}
              <div className="col-md-4">
                <label className="form-label small fw-bold text-secondary">City / Town *</label>
                <select name="city" className="form-select" value={formData.city} onChange={handleChange}>
                  {getCitiesByState(formData.state).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* PIN Code / Postal Area */}
              <div className="col-md-4">
                <label className="form-label small fw-bold text-secondary">Area / PIN Code</label>
                <input
                  type="text"
                  name="pinCode"
                  className="form-control"
                  placeholder="e.g. 600006 / 400001"
                  value={formData.pinCode || ''}
                  onChange={handleChange}
                />
              </div>

              {/* Hospital Specific Registration Details */}
              {formData.role === 'HOSPITAL' && (
                <>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-secondary">Authorized Representative Name *</label>
                    <input
                      type="text"
                      name="representativeName"
                      required
                      className="form-control"
                      placeholder="e.g. Dr. Ramesh Kumar (Medical Director)"
                      value={formData.representativeName || ''}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-secondary">Clinical License / Registration No. *</label>
                    <input
                      type="text"
                      name="registrationNumber"
                      required
                      className="form-control"
                      placeholder="e.g. TN-MED-94021 / Blood Bank Reg"
                      value={formData.registrationNumber || ''}
                      onChange={handleChange}
                    />
                  </div>
                </>
              )}

              {/* Address */}
              <div className="col-12">
                <label className="form-label small fw-bold text-secondary">Street Address / Landmark</label>
                <input
                  type="text"
                  name="address"
                  className="form-control"
                  placeholder="e.g. 45, Anna Salai, T. Nagar / MG Road"
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>

              {/* Password */}
              <div className="col-md-6">
                <label className="form-label small fw-bold text-secondary">Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-light text-muted border-end-0">
                    <FaLock size={13} />
                  </span>
                  <input
                    type="password"
                    name="password"
                    required
                    className="form-control border-start-0"
                    placeholder="Min 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div className="col-md-6">
                <label className="form-label small fw-bold text-secondary">Confirm Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-light text-muted border-end-0">
                    <FaLock size={13} />
                  </span>
                  <input
                    type="password"
                    name="confirmPassword"
                    required
                    className="form-control border-start-0"
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Consent to Privacy & Communication Terms */}
            <div className="form-check mt-3 pt-2 border-top">
              <input
                className="form-check-input"
                type="checkbox"
                id="consentTerms"
                required
                checked={formData.consent || false}
                onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
              />
              <label className="form-check-label small text-secondary" htmlFor="consentTerms">
                I agree to Lifeline's Privacy & Communication Terms and consent to receive emergency coordination alerts. I understand that medical suitability will be evaluated by authorized clinical personnel at donation time.
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-blood w-100 py-2.5 fw-bold mt-4 shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Creating Account...
                </>
              ) : (
                'Create Account & Start Saving Lives'
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-3">
          <span className="text-muted small">Already registered with Lifeline? </span>
          <Link to="/login" className="text-danger fw-bold text-decoration-none small">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
