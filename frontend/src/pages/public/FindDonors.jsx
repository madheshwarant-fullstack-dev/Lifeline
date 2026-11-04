import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { donorService } from '../../services/donorService';
import { useAuth } from '../../context/AuthContext';
import { BLOOD_GROUPS, INDIAN_STATES, getCitiesByState } from '../../utils/constants';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import { 
  FaSearch, 
  FaTint, 
  FaMapMarkerAlt, 
  FaCheckCircle, 
  FaLock, 
  FaPhoneAlt, 
  FaExclamationTriangle,
  FaInfoCircle,
  FaRedoAlt,
  FaPaperPlane
} from 'react-icons/fa';

const FindDonors = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [bloodGroup, setBloodGroup] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [availabilityOnly, setAvailabilityOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Contact Modal State
  const [contactDonorTarget, setContactDonorTarget] = useState(null);
  const [contactForm, setContactForm] = useState({
    patientName: '',
    hospitalName: '',
    contactPhone: user?.phone || '',
    urgency: 'HIGH',
    message: ''
  });
  const [contactSending, setContactSending] = useState(false);
  const [contactSuccess, setContactSuccess] = useState('');
  const [contactError, setContactError] = useState('');

  // Dynamic Cities for selected state
  const availableCities = selectedState ? getCitiesByState(selectedState) : [];

  const fetchDonors = async () => {
    setLoading(true);
    try {
      const params = {};
      if (bloodGroup) params.bloodGroup = bloodGroup;
      if (selectedState) params.state = selectedState;
      if (selectedCity) params.city = selectedCity;
      if (availabilityOnly) params.availability = 'true';
      if (searchTerm) params.search = searchTerm;

      const res = await donorService.getDonors(params);
      if (res && res.data) {
        setDonors(res.data);
      }
    } catch (err) {
      console.error('Failed to load donors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors();
  }, [bloodGroup, selectedState, selectedCity, availabilityOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDonors();
  };

  const handleResetFilters = () => {
    setBloodGroup('');
    setSelectedState('');
    setSelectedCity('');
    setAvailabilityOnly(false);
    setSearchTerm('');
    setLoading(true);
    donorService.getDonors({}).then((res) => {
      if (res && res.data) setDonors(res.data);
    }).catch((err) => {
      console.error('Failed to load donors:', err);
    }).finally(() => {
      setLoading(false);
    });
  };

  const openContactModal = (donor) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/find-donors' }, notice: 'Please sign in to contact donors.' } });
      return;
    }
    setContactDonorTarget(donor);
    setContactForm({
      patientName: '',
      hospitalName: '',
      contactPhone: user?.phone || '',
      urgency: 'HIGH',
      message: `Emergency request for ${donor.bloodGroup} blood at nearby hospital.`
    });
    setContactSuccess('');
    setContactError('');
  };

  const handleSendContact = async (e) => {
    e.preventDefault();
    if (!contactDonorTarget) return;

    setContactSending(true);
    setContactSuccess('');
    setContactError('');

    try {
      const res = await donorService.contactDonor(contactDonorTarget.id || contactDonorTarget._id, {
        patientName: contactForm.patientName,
        hospitalName: contactForm.hospitalName,
        bloodGroup: contactDonorTarget.bloodGroup,
        city: contactDonorTarget.city,
        urgency: contactForm.urgency,
        contactPhone: contactForm.contactPhone,
        message: contactForm.message
      });
      setContactSuccess(res.message || 'Notification sent to donor successfully!');
      setTimeout(() => {
        setContactDonorTarget(null);
        setContactSuccess('');
      }, 2000);
    } catch (err) {
      setContactError(err.response?.data?.message || 'Failed to send contact notification.');
    } finally {
      setContactSending(false);
    }
  };

  return (
    <div className="py-5 bg-light min-vh-100">
      <div className="container">
        {/* Page Title & Intro */}
        <div className="text-center max-w-700 mx-auto mb-4">
          <span className="badge bg-danger-subtle text-danger px-3 py-1.5 rounded-pill fw-bold mb-2">
            VOLUNTARY DONOR REGISTRY
          </span>
          <h1 className="display-6 fw-extrabold text-dark mb-2">
            Find Blood <span className="text-danger">Donors</span>
          </h1>
          <p className="text-secondary small">
            Locate compatible, voluntary blood donors across Indian cities. Connect quickly and securely with donors ready to save lives.
          </p>
        </div>

        {/* Medical Advisory Box */}
        <div className="mb-4">
          <DisclaimerAlert customText="Donor search offers preliminary voluntary donor availability. All compatibility verifications, antibody screenings, and transfusion approvals must be conducted by certified healthcare professionals and hospital blood banks." />
        </div>

        {/* Search & Filter Controls Bar */}
        <div className="bc-card p-4 bg-white shadow-sm mb-4 border">
          <form onSubmit={handleSearchSubmit}>
            <div className="row g-3">
              {/* Keyword / Name / City input */}
              <div className="col-md-4">
                <label className="form-label small fw-bold text-secondary mb-1">Search Keyword</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light text-muted border-end-0">
                    <FaSearch />
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Search by city, state, or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Blood Group */}
              <div className="col-sm-6 col-md-2">
                <label className="form-label small fw-bold text-secondary mb-1">Blood Group</label>
                <select
                  className="form-select form-select-sm"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                >
                  <option value="">All Blood Types</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              {/* State */}
              <div className="col-sm-6 col-md-3">
                <label className="form-label small fw-bold text-secondary mb-1">State / UT</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSelectedCity('');
                  }}
                >
                  <option value="">All Indian States</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* City (Dynamic based on selected state) */}
              <div className="col-sm-6 col-md-3">
                <label className="form-label small fw-bold text-secondary mb-1">City</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  disabled={!selectedState}
                >
                  <option value="">{selectedState ? 'All Cities in State' : 'Select State first'}</option>
                  {availableCities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bottom Row: Availability Checkbox and Buttons */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-3 border-top gap-2">
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="availabilitySwitch"
                  checked={availabilityOnly}
                  onChange={(e) => setAvailabilityOnly(e.target.checked)}
                />
                <label className="form-check-label small fw-semibold text-dark" htmlFor="availabilitySwitch">
                  Show Available Donors Only
                </label>
              </div>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                >
                  <FaRedoAlt size={11} /> Reset
                </button>
                <button
                  type="submit"
                  className="btn btn-blood btn-sm fw-bold px-3 d-flex align-items-center gap-1"
                >
                  <FaSearch size={11} /> Apply Filters
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Results Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="small text-muted">
            Found <strong className="text-dark">{donors.length}</strong> matching blood donor(s)
          </div>
          <Link to="/requester/create-request" className="btn btn-outline-danger btn-sm rounded-pill fw-semibold">
            Can't find a donor? Broadcast Emergency Request &rarr;
          </Link>
        </div>

        {/* Donors Cards Grid */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-danger" role="status" />
            <p className="text-muted small mt-2">Searching registered voluntary donors...</p>
          </div>
        ) : donors.length === 0 ? (
          <div className="bc-card p-5 bg-white text-center rounded-3 border">
            <FaTint className="text-muted mb-3" size={40} />
            <h5 className="fw-bold text-dark">No Matching Donors Found</h5>
            <p className="text-muted small mb-3">
              Try adjusting your blood group, state, or availability filter to widen the search scope.
            </p>
            <button type="button" onClick={handleResetFilters} className="btn btn-blood btn-sm fw-bold">
              View All Registered Donors
            </button>
          </div>
        ) : (
          <div className="row g-3">
            {donors.map((donor) => {
              const isAvailable = donor.availability;
              return (
                <div key={donor.id || donor._id} className="col-sm-6 col-lg-4 col-xl-3">
                  <div className="bc-card p-3 bg-white h-100 d-flex flex-column shadow-sm border transition-all hover-shadow">
                    {/* Card Top: Blood Badge & Status */}
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="blood-badge-pill" style={{ width: '42px', height: '42px', fontSize: '1rem' }}>
                        {donor.bloodGroup}
                      </span>
                      <div className="d-flex flex-column align-items-end gap-1">
                        <span className={`badge rounded-pill px-2 py-1 ${isAvailable ? 'bg-success text-white' : 'bg-secondary text-white'}`} style={{ fontSize: '10px' }}>
                          {isAvailable ? '● Available' : 'Unavailable'}
                        </span>
                        {donor.verificationStatus === 'VERIFIED' && (
                          <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2" style={{ fontSize: '10px' }}>
                            <FaCheckCircle className="me-1" size={10} /> Verified
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Donor Details */}
                    <h6 className="fw-bold text-dark mb-1 text-truncate" title={donor.name}>
                      {donor.name}
                    </h6>
                    <div className="text-muted small mb-2 d-flex align-items-center gap-1">
                      <FaMapMarkerAlt className="text-danger flex-shrink-0" size={12} />
                      <span className="text-truncate">{donor.city}{donor.state ? `, ${donor.state}` : ''}</span>
                    </div>

                    {/* Masked Contact Info for Privacy */}
                    <div className="p-2 bg-light rounded-2 small text-muted mb-3 border">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span style={{ fontSize: '11px' }} className="fw-semibold text-secondary">
                          <FaPhoneAlt className="me-1" size={10} /> Phone:
                        </span>
                        <span className="badge bg-white text-muted border font-monospace" style={{ fontSize: '11px' }}>
                          {donor.phone || '+91 98•••• •••••'}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-1 text-secondary" style={{ fontSize: '10px' }}>
                        <FaLock size={9} className="text-muted flex-shrink-0" />
                        <span>Protected. Request or connect via platform.</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-auto pt-2 border-top">
                      <button
                        type="button"
                        className="btn btn-blood btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1.5 py-1.5"
                        onClick={() => openContactModal(donor)}
                      >
                        <FaPaperPlane size={11} /> Request Blood / Contact
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {contactDonorTarget && (
        <div 
          className="modal show d-block" 
          tabIndex="-1" 
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !contactSending) {
              setContactDonorTarget(null);
            }
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-danger text-white py-3">
                <h5 className="modal-title fw-bold fs-6 d-flex align-items-center gap-2">
                  <FaTint /> Contact Donor: {contactDonorTarget.name} ({contactDonorTarget.bloodGroup})
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setContactDonorTarget(null)}
                  disabled={contactSending}
                />
              </div>

              <form onSubmit={handleSendContact}>
                <div className="modal-body p-4">
                  {contactSuccess && (
                    <div className="alert alert-success d-flex align-items-center gap-2 small py-2 mb-3">
                      <FaCheckCircle className="flex-shrink-0" />
                      <div>{contactSuccess}</div>
                    </div>
                  )}

                  {contactError && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 small py-2 mb-3">
                      <FaExclamationTriangle className="flex-shrink-0" />
                      <div>{contactError}</div>
                    </div>
                  )}

                  <p className="text-muted small mb-3">
                    Submitting this form immediately dispatches high-priority in-app alerts and notifications to <strong>{contactDonorTarget.name}</strong> for {contactDonorTarget.bloodGroup} blood donation in {contactDonorTarget.city}.
                  </p>

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Patient Name *</label>
                      <input
                        type="text"
                        required
                        className="form-control form-control-sm"
                        placeholder="Patient Full Name"
                        value={contactForm.patientName}
                        onChange={(e) => setContactForm({ ...contactForm, patientName: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Hospital Name & City *</label>
                      <input
                        type="text"
                        required
                        className="form-control form-control-sm"
                        placeholder="e.g. Lilavati Hospital, Mumbai"
                        value={contactForm.hospitalName}
                        onChange={(e) => setContactForm({ ...contactForm, hospitalName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Contact Phone *</label>
                      <input
                        type="tel"
                        required
                        className="form-control form-control-sm"
                        placeholder="+91 98765 43210"
                        value={contactForm.contactPhone}
                        onChange={(e) => setContactForm({ ...contactForm, contactPhone: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Urgency Level</label>
                      <select
                        className="form-select form-select-sm"
                        value={contactForm.urgency}
                        onChange={(e) => setContactForm({ ...contactForm, urgency: e.target.value })}
                      >
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High</option>
                        <option value="EMERGENCY">Emergency (Trauma / ICU)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-bold text-secondary mb-1">Message to Donor</label>
                    <textarea
                      rows="2"
                      className="form-control form-control-sm"
                      placeholder="Specify units needed or any special medical requirements..."
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    />
                  </div>

                  <div className="text-muted small mt-2 d-flex align-items-center gap-1.5" style={{ fontSize: '11px' }}>
                    <FaInfoCircle className="text-secondary flex-shrink-0" />
                    <span>Donor contact coordinates are safely transmitted through authenticated notification channels.</span>
                  </div>
                </div>

                <div className="modal-footer bg-light py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setContactDonorTarget(null)}
                    disabled={contactSending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-blood btn-sm fw-bold px-4"
                    disabled={contactSending}
                  >
                    {contactSending ? 'Dispatching...' : 'Send Request to Donor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindDonors;
