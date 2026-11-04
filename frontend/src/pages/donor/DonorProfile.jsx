import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { donorService } from '../../services/donorService';
import { BLOOD_GROUPS, INDIAN_STATES, DEFAULT_STATE, DEFAULT_CITY, getCitiesByState, getStateForCity } from '../../utils/constants';
import { 
  FaUser, 
  FaMapMarkerAlt, 
  FaCheckCircle, 
  FaExclamationCircle, 
  FaCrosshairs, 
  FaBell, 
  FaHistory,
  FaShieldAlt,
  FaPlaneDeparture
} from 'react-icons/fa';

const DonorProfile = () => {
  const { user, refreshUser } = useAuth();
  const donor = user?.donorProfile || {};

  const initialCity = donor.city || user?.city || DEFAULT_CITY;
  const initialState = donor.state || user?.state || getStateForCity(initialCity) || DEFAULT_STATE;

  const currentLoc = donor.currentDonationLocation || {};
  const initialCurrentCity = currentLoc.city || initialCity;
  const initialCurrentState = currentLoc.state || getStateForCity(initialCurrentCity) || initialState;

  const [formData, setFormData] = useState({
    name: donor.name || user?.name || '',
    phone: donor.phone || user?.phone || '',
    bloodGroup: donor.bloodGroup || user?.bloodGroup || 'O+',
    state: initialState,
    city: initialCity,
    pinCode: donor.pinCode || '',
    address: donor.address || user?.address || '',
    gender: donor.gender || user?.gender || 'Male',
    dateOfBirth: donor.dateOfBirth || user?.dateOfBirth || '',
    emergencyContact: donor.emergencyContact || '',
    availability: donor.availability !== undefined ? donor.availability : true,
    matchingLocationPreference: donor.matchingLocationPreference || 'HOME',
    shareLocationForMatching: donor.shareLocationForMatching !== undefined ? donor.shareLocationForMatching : true,
    notificationsEnabled: donor.notificationsEnabled !== undefined ? donor.notificationsEnabled : true,
    lastDonationDate: donor.lastDonationDate ? donor.lastDonationDate.slice(0, 10) : '',
    // Current Donation Location (if travelling)
    currentDonationLocation: {
      state: initialCurrentState,
      city: initialCurrentCity,
      pinCode: currentLoc.pinCode || '',
      address: currentLoc.address || '',
      lat: currentLoc.lat || null,
      lng: currentLoc.lng || null
    }
  });

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsNotice, setGpsNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user) {
      const d = user.donorProfile || {};
      const c = d.city || user.city || DEFAULT_CITY;
      const s = d.state || user.state || getStateForCity(c) || DEFAULT_STATE;
      const cur = d.currentDonationLocation || {};
      const curC = cur.city || c;
      const curS = cur.state || getStateForCity(curC) || s;

      setFormData({
        name: d.name || user.name || '',
        phone: d.phone || user.phone || '',
        bloodGroup: d.bloodGroup || user.bloodGroup || 'O+',
        state: s,
        city: c,
        pinCode: d.pinCode || '',
        address: d.address || user.address || '',
        gender: d.gender || user.gender || 'Male',
        dateOfBirth: d.dateOfBirth || user.dateOfBirth || '',
        emergencyContact: d.emergencyContact || '',
        availability: d.availability !== undefined ? d.availability : true,
        matchingLocationPreference: d.matchingLocationPreference || 'HOME',
        shareLocationForMatching: d.shareLocationForMatching !== undefined ? d.shareLocationForMatching : true,
        notificationsEnabled: d.notificationsEnabled !== undefined ? d.notificationsEnabled : true,
        lastDonationDate: d.lastDonationDate ? d.lastDonationDate.slice(0, 10) : '',
        currentDonationLocation: {
          state: curS,
          city: curC,
          pinCode: cur.pinCode || '',
          address: cur.address || '',
          lat: cur.lat || null,
          lng: cur.lng || null
        }
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
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

  const handleCurrentLocChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      currentDonationLocation: {
        ...prev.currentDonationLocation,
        [field]: value
      }
    }));
  };

  const handleCurrentStateChange = (e) => {
    const newState = e.target.value;
    const cities = getCitiesByState(newState);
    setFormData(prev => ({
      ...prev,
      currentDonationLocation: {
        ...prev.currentDonationLocation,
        state: newState,
        city: cities[0] || ''
      }
    }));
  };

  // Browser Geolocation Detection with explicit explanation
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setGpsNotice('Geolocation is not supported by your browser. Please select your town or city manually.');
      return;
    }

    setGpsLoading(true);
    setGpsNotice('Requesting browser location permission...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setFormData(prev => ({
          ...prev,
          matchingLocationPreference: 'CURRENT',
          currentDonationLocation: {
            ...prev.currentDonationLocation,
            lat: latitude,
            lng: longitude
          }
        }));
        setGpsLoading(false);
        setGpsNotice(`GPS Coordinates acquired (~${latitude.toFixed(4)}, ${longitude.toFixed(4)}). Proximity matching enabled for current location.`);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          setGpsNotice('Location access permission was denied. You can still select your current city and state manually below.');
        } else {
          setGpsNotice('Unable to acquire GPS fix. Please select your current city and state manually.');
        }
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const donorId = donor.id || user?.id;
      await donorService.updateDonorProfile(donorId, formData);
      await refreshUser();
      setSuccessMsg('Your donor profile, location preferences, and availability have been updated.');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update donor profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid p-0" style={{ maxWidth: '850px' }}>
      <div className="mb-4 pb-2 border-bottom">
        <h2 className="fw-bold mb-1 text-dark">Donor Profile & Location Settings</h2>
        <p className="text-muted small mb-0">
          Maintain your basic details, home location, temporary donation location, and privacy preferences.
        </p>
      </div>

      {successMsg && (
        <div className="alert alert-success d-flex align-items-center gap-2 small py-2.5 mb-4 rounded-3 shadow-sm" role="alert">
          <FaCheckCircle className="flex-shrink-0" />
          <div>{successMsg}</div>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger d-flex align-items-center gap-2 small py-2.5 mb-4 rounded-3 shadow-sm" role="alert">
          <FaExclamationCircle className="flex-shrink-0" />
          <div>{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 1. BASIC DONOR INFORMATION */}
        <div className="bc-card p-4 bg-white shadow-sm border rounded-3 mb-4">
          <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2 border-bottom pb-2">
            <FaUser className="text-danger" /> Basic Information
          </h5>

          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-bold text-secondary">Full Name</label>
              <input
                type="text"
                name="name"
                required
                className="form-control"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-bold text-secondary">Email Address (Registered)</label>
              <input
                type="email"
                disabled
                className="form-control bg-light"
                value={donor.email || user?.email || ''}
              />
              <small className="text-muted" style={{ fontSize: '11px' }}>Email cannot be changed directly.</small>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-bold text-secondary">Phone Number</label>
              <input
                type="tel"
                name="phone"
                required
                className="form-control"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-bold text-danger">Blood Group</label>
              <select
                name="bloodGroup"
                className="form-select border-danger"
                value={formData.bloodGroup}
                onChange={handleChange}
              >
                {BLOOD_GROUPS.map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">Date of Birth</label>
              <input
                type="date"
                name="dateOfBirth"
                className="form-control"
                value={formData.dateOfBirth}
                onChange={handleChange}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">Gender</label>
              <select name="gender" className="form-select" value={formData.gender} onChange={handleChange}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">Emergency Contact</label>
              <input
                type="text"
                name="emergencyContact"
                className="form-control"
                placeholder="+91 98... (Next of kin)"
                value={formData.emergencyContact}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* 2. HOME LOCATION */}
        <div className="bc-card p-4 bg-white shadow-sm border rounded-3 mb-4">
          <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2 border-bottom pb-2">
            <FaMapMarkerAlt className="text-danger" /> Home Location
          </h5>

          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">Home State / UT *</label>
              <select name="state" className="form-select" value={formData.state} onChange={handleStateChange}>
                {INDIAN_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">Home City / Town *</label>
              <select name="city" className="form-select" value={formData.city} onChange={handleChange}>
                {getCitiesByState(formData.state).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">Home PIN Code</label>
              <input
                type="text"
                name="pinCode"
                className="form-control"
                placeholder="e.g. 400021"
                value={formData.pinCode}
                onChange={handleChange}
              />
            </div>

            <div className="col-12">
              <label className="form-label small fw-bold text-secondary">Residential Address / Area</label>
              <input
                type="text"
                name="address"
                className="form-control"
                placeholder="Street address or residential area"
                value={formData.address}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* 3. CURRENT DONATION LOCATION (For Travelling Donors) */}
        <div className="bc-card p-4 bg-white shadow-sm border rounded-3 mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
            <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
              <FaPlaneDeparture className="text-danger" /> Temporary / Travelling Donation Location
            </h5>
            <span className="badge bg-light text-dark border">Travel & Relocation</span>
          </div>

          <p className="text-muted small mb-3">
            Travelling or staying in another city? Set your current donation location to receive requests in your temporary vicinity without changing your permanent home address.
          </p>

          {/* Location Matching Preference Selector */}
          <div className="p-3 bg-light rounded-3 border mb-3">
            <label className="form-label small fw-bold text-dark d-block mb-2">Match Me Based On:</label>
            <div className="d-flex flex-wrap gap-4">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="matchingLocationPreference"
                  id="matchHome"
                  value="HOME"
                  checked={formData.matchingLocationPreference === 'HOME'}
                  onChange={handleChange}
                />
                <label className="form-check-label small fw-semibold" htmlFor="matchHome">
                  My Home Location ({formData.city}, {formData.state})
                </label>
              </div>

              <div className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="matchingLocationPreference"
                  id="matchCurrent"
                  value="CURRENT"
                  checked={formData.matchingLocationPreference === 'CURRENT'}
                  onChange={handleChange}
                />
                <label className="form-check-label small fw-semibold text-danger" htmlFor="matchCurrent">
                  My Current Travelling Location ({formData.currentDonationLocation.city || 'Select below'})
                </label>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">Current State / UT</label>
              <select
                className="form-select"
                value={formData.currentDonationLocation.state}
                onChange={handleCurrentStateChange}
              >
                {INDIAN_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">Current City / Town</label>
              <select
                className="form-select"
                value={formData.currentDonationLocation.city}
                onChange={(e) => handleCurrentLocChange('city', e.target.value)}
              >
                {getCitiesByState(formData.currentDonationLocation.state).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label small fw-bold text-secondary">Current PIN Code</label>
              <input
                type="text"
                className="form-control"
                placeholder="Current PIN code"
                value={formData.currentDonationLocation.pinCode}
                onChange={(e) => handleCurrentLocChange('pinCode', e.target.value)}
              />
            </div>

            {/* Optional GPS Button */}
            <div className="col-12 mt-2">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm fw-bold d-flex align-items-center gap-1.5"
                  onClick={handleDetectGps}
                  disabled={gpsLoading}
                >
                  <FaCrosshairs className="text-danger" /> 
                  {gpsLoading ? 'Detecting coordinates...' : 'Acquire Current GPS Location'}
                </button>
                <small className="text-muted">
                  Used only with your explicit permission to estimate proximity. Coordinates are never published.
                </small>
              </div>

              {gpsNotice && (
                <div className="small text-secondary mt-2 p-2 bg-light border rounded">
                  <FaShieldAlt className="text-danger me-1" /> {gpsNotice}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. AVAILABILITY & NOTIFICATION CONTROLS */}
        <div className="bc-card p-4 bg-white shadow-sm border rounded-3 mb-4">
          <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2 border-bottom pb-2">
            <FaBell className="text-danger" /> Availability & Privacy Preferences
          </h5>

          <div className="d-flex flex-column gap-3">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="availSwitch"
                name="availability"
                checked={formData.availability}
                onChange={handleChange}
              />
              <label className="form-check-label fw-bold small text-dark" htmlFor="availSwitch">
                Active Donor Availability
              </label>
              <div className="text-muted small">
                When enabled, you appear in donor searches and receive matching blood requests. Disable if unwell, travelling abroad, or temporarily unable to donate.
              </div>
            </div>

            <div className="form-check form-switch border-top pt-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="shareLocSwitch"
                name="shareLocationForMatching"
                checked={formData.shareLocationForMatching}
                onChange={handleChange}
              />
              <label className="form-check-label fw-bold small text-dark" htmlFor="shareLocSwitch">
                Allow Location Matching
              </label>
              <div className="text-muted small">
                Permit the algorithmic engine to match your city, state, or vicinity with hospital blood requests.
              </div>
            </div>

            <div className="form-check form-switch border-top pt-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="notifSwitch"
                name="notificationsEnabled"
                checked={formData.notificationsEnabled}
                onChange={handleChange}
              />
              <label className="form-check-label fw-bold small text-dark" htmlFor="notifSwitch">
                Emergency & Coordination Notifications
              </label>
              <div className="text-muted small">
                Receive high-priority alerts for matching blood requests and hospital coordination updates.
              </div>
            </div>
          </div>
        </div>

        {/* 5. VERIFIED DONATION RECORD DISPLAY */}
        <div className="bc-card p-4 bg-white shadow-sm border rounded-3 mb-4">
          <h5 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
            <FaHistory className="text-danger" /> Verified Donation History
          </h5>
          <p className="text-muted small mb-3">
            Donation counts and cooldowns are officially confirmed by hospital staff at collection time.
          </p>

          <div className="row g-3">
            <div className="col-sm-6">
              <div className="p-3 bg-light rounded-3 text-center border">
                <div className="text-muted small fw-semibold">Total Verified Donations</div>
                <h3 className="fw-bold text-dark mb-0 mt-1">{donor.totalDonations || 0}</h3>
              </div>
            </div>
            <div className="col-sm-6">
              <div className="p-3 bg-light rounded-3 text-center border">
                <div className="text-muted small fw-semibold">Last Donation Date</div>
                <h5 className="fw-bold text-dark mb-0 mt-1">
                  {formData.lastDonationDate || 'No previous recorded donations'}
                </h5>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="d-flex justify-content-end mb-5">
          <button
            type="submit"
            className="btn btn-blood fw-bold px-4 py-2.5 shadow-sm"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Saving Changes...
              </>
            ) : (
              'Save Profile & Preferences'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DonorProfile;
