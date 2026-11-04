import React, { useState, useEffect } from 'react';
import { donationService } from '../../services/donationService';
import { BLOOD_GROUPS } from '../../utils/constants';
import { FaHandHoldingMedical, FaCheck, FaTimes, FaCalendarAlt, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const DonationsManagement = () => {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBg, setFilterBg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [feedback, setFeedback] = useState('');

  const fetchDonations = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterBg) params.bloodGroup = filterBg;
      if (filterStatus) params.status = filterStatus;

      const res = await donationService.getDonations(params);
      if (res && res.data) {
        setDonations(res.data);
      }
    } catch (e) {
      console.error('Failed to load donations:', e);
    } finally {
      setLoading(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchDonations();
    setCurrentPage(1);
  }, [filterBg, filterStatus]);

  const totalPages = Math.ceil(donations.length / itemsPerPage) || 1;
  const paginatedDonations = donations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleUpdateStatus = async (id, status) => {
    try {
      setFeedback('');
      await donationService.updateDonation(id, status);
      setFeedback(`Donation record updated to ${status}.`);
      fetchDonations();
    } catch (e) {
      alert("Failed to update donation status.");
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">Blood Donations Registry</h2>
          <p className="text-muted small mb-0">
            Audit, verify, and complete hospital transfusion sign-off records across the platform.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show small py-2.5 mb-4" role="alert">
          <FaCheckCircle className="me-2" /> {feedback}
          <button type="button" className="btn-close py-2.5" onClick={() => setFeedback('')} />
        </div>
      )}

      {/* Filter Bar */}
      <div className="bc-card p-3 bg-white mb-4 shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-md-6">
            <select
              className="form-select form-select-sm"
              value={filterBg}
              onChange={(e) => setFilterBg(e.target.value)}
            >
              <option value="">All Blood Groups</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <select
              className="form-select form-select-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status" />
          <p className="text-muted small mt-2">Loading donation logs...</p>
        </div>
      ) : donations.length === 0 ? (
        <div className="bc-card p-5 bg-white text-center rounded-3 border">
          <h5 className="fw-bold text-dark">No Donation Records Found</h5>
          <p className="text-muted small mb-0">No records matching the selected status or blood group.</p>
        </div>
      ) : (
        <div className="bc-card bg-white shadow-sm overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Donation ID</th>
                  <th>Donor</th>
                  <th>Blood Group</th>
                  <th>Hospital & City</th>
                  <th>Units</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDonations.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong className="text-danger">{d.donationId}</strong>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">{d.donorName}</div>
                      <small className="text-muted">{d.donorEmail || d.donorPhone}</small>
                    </td>
                    <td>
                      <span className="blood-badge-pill" style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}>
                        {d.bloodGroup}
                      </span>
                    </td>
                    <td>
                      <div>{d.hospitalName}</div>
                      <small className="text-muted">{d.city}</small>
                    </td>
                    <td><strong>{d.units || 1}</strong></td>
                    <td>{new Date(d.donationDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge rounded-pill ${d.status === 'COMPLETED' ? 'bg-success' : d.status === 'SCHEDULED' ? 'bg-warning text-dark' : 'bg-dark'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        {d.status !== 'COMPLETED' && (
                          <button
                            type="button"
                            className="btn btn-xs btn-sm btn-success py-1 px-2.5 fw-bold d-flex align-items-center gap-1"
                            onClick={() => handleUpdateStatus(d.id, 'COMPLETED')}
                            title="Mark Completed"
                          >
                            <FaCheck size={10} /> Complete
                          </button>
                        )}
                        {d.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            className="btn btn-xs btn-sm btn-outline-danger py-1 px-2"
                            onClick={() => handleUpdateStatus(d.id, 'CANCELLED')}
                            title="Cancel"
                          >
                            <FaTimes size={10} />
                          </button>
                        )}
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
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, donations.length)} of {donations.length} records
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
    </div>
  );
};

export default DonationsManagement;
