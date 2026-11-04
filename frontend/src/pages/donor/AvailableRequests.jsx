import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestService } from '../../services/requestService';
import { donorService } from '../../services/donorService';
import { BLOOD_GROUPS, INDIAN_STATES, getCitiesByState, URGENCIES } from '../../utils/constants';
import StatusBadge from '../../components/common/StatusBadge';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import { 
  FaFilter, 
  FaSearch, 
  FaHospital, 
  FaMapMarkerAlt, 
  FaCheck, 
  FaTimes, 
  FaCalendarAlt, 
  FaCheckCircle, 
  FaHeartbeat, 
  FaPhoneAlt, 
  FaArrowRight 
} from 'react-icons/fa';

const AvailableRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    bloodGroup: '',
    state: '',
    city: '',
    urgency: ''
  });
  const [feedback, setFeedback] = useState('');
  const [lastAcceptedId, setLastAcceptedId] = useState(null);
  const navigate = useNavigate();

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const activeFilters = {};
      if (filters.bloodGroup) activeFilters.bloodGroup = filters.bloodGroup;
      if (filters.state) activeFilters.state = filters.state;
      if (filters.city) activeFilters.city = filters.city;
      if (filters.urgency) activeFilters.urgency = filters.urgency;

      const res = await requestService.getRequests(activeFilters);
      if (res && res.data) {
        setRequests(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch requests:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filters]);

  const handleRespond = async (requestId, action) => {
    try {
      setFeedback('');
      const res = await donorService.respondToRequest(requestId, action);
      if (action === 'ACCEPT') {
        setLastAcceptedId(requestId);
        setFeedback("Request accepted! Next step: Complete your pre-donation health screening.");
      } else {
        setFeedback(res.message || `Response (${action}) recorded successfully.`);
      }
      fetchRequests();
    } catch (err) {
      setFeedback(err.response?.data?.message || 'Could not record response.');
    }
  };

  return (
    <div>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">Open Blood Requests</h2>
          <p className="text-muted small mb-0">
            Browse through active patient requests across hospitals. Emergency requests are prioritized.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="alert alert-info alert-dismissible fade show small py-3 mb-4 shadow-sm border-0 border-start border-primary border-4" role="alert">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
            <div className="d-flex align-items-center gap-2">
              <FaCheckCircle className="text-primary flex-shrink-0 fs-5" /> 
              <span>{feedback}</span>
            </div>
            {lastAcceptedId && (
              <Link 
                to={`/donor/screening/${lastAcceptedId}`} 
                className="btn btn-blood btn-sm fw-bold px-3 py-1.5 rounded-pill flex-shrink-0 d-inline-flex align-items-center gap-1 shadow-sm"
              >
                <FaHeartbeat size={13} /> Proceed to Donation Screening &rarr;
              </Link>
            )}
          </div>
          <button type="button" className="btn-close py-2.5" onClick={() => { setFeedback(''); setLastAcceptedId(null); }} />
        </div>
      )}

      {/* Filter Bar */}
      <div className="bc-card p-3 bg-white mb-4 shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-md-3">
            <label className="form-label small fw-bold text-secondary mb-1">Blood Group</label>
            <select
              className="form-select form-select-sm"
              value={filters.bloodGroup}
              onChange={(e) => setFilters({ ...filters, bloodGroup: e.target.value })}
            >
              <option value="">All Blood Groups</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label small fw-bold text-secondary mb-1">State / UT</label>
            <select
              className="form-select form-select-sm"
              value={filters.state}
              onChange={(e) => {
                const s = e.target.value;
                setFilters({ ...filters, state: s, city: '' });
              }}
            >
              <option value="">All Indian States</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="col-md-2">
            <label className="form-label small fw-bold text-secondary mb-1">City</label>
            <select
              className="form-select form-select-sm"
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            >
              <option value="">All Cities</option>
              {(filters.state ? getCitiesByState(filters.state) : getCitiesByState(null)).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="col-md-2">
            <label className="form-label small fw-bold text-secondary mb-1">Urgency</label>
            <select
              className="form-select form-select-sm"
              value={filters.urgency}
              onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}
            >
              <option value="">All Urgencies</option>
              {URGENCIES.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          <div className="col-md-2 d-flex align-items-end mt-3 mt-md-0">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm w-100 mt-md-4"
              onClick={() => setFilters({ bloodGroup: '', state: '', city: '', urgency: '' })}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Requests Grid */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status" />
          <p className="text-muted small mt-2">Searching available requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="p-5 bg-white text-center rounded-3 border">
          <h5 className="fw-bold text-dark">No Blood Requests Found</h5>
          <p className="text-muted small">No blood requests currently match the selected criteria.</p>
        </div>
      ) : (
        <div className="row g-3 mb-4">
          {requests.map((req) => {
            const isEmergency = req.urgency === 'EMERGENCY';
            const isAccepted = req.status === 'ACCEPTED';
            const isScreeningSubmitted = req.status === 'SCREENING_SUBMITTED' || req.screeningStatus === 'AWAITING_REVIEW';
            const isScheduled = req.status === 'SCHEDULED' || req.screeningStatus === 'APPROVED';

            return (
              <div key={req.id} className="col-md-6 col-lg-4">
                <div className={`bc-card p-3.5 h-100 d-flex flex-column ${isEmergency ? 'emergency-card-glow' : 'bg-white'}`}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="blood-badge-pill" style={{ width: '44px', height: '44px', fontSize: '1.1rem' }}>
                      {req.bloodGroup}
                    </span>
                    <UrgencyBadge urgency={req.urgency} />
                  </div>

                  <h5 className="fw-bold text-dark mb-1">{req.patientName}</h5>
                  <div className="text-muted small mb-1.5 d-flex align-items-center gap-1.5">
                    <FaHospital className="text-secondary flex-shrink-0" /> 
                    <span className="text-truncate" title={req.hospitalName}>{req.hospitalName}</span>
                  </div>
                  <div className="text-muted small mb-1.5 d-flex align-items-center gap-1.5">
                    <FaMapMarkerAlt className="text-danger flex-shrink-0" /> 
                    <span>{req.city}{req.state ? `, ${req.state}` : ''} • <strong className="text-dark">{req.unitsRequired} unit(s) needed</strong></span>
                  </div>
                  <div className="text-muted small mb-2 d-flex align-items-center gap-1.5">
                    <FaCalendarAlt className="text-secondary flex-shrink-0" /> Required Date: <strong className="text-dark">{req.requiredDate}</strong>
                  </div>

                  {/* Coordination contact info */}
                  {(req.contactNumber || req.requesterPhone) && (
                    <div className="text-muted small mb-2 d-flex align-items-center gap-1.5">
                      <FaPhoneAlt className="text-secondary flex-shrink-0" size={11} /> 
                      <span>Coordination: <strong className="text-dark">{req.contactNumber || req.requesterPhone}</strong></span>
                    </div>
                  )}

                  {req.additionalMessage && (
                    <div className="p-2 bg-light rounded small text-secondary mb-3 border font-italic" style={{ fontSize: '0.8rem' }}>
                      "{req.additionalMessage}"
                    </div>
                  )}

                  <div className="mt-auto pt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <StatusBadge status={req.status} />
                    </div>

                    {/* Action buttons following user requirements */}
                    {isAccepted ? (
                      <div className="d-flex flex-column gap-1.5">
                        <Link
                          to={`/donor/screening/${req.id}`}
                          className="btn btn-sm btn-blood fw-bold w-100 d-flex align-items-center justify-content-center gap-1.5 shadow-sm py-2"
                        >
                          <FaHeartbeat size={13} /> Proceed to Donation Screening
                        </Link>
                      </div>
                    ) : isScreeningSubmitted ? (
                      <Link
                        to={`/donor/screening/${req.id}`}
                        className="btn btn-sm btn-outline-info fw-bold w-100 d-flex align-items-center justify-content-center gap-1.5 py-1.5"
                      >
                        <FaCheckCircle size={12} /> Screening Submitted – Awaiting Review
                      </Link>
                    ) : isScheduled ? (
                      <Link
                        to={`/donor/screening/${req.id}`}
                        className="btn btn-sm btn-outline-success fw-bold w-100 d-flex align-items-center justify-content-center gap-1.5 py-1.5"
                      >
                        <FaCheckCircle size={12} /> Medically Cleared – Coordination
                      </Link>
                    ) : (
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-success fw-bold flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 py-2 shadow-sm"
                          onClick={() => handleRespond(req.id, 'ACCEPT')}
                        >
                          <FaCheck size={12} /> Accept Request
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary px-3 py-2"
                          onClick={() => handleRespond(req.id, 'REJECT')}
                          title="Decline"
                        >
                          <FaTimes size={12} /> Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DisclaimerAlert />
    </div>
  );
};

export default AvailableRequests;
