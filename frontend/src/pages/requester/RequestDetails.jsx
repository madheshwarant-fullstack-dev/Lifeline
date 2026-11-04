import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestService } from '../../services/requestService';
import { screeningService } from '../../services/screeningService';
import { donorService } from '../../services/donorService';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import StatusTimeline from '../../components/common/StatusTimeline';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import { 
  FaHospital, 
  FaMapMarkerAlt, 
  FaPhoneAlt, 
  FaCalendarAlt, 
  FaTint, 
  FaUserCheck, 
  FaCheckCircle, 
  FaArrowLeft, 
  FaHeartbeat, 
  FaCheck, 
  FaTimes, 
  FaUserMd 
} from 'react-icons/fa';

const RequestDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();

  const [requestDoc, setRequestDoc] = useState(null);
  const [matchedDonors, setMatchedDonors] = useState([]);
  const [screening, setScreening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [feedback, setFeedback] = useState('');

  const getBackTarget = () => {
    if (!user) return '/';
    if (user.role === 'ADMIN') return '/admin/requests';
    if (user.role === 'DONOR') return '/donor/available-requests';
    return '/requester/my-requests';
  };

  const getBackLabel = () => {
    if (!user) return 'Back to Home';
    if (user.role === 'ADMIN') return 'Back to Requests';
    if (user.role === 'DONOR') return 'Back to Available Requests';
    return 'Back to My Requests';
  };

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const [res, matchRes, scrRes] = await Promise.all([
        requestService.getRequestById(id),
        requestService.getMatchesForRequest(id).catch(() => ({ data: { matches: [] } })),
        screeningService.getScreeningByRequest(id).catch(() => ({ data: null }))
      ]);

      if (res && res.data) {
        setRequestDoc(res.data);
      }
      if (matchRes && matchRes.data) {
        setMatchedDonors(matchRes.data.matches || []);
      }
      if (scrRes && scrRes.data) {
        setScreening(scrRes.data);
      }
    } catch (e) {
      console.error('Failed to load request details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetails();
    }
  }, [id]);

  const handleDonorRespond = async (action) => {
    try {
      setFeedback('');
      const res = await donorService.respondToRequest(id, action);
      setFeedback(res.message || `Response (${action}) recorded successfully.`);
      fetchDetails();
    } catch (err) {
      setFeedback(err.response?.data?.message || 'Could not record response.');
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    setStatusUpdating(true);
    try {
      const res = await requestService.updateRequestStatus(id, newStatus);
      if (res && res.data) {
        setRequestDoc(res.data);
        setFeedback(`Request status updated to ${newStatus}.`);
      }
    } catch (e) {
      alert("Failed to update status.");
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status" />
        <p className="text-muted small mt-2">Loading blood request and matching donors...</p>
      </div>
    );
  }

  if (!requestDoc) {
    return (
      <div className="bc-card p-5 bg-white text-center rounded-3 border">
        <h5 className="fw-bold text-dark">Request Not Found</h5>
        <p className="text-muted small">The requested blood record may have been deleted or does not exist.</p>
        <Link to={getBackTarget()} className="btn btn-outline-secondary btn-sm">
          {getBackLabel()}
        </Link>
      </div>
    );
  }

  const isEmergency = requestDoc.urgency === 'EMERGENCY';
  const isOwnerOrAdmin = user?.role === 'ADMIN' || String(requestDoc.requesterId) === String(user?.id);

  return (
    <div>
      {/* Top Breadcrumb & Actions */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <Link to={getBackTarget()} className="btn btn-outline-secondary btn-sm rounded-pill d-flex align-items-center gap-1.5">
          <FaArrowLeft size={11} /> {getBackLabel()}
        </Link>

        {isOwnerOrAdmin && (
          <div className="d-flex align-items-center gap-2">
            <span className="small text-muted fw-bold">Update Status:</span>
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={requestDoc.status}
              disabled={statusUpdating}
              onChange={(e) => handleUpdateStatus(e.target.value)}
            >
              <option value="PENDING">PENDING</option>
              <option value="MATCHED">MATCHED</option>
              <option value="DONOR_CONTACTED">DONOR_CONTACTED</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="DONATION_COMPLETED">DONATION_COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>
        )}
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show small py-2.5 mb-4" role="alert">
          <FaCheckCircle className="me-2" /> {feedback}
          <button type="button" className="btn-close py-2.5" onClick={() => setFeedback('')} />
        </div>
      )}

      {/* 1. MAIN REQUEST CARD */}
      <div className={`bc-card p-4 p-lg-5 bg-white mb-4 shadow-sm ${isEmergency ? 'border-2 border-danger' : ''}`}>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3 mb-4 pb-3 border-bottom">
          <div className="d-flex align-items-center gap-3">
            <span className="blood-badge-pill" style={{ width: '56px', height: '56px', fontSize: '1.4rem' }}>
              {requestDoc.bloodGroup}
            </span>
            <div>
              <div className="d-flex align-items-center gap-2">
                <h3 className="fw-bold text-dark mb-0">{requestDoc.patientName}</h3>
                <UrgencyBadge urgency={requestDoc.urgency} />
              </div>
              <small className="text-muted">
                Created on {new Date(requestDoc.createdAt).toLocaleString()} • ID: {requestDoc.id}
              </small>
            </div>
          </div>
          <div>
            <StatusBadge status={requestDoc.status} />
          </div>
        </div>

        {/* Status Timeline Workflow */}
        <div className="mb-4">
          <h6 className="fw-bold text-secondary mb-2 small text-uppercase tracking-wider">Transfusion Workflow Status</h6>
          <StatusTimeline currentStatus={requestDoc.status} />
        </div>

        {/* Details Grid */}
        <div className="row g-3 p-3 bg-light rounded-3 border mb-4">
          <div className="col-md-4">
            <small className="text-muted d-block">Hospital / Facility</small>
            <strong className="text-dark d-flex align-items-center gap-1.5 mt-1">
              <FaHospital className="text-secondary" /> {requestDoc.hospitalName}
            </strong>
          </div>
          <div className="col-md-4">
            <small className="text-muted d-block">Location & Hospital Address</small>
            <strong className="text-dark d-flex align-items-center gap-1.5 mt-1">
              <FaMapMarkerAlt className="text-danger" /> {requestDoc.city}{requestDoc.state ? `, ${requestDoc.state}` : ''} ({requestDoc.hospitalAddress})
            </strong>
          </div>
          <div className="col-md-4">
            <small className="text-muted d-block">Units Required</small>
            <strong className="text-dark d-flex align-items-center gap-1.5 mt-1">
              <FaTint className="text-danger" /> {requestDoc.unitsRequired} Unit(s)
            </strong>
          </div>
          <div className="col-md-4">
            <small className="text-muted d-block">Date Required</small>
            <strong className="text-dark d-flex align-items-center gap-1.5 mt-1">
              <FaCalendarAlt className="text-secondary" /> {requestDoc.requiredDate}
            </strong>
          </div>
          <div className="col-md-4">
            <small className="text-muted d-block">Contact Phone</small>
            <strong className="text-dark d-flex align-items-center gap-1.5 mt-1">
              <FaPhoneAlt className="text-secondary" /> {requestDoc.contactNumber}
            </strong>
          </div>
          <div className="col-md-4">
            <small className="text-muted d-block">Requester Contact</small>
            <strong className="text-dark d-flex align-items-center gap-1.5 mt-1">
              {requestDoc.requesterName} ({requestDoc.requesterEmail})
            </strong>
          </div>
        </div>

        {requestDoc.additionalMessage && (
          <div className="mb-4">
            <h6 className="fw-bold text-dark small mb-1">Additional Message / Clinical Notes:</h6>
            <div className="p-3 bg-white rounded border small text-secondary">
              {requestDoc.additionalMessage}
            </div>
          </div>
        )}

        {/* Accepted Donor Highlight */}
        {requestDoc.acceptedDonorName && (
          <div className="p-3 bg-success-subtle border border-success-subtle rounded-3 mb-4 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
            <div className="d-flex align-items-center gap-2">
              <FaCheckCircle className="text-success fs-4 flex-shrink-0" />
              <div>
                <strong className="text-dark d-block">Donor Confirmed: {requestDoc.acceptedDonorName}</strong>
                <small className="text-muted">Contact: {requestDoc.acceptedDonorPhone || 'Coordinate via platform'}</small>
              </div>
            </div>
            <span className="badge bg-success text-white py-1.5 px-3 rounded-pill fw-bold">
              Donor Accepted
            </span>
          </div>
        )}

        {/* DONOR ACTION / SCREENING PROMPT SECTION */}
        {user?.role === 'DONOR' && (
          <div className="p-4 rounded-3 border bg-light mb-4 shadow-sm">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div>
                <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                  <FaHeartbeat className="text-danger" /> Donor Health Screening & Coordination
                </h5>
                <p className="text-muted small mb-0">
                  Standard pre-donation screening must be submitted before hospital arrival.
                </p>
              </div>

              <div className="flex-shrink-0">
                {requestDoc.status === 'ACCEPTED' ? (
                  <Link
                    to={`/donor/screening/${requestDoc.id}`}
                    className="btn btn-blood fw-bold px-4 py-2.5 rounded-pill shadow-sm d-inline-flex align-items-center gap-2"
                  >
                    <FaHeartbeat size={15} /> Proceed to Donation Screening &rarr;
                  </Link>
                ) : screening ? (
                  <Link
                    to={`/donor/screening/${requestDoc.id}`}
                    className="btn btn-outline-info fw-bold px-3 py-2 rounded-pill d-inline-flex align-items-center gap-1.5"
                  >
                    <FaCheckCircle size={14} /> View Screening Status & Instructions
                  </Link>
                ) : (
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-success fw-bold px-3 py-2 rounded-pill d-inline-flex align-items-center gap-1.5 shadow-sm"
                      onClick={() => handleDonorRespond('ACCEPT')}
                    >
                      <FaCheck size={12} /> Accept Request
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary px-3 py-2 rounded-pill"
                      onClick={() => handleDonorRespond('REJECT')}
                    >
                      <FaTimes size={12} /> Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MEDICAL STAFF / ADMIN SCREENING REVIEW CALLOUT */}
        {(user?.role === 'ADMIN' || user?.role === 'HOSPITAL') && screening && (
          <div className="p-4 rounded-3 border bg-warning-subtle border-warning-subtle mb-4 shadow-sm">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div>
                <h6 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                  <FaUserMd className="text-danger" /> Pre-Donation Medical Screening Record
                </h6>
                <div className="small text-secondary">
                  Status: <strong>{screening.status}</strong> • Flagged Disclosures: {screening.hasFlaggedAnswers ? '⚠️ Disclosures reported' : 'None reported'}
                </div>
              </div>
              <Link to="/admin/screenings" className="btn btn-danger btn-sm fw-bold rounded-pill px-3 py-1.5">
                Open Medical Screening Console &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 2. MATCHED DONORS SECTION */}
      <div className="bc-card p-4 p-lg-5 bg-white mb-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 className="fw-bold text-dark mb-0">Algorithmic Donor Matches</h4>
            <p className="text-muted small mb-0">
              Ranked by red cell compatibility, proximity to {requestDoc.city}{requestDoc.state ? `, ${requestDoc.state}` : ''}, and donation cooldown status.
            </p>
          </div>
          <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-3 py-1.5 fw-bold">
            {matchedDonors.length} Donors Found
          </span>
        </div>

        {matchedDonors.length === 0 ? (
          <div className="text-center py-5 bg-light rounded-3 border">
            <FaUserCheck className="text-muted mb-2" size={32} />
            <h6 className="fw-bold text-dark">No Compatible Donors Located Currently</h6>
            <p className="text-muted small mb-0">
              Our automated system continues to monitor for newly registered or active donors.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small">
                <tr>
                  <th>Donor Name</th>
                  <th>Blood Group</th>
                  <th>Location</th>
                  <th>Availability</th>
                  <th>Last Donation</th>
                  <th>Match Score</th>
                  <th className="text-end">Contact Coordination</th>
                </tr>
              </thead>
              <tbody className="small">
                {matchedDonors.map((donor) => (
                  <tr key={donor.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <strong className="text-dark">{donor.name}</strong>
                        {donor.verificationStatus === 'VERIFIED' && (
                          <span className="badge bg-success-subtle text-success border border-success-subtle py-0.5 px-1.5" style={{ fontSize: '10px' }}>
                            Verified
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="blood-badge-pill" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                        {donor.bloodGroup}
                      </span>
                    </td>
                    <td>
                      <span className="text-dark">{donor.city}{donor.state ? `, ${donor.state}` : ''}</span>
                    </td>
                    <td>
                      <span className={`badge rounded-pill ${donor.availability ? 'bg-success' : 'bg-secondary'}`}>
                        {donor.availability ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td>
                      <span className="text-muted">
                        {donor.lastDonationDate ? new Date(donor.lastDonationDate).toLocaleDateString() : 'Never logged'}
                      </span>
                    </td>
                    <td>
                      <span className="match-score-badge">
                        {donor.matchScore}% Match
                      </span>
                    </td>
                    <td className="text-end">
                      <a href={`tel:${donor.phone}`} className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1">
                        <FaPhoneAlt size={10} /> Call {donor.phone || 'Donor'}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DisclaimerAlert />
    </div>
  );
};

export default RequestDetails;
