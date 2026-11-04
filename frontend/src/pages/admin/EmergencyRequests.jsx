import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { requestService } from '../../services/requestService';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import StatusBadge from '../../components/common/StatusBadge';
import { FaExclamationTriangle, FaHospital, FaPhoneAlt, FaMapMarkerAlt, FaCalendarAlt, FaArrowRight, FaClock } from 'react-icons/fa';

const EmergencyRequests = () => {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmergencies = async () => {
      try {
        const res = await requestService.getRequests({ urgency: 'EMERGENCY' });
        if (res && res.data) {
          setEmergencies(res.data);
        }
      } catch (err) {
        console.error('Failed to load emergency queue:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmergencies();
  }, []);

  const getTimeAgo = (dateStr) => {
    try {
      const created = new Date(dateStr);
      const diffMs = Date.now() - created.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hours ago`;
      return `${Math.floor(diffHours / 24)} days ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="p-1.5 bg-danger text-white rounded-circle d-inline-flex fs-6">
              <FaExclamationTriangle />
            </span>
            <h2 className="fw-bold mb-0 text-danger">Emergency Blood Shortage Queue</h2>
          </div>
          <p className="text-muted small mb-0">
            High-urgency trauma and surgical cases with active broadcast alerts dispatched to compatible donors.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status" />
          <p className="text-muted small mt-2">Checking active emergency network...</p>
        </div>
      ) : emergencies.length === 0 ? (
        <div className="bc-card p-5 bg-white text-center rounded-3 border">
          <FaClock className="text-success mb-3" size={36} />
          <h5 className="fw-bold text-dark">No Active Emergency Requests</h5>
          <p className="text-muted small mb-0">All acute emergency blood requests are fulfilled or none are currently active.</p>
        </div>
      ) : (
        <div className="row g-3">
          {emergencies.map((req) => (
            <div key={req.id} className="col-lg-6">
              <div className="bc-card emergency-card-glow p-4 h-100 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div className="d-flex align-items-center gap-2.5">
                    <span className="blood-badge-pill" style={{ width: '48px', height: '48px', fontSize: '1.25rem' }}>
                      {req.bloodGroup}
                    </span>
                    <div>
                      <h4 className="fw-bold text-dark mb-0">{req.patientName}</h4>
                      <small className="text-danger fw-bold d-flex align-items-center gap-1">
                        <FaClock size={11} /> Registered: {getTimeAgo(req.createdAt)}
                      </small>
                    </div>
                  </div>
                  <UrgencyBadge urgency={req.urgency} />
                </div>

                <div className="row g-2 p-2.5 bg-white bg-opacity-75 rounded-3 border mb-3 small">
                  <div className="col-6">
                    <span className="text-muted d-block" style={{ fontSize: '11px' }}>Hospital:</span>
                    <strong className="text-dark d-flex align-items-center gap-1">
                      <FaHospital className="text-secondary" /> {req.hospitalName}
                    </strong>
                  </div>
                  <div className="col-6">
                    <span className="text-muted d-block" style={{ fontSize: '11px' }}>Location / State:</span>
                    <strong className="text-dark d-flex align-items-center gap-1">
                      <FaMapMarkerAlt className="text-danger" /> {req.city}{req.state ? `, ${req.state}` : ''}
                    </strong>
                  </div>
                  <div className="col-6">
                    <span className="text-muted d-block" style={{ fontSize: '11px' }}>Units Required:</span>
                    <strong className="text-danger">{req.unitsRequired} Unit(s)</strong>
                  </div>
                  <div className="col-6">
                    <span className="text-muted d-block" style={{ fontSize: '11px' }}>Target Date:</span>
                    <strong className="text-dark">{req.requiredDate}</strong>
                  </div>
                  <div className="col-12 mt-1 pt-1 border-top">
                    <span className="text-muted d-block" style={{ fontSize: '11px' }}>Direct Phone:</span>
                    <strong className="text-dark d-flex align-items-center gap-1">
                      <FaPhoneAlt className="text-secondary" /> {req.contactNumber}
                    </strong>
                  </div>
                </div>

                {req.additionalMessage && (
                  <div className="p-2.5 bg-white rounded border small text-secondary mb-3 font-italic" style={{ fontSize: '0.8rem' }}>
                    "{req.additionalMessage}"
                  </div>
                )}

                <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
                  <StatusBadge status={req.status} />
                  <Link
                    to={`/requests/${req.id}`}
                    className="btn btn-sm btn-danger fw-bold px-3 d-flex align-items-center gap-1.5"
                  >
                    Triage & Donors <FaArrowRight size={10} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmergencyRequests;
