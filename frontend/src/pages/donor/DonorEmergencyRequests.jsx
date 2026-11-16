import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { donorService } from '../../services/donorService';
import { requestService } from '../../services/requestService';
import { useWebSocket } from '../../context/WebSocketContext';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import StatusBadge from '../../components/common/StatusBadge';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import { 
  FaHospital, 
  FaMapMarkerAlt, 
  FaPhoneAlt, 
  FaCalendarAlt, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaHeartbeat, 
  FaSyncAlt, 
  FaBroadcastTower,
  FaShieldAlt,
  FaExclamationTriangle,
  FaArrowRight
} from 'react-icons/fa';

const DonorEmergencyRequests = () => {
  const { connected, subscribe } = useWebSocket();
  const [invitations, setInvitations] = useState([]);
  const [emergencyRequests, setEmergencyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, reqRes] = await Promise.all([
        donorService.getInvitations().catch(() => ({ data: { invitations: [] } })),
        requestService.getRequests({ urgency: 'EMERGENCY' }).catch(() => ({ data: [] }))
      ]);

      const invList = invRes?.data?.invitations || invRes?.invitations || [];
      const reqList = reqRes?.data || [];

      setInvitations(invList);
      setEmergencyRequests(reqList);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg('Failed to load emergency blood requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-Time live updates
  useEffect(() => {
    const unsubInvite = subscribe('donor_invited', loadData);
    const unsubStatus = subscribe('request_status_updated', loadData);
    const unsubResponse = subscribe('donor_responded', loadData);
    return () => {
      unsubInvite();
      unsubStatus();
      unsubResponse();
    };
  }, [subscribe, loadData]);

  const handleRespond = async (requestId, action) => {
    setActionLoadingId(requestId);
    setFeedback('');
    setErrorMsg('');
    try {
      const res = await donorService.respondToRequest(requestId, action);
      if (action === 'ACCEPT') {
        setFeedback('Thank you! You have accepted this blood request. Next step: complete your pre-donation health screening.');
      } else {
        setFeedback('You have declined this request. The hospital will be notified immediately.');
      }
      await loadData();
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err?.response?.data?.detail || 'Failed to record your response.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Combine invitations and emergency requests without duplication
  const displayedRequests = [];
  const seenIds = new Set();

  invitations.forEach((inv) => {
    const id = inv.requestId || inv.id;
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      displayedRequests.push({
        id,
        isDirectInvitation: true,
        hospitalName: inv.hospitalName,
        bloodGroup: inv.bloodGroup,
        unitsRequired: inv.unitsRequired || 1,
        urgency: inv.urgency || 'EMERGENCY',
        distanceKm: inv.approximateDistanceKm ?? inv.distanceKm,
        requiredDate: inv.requiredDate,
        createdAt: inv.createdAt || inv.invitedAt,
        contactNumber: inv.contactPhone || inv.contactNumber,
        hospitalAddress: inv.hospitalAddress || `${inv.city || ''}, ${inv.state || ''}`,
        status: inv.invitationStatus || inv.status || 'PENDING',
        patientName: inv.patientName || 'Emergency Patient'
      });
    }
  });

  emergencyRequests.forEach((req) => {
    const id = req.id || req._id;
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      displayedRequests.push({
        id,
        isDirectInvitation: false,
        hospitalName: req.hospitalName,
        bloodGroup: req.bloodGroup,
        unitsRequired: req.unitsRequired || 1,
        urgency: req.urgency || 'EMERGENCY',
        distanceKm: req.approximateDistanceKm ?? req.distanceKm,
        requiredDate: req.requiredDate,
        createdAt: req.createdAt,
        contactNumber: req.contactNumber || req.contactPhone,
        hospitalAddress: req.hospitalAddress || `${req.city || ''}, ${req.state || ''}`,
        status: req.status || 'PENDING',
        patientName: req.patientName || 'Emergency Patient'
      });
    }
  });

  return (
    <div>
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h2 className="fw-bold mb-0 text-dark">Emergency Blood Requests &amp; Invitations</h2>
            <span className={`badge rounded-pill ${connected ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}>
              <FaBroadcastTower size={10} className="me-1" />
              {connected ? 'Live Sync Active' : 'Connecting'}
            </span>
          </div>
          <p className="text-muted small mb-0">
            Immediate hospital transfusion alerts matched to your blood group and location. Accept or reject requests in real time.
          </p>
        </div>
        <div className="mt-3 mt-md-0">
          <button
            type="button"
            className="btn btn-sm btn-light border rounded-pill d-inline-flex align-items-center gap-1.5 shadow-sm"
            onClick={loadData}
          >
            <FaSyncAlt size={12} /> Refresh Alerts
          </button>
        </div>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show small py-2.5 mb-4 shadow-sm" role="alert">
          <FaCheckCircle className="me-2 text-success" /> {feedback}
          <button type="button" className="btn-close py-2.5" onClick={() => setFeedback('')} />
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show small py-2.5 mb-4 shadow-sm" role="alert">
          <FaExclamationTriangle className="me-2 text-danger" /> {errorMsg}
          <button type="button" className="btn-close py-2.5" onClick={() => setErrorMsg('')} />
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status" />
          <p className="text-muted small mt-2">Checking real-time hospital emergency requests...</p>
        </div>
      ) : displayedRequests.length === 0 ? (
        <div className="bc-card p-5 bg-white text-center rounded-3 border">
          <FaCheckCircle className="text-success mb-3" size={40} />
          <h5 className="fw-bold text-dark">No Active Emergency Requests</h5>
          <p className="text-muted small mb-0" style={{ maxWidth: 500, margin: '0 auto' }}>
            There are currently no urgent blood requests matching your profile. Ensure your Live Location sharing is active so hospitals can alert you when critical needs arise.
          </p>
        </div>
      ) : (
        <div className="row g-3">
          {displayedRequests.map((req) => {
            const isAccepted = req.status === 'ACCEPTED';
            const isRejected = req.status === 'REJECTED' || req.status === 'DECLINED';
            const isPending = !isAccepted && !isRejected;
            const isBusy = actionLoadingId === req.id;

            return (
              <div key={req.id} className="col-lg-6">
                <div className="bc-card p-4 bg-white border shadow-sm rounded-3 h-100 d-flex flex-column emergency-card-glow">
                  {/* Top Bar: Blood Group, Urgency & Request ID */}
                  <div className="d-flex justify-content-between align-items-start mb-3 pb-2 border-bottom">
                    <div className="d-flex align-items-center gap-2.5">
                      <span className="blood-badge-pill" style={{ width: 48, height: 48, fontSize: '1.2rem' }}>
                        {req.bloodGroup}
                      </span>
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <h5 className="fw-bold text-dark mb-0">{req.patientName}</h5>
                          {req.isDirectInvitation && (
                            <span className="badge bg-danger text-white rounded-pill" style={{ fontSize: '10px' }}>
                              Direct Invite
                            </span>
                          )}
                        </div>
                        <small className="text-muted font-monospace" style={{ fontSize: '11px' }}>
                          Request ID: {req.id}
                        </small>
                      </div>
                    </div>
                    <div>
                      <UrgencyBadge urgency={req.urgency} />
                    </div>
                  </div>

                  {/* Core Details Grid */}
                  <div className="row g-2.5 small mb-3">
                    <div className="col-sm-6">
                      <span className="text-secondary d-block" style={{ fontSize: '11px' }}>Hospital / Facility:</span>
                      <strong className="text-dark d-flex align-items-center gap-1.5">
                        <FaHospital className="text-secondary flex-shrink-0" /> {req.hospitalName}
                      </strong>
                    </div>

                    <div className="col-sm-6">
                      <span className="text-secondary d-block" style={{ fontSize: '11px' }}>Required Units:</span>
                      <strong className="text-dark">
                        {req.unitsRequired} Unit(s)
                      </strong>
                    </div>

                    <div className="col-sm-6">
                      <span className="text-secondary d-block" style={{ fontSize: '11px' }}>Hospital Address &amp; Location:</span>
                      <span className="text-dark d-flex align-items-center gap-1.5">
                        <FaMapMarkerAlt className="text-danger flex-shrink-0" /> {req.hospitalAddress}
                      </span>
                    </div>

                    <div className="col-sm-6">
                      <span className="text-secondary d-block" style={{ fontSize: '11px' }}>Approximate Distance:</span>
                      <strong className="text-dark">
                        {req.distanceKm !== undefined && req.distanceKm !== null ? `~${req.distanceKm} km away` : 'Within metropolitan radius'}
                      </strong>
                    </div>

                    <div className="col-sm-6">
                      <span className="text-secondary d-block" style={{ fontSize: '11px' }}>Request Date &amp; Time:</span>
                      <span className="text-dark d-flex align-items-center gap-1.5">
                        <FaCalendarAlt className="text-secondary flex-shrink-0" /> {req.createdAt ? new Date(req.createdAt).toLocaleString() : 'Recent alert'}
                      </span>
                    </div>

                    {req.contactNumber && (
                      <div className="col-sm-6">
                        <span className="text-secondary d-block" style={{ fontSize: '11px' }}>Hospital Contact Phone:</span>
                        <a href={`tel:${req.contactNumber}`} className="text-danger fw-bold text-decoration-none d-flex align-items-center gap-1.5">
                          <FaPhoneAlt size={11} /> {req.contactNumber}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Prominent Action Buttons */}
                  <div className="mt-auto pt-3 border-top">
                    {isAccepted ? (
                      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
                        <span className="badge bg-success text-white py-2 px-3 rounded-pill fw-bold">
                          <FaCheckCircle className="me-1" /> Accepted by You
                        </span>
                        <Link
                          to={`/donor/screening/${req.id}`}
                          className="btn btn-blood btn-sm fw-bold px-3 py-2 rounded-pill shadow-sm d-inline-flex align-items-center gap-1.5"
                        >
                          <FaHeartbeat size={13} /> Proceed to Donation Screening <FaArrowRight size={10} />
                        </Link>
                      </div>
                    ) : isRejected ? (
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="badge bg-secondary text-white py-2 px-3 rounded-pill fw-bold">
                          <FaTimesCircle className="me-1" /> You Rejected this Request
                        </span>
                        <small className="text-muted">The hospital has been notified to invite another donor.</small>
                      </div>
                    ) : (
                      <div className="row g-2">
                        <div className="col-6">
                          <button
                            type="button"
                            className="btn btn-success fw-bold w-100 py-2.5 rounded-pill shadow-sm d-flex align-items-center justify-content-center gap-2"
                            disabled={isBusy}
                            onClick={() => handleRespond(req.id, 'ACCEPT')}
                          >
                            <FaCheckCircle size={14} />
                            {isBusy ? 'Processing...' : 'ACCEPT DONATION'}
                          </button>
                        </div>
                        <div className="col-6">
                          <button
                            type="button"
                            className="btn btn-danger fw-bold w-100 py-2.5 rounded-pill shadow-sm d-flex align-items-center justify-content-center gap-2"
                            disabled={isBusy}
                            onClick={() => handleRespond(req.id, 'REJECT')}
                          >
                            <FaTimesCircle size={14} />
                            {isBusy ? 'Processing...' : 'REJECT DONATION'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <DisclaimerAlert />
      </div>
    </div>
  );
};

export default DonorEmergencyRequests;

