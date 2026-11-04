import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { requestService } from '../../services/requestService';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import { FaPlusCircle, FaHospital, FaTrash, FaEye, FaArrowRight, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const MyRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await requestService.getRequests({ requesterId: user?.id });
      if (res && res.data) {
        setRequests(res.data);
      }
    } catch (e) {
      console.error('Failed to load requests:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchRequests();
    }
  }, [user]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this blood request? This action cannot be undone.")) {
      return;
    }
    try {
      await requestService.deleteRequest(id);
      setFeedback("Blood request deleted successfully.");
      fetchRequests();
    } catch (err) {
      alert("Failed to delete request.");
    }
  };

  return (
    <div>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">My Blood Requests</h2>
          <p className="text-muted small mb-0">
            Manage your patient requests, track matched donors, and update transfusion progress.
          </p>
        </div>
        <div className="mt-3 mt-md-0">
          <Link to="/requester/create-request" className="btn btn-blood btn-sm rounded-pill fw-bold d-flex align-items-center gap-1.5 px-3">
            <FaPlusCircle /> New Request
          </Link>
        </div>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show small py-2.5 mb-4" role="alert">
          <FaCheckCircle className="me-2" /> {feedback}
          <button type="button" className="btn-close py-2.5" onClick={() => setFeedback('')} />
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status" />
          <p className="text-muted small mt-2">Loading your requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bc-card p-5 bg-white text-center rounded-3 border">
          <h5 className="fw-bold text-dark">No Requests Found</h5>
          <p className="text-muted small mb-3">You haven't submitted any blood requests yet.</p>
          <Link to="/requester/create-request" className="btn btn-blood btn-sm fw-bold">
            Create Blood Request
          </Link>
        </div>
      ) : (
        <div className="row g-3 mb-4">
          {requests.map((r) => {
            const isEmergency = r.urgency === 'EMERGENCY';
            return (
              <div key={r.id} className="col-lg-6">
                <div className={`bc-card p-4 bg-white h-100 d-flex flex-column ${isEmergency ? 'emergency-card-glow' : ''}`}>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <span className="blood-badge-pill" style={{ width: '44px', height: '44px', fontSize: '1.1rem' }}>
                        {r.bloodGroup}
                      </span>
                      <div>
                        <h5 className="fw-bold text-dark mb-0">{r.patientName}</h5>
                        <small className="text-muted">Required: {r.requiredDate} • {r.unitsRequired} Unit(s)</small>
                      </div>
                    </div>
                    <UrgencyBadge urgency={r.urgency} />
                  </div>

                  <div className="small text-secondary mb-2">
                    <FaHospital className="me-1 text-secondary" />
                    <strong>{r.hospitalName}</strong>, {r.city}{r.state ? `, ${r.state}` : ''}
                  </div>

                  {r.additionalMessage && (
                    <div className="p-2.5 bg-light rounded small text-muted mb-3 border font-italic" style={{ fontSize: '0.825rem' }}>
                      "{r.additionalMessage}"
                    </div>
                  )}

                  <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
                    <StatusBadge status={r.status} />
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger p-1.5"
                        title="Delete Request"
                        onClick={() => handleDelete(r.id)}
                      >
                        <FaTrash size={12} />
                      </button>
                      <Link
                        to={`/requests/${r.id}`}
                        className="btn btn-sm btn-blood fw-bold px-3 d-flex align-items-center gap-1"
                      >
                        View Details & Donors <FaArrowRight size={10} />
                      </Link>
                    </div>
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

export default MyRequests;
