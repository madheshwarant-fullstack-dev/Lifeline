import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { requestService } from '../../services/requestService';
import LiveDonorMap from '../../components/maps/LiveDonorMap';
import { BLOOD_GROUPS, INDIAN_STATES, DEFAULT_STATE, DEFAULT_CITY, getCitiesByState, URGENCIES } from '../../utils/constants';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import { FaExclamationTriangle, FaExclamationCircle, FaHospital, FaLocationArrow, FaShieldAlt } from 'react-icons/fa';

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
    additionalMessage: '',
    lat: isHospital && Number.isFinite(Number(user?.lat ?? hospitalProfile?.lat))
      ? Number(user?.lat ?? hospitalProfile?.lat)
      : '',
    lng: isHospital && Number.isFinite(Number(user?.lng ?? hospitalProfile?.lng))
      ? Number(user?.lng ?? hospitalProfile?.lng)
      : '',
    searchRadiusKm: 25
  });
  const [capturingGps, setCapturingGps] = useState(false);

  const handleCaptureGps = () => {
    setError('');
    if (!navigator?.geolocation) {
      setError('Browser Geolocation API is unavailable. Click directly on the map to pin coordinates.');
      return;
    }
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        }));
        setCapturingGps(false);
      },
      (geoErr) => {
        setCapturingGps(false);
        setError(geoErr.message || 'Unable to capture GPS coordinates. Click the map to place the hospital pin.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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
      const payload = {
        ...formData,
        unitsRequired: units,
        searchRadiusKm: Number(formData.searchRadiusKm) || 25,
      };
      if (formData.lat !== '' && formData.lng !== '') {
        payload.lat = Number(formData.lat);
        payload.lng = Number(formData.lng);
      } else {
        delete payload.lat;
        delete payload.lng;
      }

      const res = isHospital
        ? await requestService.createHospitalRequest(payload)
        : await requestService.createRequest(payload);
      const createdId = res?.data?.id || res?.data?._id;
      if (createdId) {
        navigate(`/requests/${createdId}`, { state: { justCreated: true } });
      } else {
        navigate('/requester/my-requests');
      }
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.response?.data?.errors?.join(', ') ||
        'Failed to create blood request.';
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

            {/* Hospital GPS Location & Geo-Radius Map Picker */}
            <div className="col-12 mt-2">
              <div className="p-3 bg-light rounded-3 border">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <div>
                    <label className="form-label small fw-bold text-dark mb-0">
                      Hospital / Emergency GPS Coordinates &amp; Search Radius
                    </label>
                    <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                      Capture browser GPS or click on the map so compatible donors are ranked by exact Haversine distance.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger rounded-pill fw-semibold d-inline-flex align-items-center gap-1"
                    disabled={capturingGps}
                    onClick={handleCaptureGps}
                  >
                    <FaLocationArrow size={11} />
                    {capturingGps ? 'Locating GPS...' : 'Capture Hospital GPS'}
                  </button>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-sm-4">
                    <label className="form-label small text-secondary mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      name="lat"
                      className="form-control form-control-sm"
                      placeholder="e.g. 13.0633"
                      value={formData.lat}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-sm-4">
                    <label className="form-label small text-secondary mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      name="lng"
                      className="form-control form-control-sm"
                      placeholder="e.g. 80.2519"
                      value={formData.lng}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-sm-4">
                    <label className="form-label small text-secondary mb-1">Initial Search Radius</label>
                    <select
                      name="searchRadiusKm"
                      className="form-select form-select-sm"
                      value={formData.searchRadiusKm}
                      onChange={handleChange}
                    >
                      {[5, 10, 25, 50, 100].map((km) => (
                        <option key={km} value={km}>{km} km</option>
                      ))}
                    </select>
                  </div>
                </div>

                <LiveDonorMap
                  pickerMode
                  hospitalLat={formData.lat !== '' ? formData.lat : 13.0633}
                  hospitalLng={formData.lng !== '' ? formData.lng : 80.2519}
                  hospitalName={formData.hospitalName || 'Hospital Pin'}
                  radiusKm={formData.searchRadiusKm}
                  onPickLocation={(lat, lng) => setFormData((prev) => ({ ...prev, lat, lng }))}
                  height={250}
                />
              </div>
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
