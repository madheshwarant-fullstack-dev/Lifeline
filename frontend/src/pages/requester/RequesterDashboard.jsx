import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { requestService } from '../../services/requestService';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import { 
  FaPlusCircle, 
  FaClipboardList, 
  FaCheckCircle, 
  FaHourglassHalf, 
  FaUsers, 
  FaHospital, 
  FaArrowRight,
  FaShieldAlt,
  FaSearch,
  FaLock
} from 'react-icons/fa';

const RequesterDashboard = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const isHospital = user?.role === 'HOSPITAL';
  const hospitalProfile = user?.hospitalProfile || {};
  const isVerified = isHospital ? (hospitalProfile.isVerified !== false) : true;

  const fetchMyRequests = async () => {
    try {
      const res = await requestService.getRequests({ requesterId: user?.id });
      if (res && res.data) {
        setRequests(res.data);
      }
    } catch (e) {
      console.error('Failed to load requester requests:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchMyRequests();
    }
  }, [user]);

  // Metrics
  const openCount = requests.filter(r => ['OPEN', 'PENDING', 'MATCHED'].includes(r.status)).length;
  const coordinationCount = requests.filter(r => ['ACCEPTED', 'SCREENING_SUBMITTED', 'SCHEDULED'].includes(r.status)).length;
  const completedCount = requests.filter(r => ['DONATION_COMPLETED', 'FULFILLED', 'CLOSED'].includes(r.status)).length;
  const emergencyCount = requests.filter(r => r.urgency === 'EMERGENCY').length;

  // Filtered list
  const filteredRequests = requests.filter(r => {
    if (statusFilter === 'OPEN' && !['OPEN', 'PENDING', 'MATCHED'].includes(r.status)) return false;
    if (statusFilter === 'COORDINATION' && !['ACCEPTED', 'SCREENING_SUBMITTED', 'SCHEDULED'].includes(r.status)) return false;
    if (statusFilter === 'FULFILLED' && !['DONATION_COMPLETED', 'FULFILLED', 'CLOSED'].includes(r.status)) return false;
    if (statusFilter === 'CANCELLED' && !['CANCELLED', 'EXPIRED'].includes(r.status)) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const patientMatch = (r.patientName || '').toLowerCase().includes(q);
      const bgMatch = (r.bloodGroup || '').toLowerCase().includes(q);
      const cityMatch = (r.city || '').toLowerCase().includes(q);
      const hospMatch = (r.hospitalName || '').toLowerCase().includes(q);
      return patientMatch || bgMatch || cityMatch || hospMatch;
    }
    return true;
  });

  return (
    <div>
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h2 className="fw-bold mb-0 text-dark">
              {isHospital ? 'Hospital Transfusion Dashboard' : 'Requester Dashboard'}
            </h2>
            {isHospital && (
              isVerified ? (
                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1 small fw-bold">
                  <FaShieldAlt className="me-1" /> Verified Partner
                </span>
              ) : (
                <span className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-2.5 py-1 small fw-bold">
                  <FaShieldAlt className="me-1" /> Verification Pending
                </span>
              )
            )}
          </div>
          <p className="text-muted small mb-0">
            Welcome, <strong className="text-dark">{user?.name}</strong>. Monitor your hospital blood requests, donor matches, and screening status.
          </p>
        </div>
        <div className="mt-3 mt-md-0">
          <Link to="/requester/create-request" className="btn btn-blood btn-sm rounded-pill fw-bold shadow-sm d-flex align-items-center gap-1.5 px-3.5">
            <FaPlusCircle /> Create Blood Request
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3 bg-white h-100 d-flex align-items-center justify-content-between border rounded-3 shadow-sm">
            <div>
              <small className="text-muted fw-semibold d-block">Open / Matching</small>
              <h3 className="fw-bold text-dark mb-0 mt-1">{openCount}</h3>
              <small className="text-muted" style={{ fontSize: '11px' }}>Seeking donors</small>
            </div>
            <span className="rounded-circle p-2.5 bg-danger-subtle text-danger fs-5">
              <FaHourglassHalf />
            </span>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3 bg-white h-100 d-flex align-items-center justify-content-between border rounded-3 shadow-sm">
            <div>
              <small className="text-muted fw-semibold d-block">In Coordination</small>
              <h3 className="fw-bold text-primary mb-0 mt-1">{coordinationCount}</h3>
              <small className="text-primary fw-semibold" style={{ fontSize: '11px' }}>Screening & Scheduling</small>
            </div>
            <span className="rounded-circle p-2.5 bg-primary-subtle text-primary fs-5">
              <FaUsers />
            </span>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3 bg-white h-100 d-flex align-items-center justify-content-between border rounded-3 shadow-sm">
            <div>
              <small className="text-muted fw-semibold d-block">Completed</small>
              <h3 className="fw-bold text-success mb-0 mt-1">{completedCount}</h3>
              <small className="text-muted" style={{ fontSize: '11px' }}>Fulfilled donations</small>
            </div>
            <span className="rounded-circle p-2.5 bg-success-subtle text-success fs-5">
              <FaCheckCircle />
            </span>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3 bg-white h-100 d-flex align-items-center justify-content-between border rounded-3 shadow-sm">
            <div>
              <small className="text-muted fw-semibold d-block">Emergency Priority</small>
              <h3 className="fw-bold text-danger mb-0 mt-1">{emergencyCount}</h3>
              <small className="text-danger fw-semibold" style={{ fontSize: '11px' }}>Critical flags</small>
            </div>
            <span className="rounded-circle p-2.5 bg-danger text-white fs-5">
              <FaClipboardList />
            </span>
          </div>
        </div>
      </div>

      {/* Requests Management Table Card */}
      <div className="bc-card p-4 bg-white mb-4 shadow-sm border rounded-3">
        {/* Controls: Search & Status Tabs */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3 pb-3 border-bottom">
          <div className="d-flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: 'All Requests' },
              { id: 'OPEN', label: 'Open' },
              { id: 'COORDINATION', label: 'In Coordination' },
              { id: 'FULFILLED', label: 'Fulfilled' },
              { id: 'CANCELLED', label: 'Cancelled' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${statusFilter === tab.id ? 'btn-danger fw-bold' : 'btn-outline-secondary'}`}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="input-group input-group-sm" style={{ maxWidth: '280px' }}>
            <span className="input-group-text bg-light border-end-0">
              <FaSearch size={12} className="text-muted" />
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Search patient, blood group, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Confidentiality Notice */}
        <div className="p-2.5 px-3 bg-light rounded-2 border mb-3 small d-flex align-items-center gap-2 text-secondary">
          <FaLock className="text-muted flex-shrink-0" size={12} />
          <span>
            <strong>Data Privacy:</strong> Authorized hospital coordinators can track donor responses and medical clearance statuses. Raw personal health screening questionnaires are strictly restricted.
          </span>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-danger spinner-border-sm" role="status" />
            <p className="text-muted small mt-2">Loading hospital requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-5 bg-light rounded-3 border">
            <h6 className="fw-bold text-dark mb-1">No Blood Requests Found</h6>
            <p className="text-muted small mb-3">
              {statusFilter !== 'ALL' 
                ? `No requests matching status '${statusFilter}'.` 
                : 'No blood requests have been registered yet.'}
            </p>
            <Link to="/requester/create-request" className="btn btn-blood btn-sm fw-bold">
              Submit Blood Request
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small">
                <tr>
                  <th>Patient</th>
                  <th>Blood Group</th>
                  <th>Units</th>
                  <th>Hospital & City</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody className="small">
                {filteredRequests.map((r) => (
                  <tr key={r.id || r._id}>
                    <td>
                      <strong className="text-dark d-block">{r.patientName}</strong>
                      <span className="text-muted" style={{ fontSize: '11px' }}>Required: {r.requiredDate}</span>
                    </td>
                    <td>
                      <span className="blood-badge-pill" style={{ width: '34px', height: '34px', fontSize: '0.85rem' }}>
                        {r.bloodGroup}
                      </span>
                    </td>
                    <td><strong className="text-dark">{r.unitsRequired}</strong> unit(s)</td>
                    <td>
                      <div className="text-dark fw-semibold">{r.hospitalName}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>{r.city}{r.state ? `, ${r.state}` : ''}</div>
                    </td>
                    <td><UrgencyBadge urgency={r.urgency} /></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-end">
                      <Link to={`/requests/${r.id || r._id}`} className="btn btn-sm btn-outline-danger rounded-pill fw-bold px-2.5 py-1">
                        Live Radar &amp; Donors <FaArrowRight size={10} className="ms-1" />
                      </Link>
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

export default RequesterDashboard;
