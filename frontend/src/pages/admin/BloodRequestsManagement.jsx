import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { requestService } from '../../services/requestService';
import { useWebSocket } from '../../context/WebSocketContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { BLOOD_GROUPS, INDIAN_STATES, URGENCIES, REQUEST_STATUSES } from '../../utils/constants';
import StatusBadge from '../../components/common/StatusBadge';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import { FaTrash, FaEye, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const BloodRequestsManagement = () => {
  const { subscribe } = useWebSocket();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBg, setFilterBg] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterBg) params.bloodGroup = filterBg;
      if (filterState) params.state = filterState;
      if (filterUrgency) params.urgency = filterUrgency;
      if (filterStatus) params.status = filterStatus;

      const res = await adminService.getAdminRequests(params);
      const list = res?.data?.requests || res?.data || [];
      setRequests(list);
    } catch (e) {
      console.error('Failed to load blood requests:', e);
    } finally {
      setLoading(false);
    }
  }, [filterBg, filterState, filterUrgency, filterStatus]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    const u1 = subscribe('request_created', fetchRequests);
    const u2 = subscribe('donor_responded', fetchRequests);
    const u3 = subscribe('request_status_updated', fetchRequests);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [subscribe, fetchRequests]);

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      setFeedback('');
      setErrorMsg('');
      await requestService.patchRequestStatus(requestId, newStatus);
      setFeedback(`Status updated to ${newStatus}.`);
      fetchRequests();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleDelete = (id) => {
    setDeleteTargetId(id);
  };

  const executeDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await requestService.deleteRequest(deleteTargetId);
      setFeedback('Blood request removed.');
      setDeleteTargetId(null);
      fetchRequests();
    } catch (e) {
      setErrorMsg(e.response?.data?.detail || e.response?.data?.message || 'Failed to delete request.');
      setDeleteTargetId(null);
    } finally {
      setDeleting(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search filter
  const filteredRequests = requests.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.patientName && r.patientName.toLowerCase().includes(q)) ||
      (r.hospitalName && r.hospitalName.toLowerCase().includes(q)) ||
      (r.city && r.city.toLowerCase().includes(q)) ||
      (r.requesterName && r.requesterName.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage) || 1;
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">Blood Requests Management</h2>
          <p className="text-muted small mb-0">
            Monitor all incoming hospital and patient requests, update transfusion workflows, and manage requests.
          </p>
        </div>
        <Link to="/requester/create-request" className="btn btn-blood btn-sm fw-bold rounded-pill">
          + Create Blood Request
        </Link>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show small py-2.5 mb-4" role="alert">
          <FaCheckCircle className="me-2" /> {feedback}
          <button type="button" className="btn-close py-2.5" onClick={() => setFeedback('')} />
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show small py-2.5 mb-4" role="alert">
          <FaExclamationCircle className="me-2" /> {errorMsg}
          <button type="button" className="btn-close py-2.5" onClick={() => setErrorMsg('')} />
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="bc-card p-3 bg-white mb-4 shadow-sm border">
        <div className="row g-2 align-items-center">
          <div className="col-md-3">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search patient, hospital, city..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="col-sm-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={filterBg}
              onChange={(e) => {
                setFilterBg(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Blood Groups</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <div className="col-sm-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={filterState}
              onChange={(e) => {
                setFilterState(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All States</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="col-sm-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={filterUrgency}
              onChange={(e) => {
                setFilterUrgency(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Urgencies</option>
              {URGENCIES.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          <div className="col-sm-6 col-md-3">
            <select
              className="form-select form-select-sm"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Statuses</option>
              {REQUEST_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label} ({s.key})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status" />
          <p className="text-muted small mt-2">Loading requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bc-card p-5 bg-white text-center rounded-3 border">
          <h5 className="fw-bold text-dark">No Requests Found</h5>
          <p className="text-muted small mb-0">Adjust filters or search query to broaden your results.</p>
        </div>
      ) : (
        <div className="bc-card bg-white shadow-sm overflow-hidden border">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Patient</th>
                  <th>Blood Group</th>
                  <th>Units</th>
                  <th>Hospital & City</th>
                  <th>Date Needed</th>
                  <th>Urgency</th>
                  <th>Current Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong className="text-dark d-block">{r.patientName}</strong>
                      <span className="text-muted" style={{ fontSize: '11px' }}>Req by: {r.requesterName}</span>
                    </td>
                    <td>
                      <span className="blood-badge-pill" style={{ width: '30px', height: '30px', fontSize: '0.85rem' }}>
                        {r.bloodGroup}
                      </span>
                    </td>
                    <td><strong>{r.unitsRequired}</strong></td>
                    <td>
                      <div className="fw-semibold">{r.hospitalName}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>{r.city}{r.state ? `, ${r.state}` : ''}</div>
                    </td>
                    <td>{r.requiredDate}</td>
                    <td><UrgencyBadge urgency={r.urgency} /></td>
                    <td>
                      <select
                        className="form-select form-select-sm py-0 px-2"
                        style={{ fontSize: '12px', width: 'auto' }}
                        value={r.status}
                        onChange={(e) => handleStatusChange(r.id, e.target.value)}
                      >
                        {REQUEST_STATUSES.map((s) => (
                          <option key={s.key} value={s.key}>{s.key}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1.5">
                        <Link to={`/requests/${r.id}`} className="btn btn-xs btn-sm btn-outline-primary p-1.5" title="View Details & Matches">
                          <FaEye size={12} />
                        </Link>
                        <button
                          type="button"
                          className="btn btn-xs btn-sm btn-outline-danger p-1.5"
                          title="Delete Request"
                          onClick={() => handleDelete(r.id)}
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center p-3 border-top bg-light small">
              <span className="text-muted">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length} requests
              </span>
              <div className="d-flex gap-1">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-2.5 py-1"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  &larr; Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    className={`btn btn-sm px-2.5 py-1 ${currentPage === pg ? 'btn-danger fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setCurrentPage(pg)}
                  >
                    {pg}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-2.5 py-1"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        variant="danger"
        title="Permanently Delete Blood Request?"
        message="Are you sure you want to remove this blood request record? Associated tracking invitations will also be cleared."
        confirmLabel="Delete Request"
        loading={deleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};

export default BloodRequestsManagement;
