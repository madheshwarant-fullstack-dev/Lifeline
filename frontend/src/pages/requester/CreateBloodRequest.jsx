import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { requestService } from '../../services/requestService';
import { BLOOD_GROUPS, INDIAN_STATES, DEFAULT_STATE, DEFAULT_CITY, getCitiesByState, URGENCIES } from '../../utils/constants';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import { FaExclamationTriangle, FaExclamationCircle, FaHospital, FaShieldAlt } from 'react-icons/fa';

const CreateBloodRequest = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isHospital = user?.role === 'HOSPITAL';
  const hospitalProfile = user?.hospitalProfile || {};
  const isVerifiedHospital = isHospital ? (hospitalProfile.isVerified !== false) : true;

  const initialBloodGroup = searchParams.get('bloodGroup') || 'O+';
  const defaultHospitalName = isHospital ? (hospitalProfile.hospitalName || user?.name || '') : '';
  const defaultCity = isHospital ? (user?.city || DEFAULT_CITY) : DEFAULT_CITY;
  const defaultState = isHospital ? (user?.state || DEFAULT_STATE) : DEFAULT_STATE;

  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    patientName: '',
    bloodGroup: initialBloodGroup,
    unitsRequired: 1,
    hospitalName: defaultHospitalName,
    hospitalAddress: isHospital ? (user?.address || '') : '',
    state: defaultState,
    city: defaultCity,
    pinCode: isHospital ? (hospitalProfile.pinCode || '') : '',
    contactNumber: user?.phone || '',
    requiredDate: tomorrowStr,
    urgency: 'NORMAL',
    additionalMessage: ''
  });

  useEffect(() => {
    if (isHospital) {
      setFormData(prev => ({
        ...prev,
        hospitalName: prev.hospitalName || hospitalProfile.hospitalName || user?.name || '',
        city: user?.city || prev.city,
        state: user?.state || prev.state,
        contactNumber: user?.phone || prev.contactNumber
      }));
    }
  }, [user, isHospital]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    const units = parseInt(formData.unitsRequired, 10);
    if (isNaN(units) || units < 1 || units > 20) {
      setError('Please enter a valid unit quantity between 1 and 20 units.');
      return;
    }

    if (!formData.hospitalName.trim()) {
      setError('Hospital or clinical facility name is required.');
      return;
    }

    if (formData.requiredDate < todayStr) {
      setError('Required date cannot be in the past.');
      return;
    }

    if (isHospital && !isVerifiedHospital) {
      setError('Your hospital account is awaiting administrative verification. Only verified healthcare centers can issue official blood requests.');
      return;
    }

    setLoading(true);

    try {
      const res = await requestService.createRequest(formData);
      const createdId = res?.data?.id || res?.data?._id;
      if (createdId) {
        navigate(`/requests/${createdId}`, { state: { justCreated: true } });
      } else {
        navigate('/requester/my-requests');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.join(', ') || 'Failed to create blood request.';
      setError(msg);
      setLoading(false);
    }
  };

  const isEmergency = formData.urgency === 'EMERGENCY';

  return (
    <div className="container-fluid p-0" style={{ maxWidth: '850px' }}>
      <div className="mb-4 pb-2 border-bottom">
        <h2 className="fw-bold mb-1 text-dark">
          {isHospital ? 'Create Hospital Blood Request' : 'Create Blood Request'}
        </h2>
        <p className="text-muted small mb-0">
          Enter patient transfusion requirements. Lifeline will match and notify nearby compatible donors based on location, availability, and clinical screening.
        </p>
      </div>

      {isHospital && !isVerifiedHospital && (
        <div className="alert alert-warning d-flex align-items-center gap-2 p-3 mb-4 rounded-3 border-2 border-warning shadow-sm">
          <FaShieldAlt size={22} className="text-warning flex-shrink-0" />
          <div>
            <strong className="d-block">HOSPITAL VERIFICATION PENDING</strong>
            <small>
              Your facility registration is undergoing administrative verification. Official requests cannot be broadcast until verified by administrators.
            </small>
          </div>
        </div>
      )}

      {isEmergency && (
        <div className="alert alert-danger d-flex align-items-center gap-2 p-3 mb-4 rounded-3 border-2 border-danger shadow-sm">
          <FaExclamationTriangle size={24} className="text-danger flex-shrink-0" />
          <div>
            <strong className="d-block">CRITICAL EMERGENCY BROADCAST ACTIVATED</strong>
            <small>
              Submitting as EMERGENCY triggers high-priority alerts to verified compatible {formData.bloodGroup} and universal O- donors in {formData.city}, {formData.state}.
            </small>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 small py-2.5 mb-4 rounded-3" role="alert">
          <FaExclamationCircle className="flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <div className={`bc-card p-4 p-md-5 bg-white shadow-sm border rounded-3 ${isEmergency ? 'border-danger' : ''}`}>
        <form onSubmit={handleSubmit}>
          {/* Urgency Selection Header */}
          <div className="mb-4">
            <label className="form-label small fw-bold text-secondary">Request Urgency Level *</label>
            <div className="row g-2">
              {URGENCIES.map((u) => {
                const isSelected = formData.urgency === u.value;
                const isUrgEmerg = u.value === 'EMERGENCY';
                return (
                  <div key={u.value} className="col-6 col-md-3">
                    <button
                      type="button"
                      className={`btn w-100 py-2 small fw-bold border ${isSelected ? (isUrgEmerg ? 'btn-danger shadow-sm' : 'btn-dark text-white') : 'btn-light text-secondary'}`}
                      onClick={() => setFormData({ ...formData, urgency: u.value })}
                    >
                      {isUrgEmerg && <FaExclamationTriangle className="me-1" />}
                      {u.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="row g-3">
            {/* Patient Name */}
            <div className="col-md-6">
              <label className="form-label small fw-bold text-secondary">Patient Full Name *</label>
              <input
                type="text"
                name="patientName"
                required
                className="form-control"
                placeholder="Patient Full Name"
                value={formData.patientName}
                onChange={handleChange}
              />
            </div>

            {/* Blood Group */}
            <div className="col-md-3">
              <label className="form-label small fw-bold text-danger">Blood Group *</label>
              <select
                name="bloodGroup"
                required
                className="form-select border-danger fw-bold"
                value={formData.bloodGroup}
                onChange={handleChange}
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            {/* Units Required */}
            <div className="col-md-3">
              <label className="form-label small fw-bold text-secondary">Units (Bags) *</label>
              <input
                type="number"
                name="unitsRequired"
                required
                min="1"
                max="20"
                className="form-control"
                value={formData.unitsRequired}
                onChange={handleChange}
              />
            </div>

            {/* Hospital Name */}
            <div className="col-md-6">
              <label className="form-label small fw-bold text-secondary">Hospital / Transfusion Facility *</label>
              <input
                type="text"
                name="hospitalName"
                required
                className="form-control"
                placeholder="e.g. Apollo Hospital / AIIMS / Fortis"
                value={formData.hospitalName}
                onChange={handleChange}
              />
            </div>

            {/* Required Date */}
            <div className="col-md-6">
              <label className="form-label small fw-bold text-secondary">Required By Date *</label>
              <input
                type="date"
                name="requiredDate"
                required
                min={todayStr}
                className="form-control"
                value={formData.requiredDate}
                onChange={handleChange}
              />
            </div>

            {/* State */}
            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">State / UT *</label>
              <select name="state" className="form-select" value={formData.state} onChange={handleStateChange}>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* City */}
            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">City *</label>
              <select name="city" className="form-select" value={formData.city} onChange={handleChange}>
                {getCitiesByState(formData.state).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* PIN Code */}
            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">PIN Code / Postal Area</label>
              <input
                type="text"
                name="pinCode"
                className="form-control"
                placeholder="e.g. 600006"
                value={formData.pinCode}
                onChange={handleChange}
              />
            </div>

            {/* Hospital Address */}
            <div className="col-md-6">
              <label className="form-label small fw-bold text-secondary">Hospital Street Address / Department</label>
              <input
                type="text"
                name="hospitalAddress"
                className="form-control"
                placeholder="e.g. Blood Bank, 2nd Floor, Greams Lane"
                value={formData.hospitalAddress}
                onChange={handleChange}
              />
            </div>

            {/* Contact Number */}
            <div className="col-md-6">
              <label className="form-label small fw-bold text-secondary">Coordination Phone Number *</label>
              <input
                type="tel"
                name="contactNumber"
                required
                className="form-control"
                placeholder="+91 98765 43210"
                value={formData.contactNumber}
                onChange={handleChange}
              />
            </div>

            {/* Additional Clinical Notes */}
            <div className="col-12">
              <label className="form-label small fw-bold text-secondary">Relevant Transfusion / Arrival Notes</label>
              <textarea
                name="additionalMessage"
                rows="3"
                className="form-control"
                placeholder="Include arrival instructions, department reference, or relevant patient notes. Avoid confidential diagnostic details."
                value={formData.additionalMessage}
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-blood w-100 py-2.5 fw-bold mt-4 shadow-sm"
            disabled={loading || (isHospital && !isVerifiedHospital)}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Publishing Request & Matching Donors...
              </>
            ) : (
              'Submit Blood Request & Alert Matching Donors'
            )}
          </button>
        </form>

        <div className="mt-4 pt-3 border-top">
          <DisclaimerAlert />
        </div>
      </div>
    </div>
  );
};

export default CreateBloodRequest;
