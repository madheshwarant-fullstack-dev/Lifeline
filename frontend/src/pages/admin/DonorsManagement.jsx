import React, { useState, useEffect } from 'react';
import { donorService } from '../../services/donorService';
import { adminService } from '../../services/adminService';
import { BLOOD_GROUPS, INDIAN_STATES, getCitiesByState } from '../../utils/constants';
import { FaCheck, FaTimes, FaClock, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const DonorsManagement = () => {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBg, setFilterBg] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchDonors = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterBg) params.bloodGroup = filterBg;
      if (filterState) params.state = filterState;
      if (filterCity) params.city = filterCity;
      if (filterStatus) params.verificationStatus = filterStatus;

      const res = await donorService.getDonors(params);
      if (res && res.data) {
        setDonors(res.data);
      }
    } catch (e) {
      console.error('Failed to load donors:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors();
  }, [filterBg, filterState, filterCity, filterStatus]);

  const handleVerify = async (donorId, status) => {
    try {
      setFeedback('');
      setErrorMsg('');
      await adminService.verifyDonor(donorId, status);
      setFeedback(`Donor status updated to ${status}.`);
      fetchDonors();
    } catch (e) {
      setErrorMsg(e.response?.data?.message || 'Failed to update verification status.');
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredDonors = donors.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.city && d.city.toLowerCase().includes(q)) ||
      (d.state && d.state.toLowerCase().includes(q)) ||
      (d.phone && d.phone.includes(q))
    );
  });

  const totalPages = Math.ceil(filteredDonors.length / itemsPerPage) || 1;
  const paginatedDonors = filteredDonors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">Donor Verification & Registry</h2>
          <p className="text-muted small mb-0">
            Review donor credentials, manage official verification status, and monitor cooldown metrics.
          </p>
        </div>
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

      {/* Filters Bar */}
      <div className="bc-card p-3 bg-white mb-4 shadow-sm border">
        <div className="row g-2 align-items-center">
          <div className="col-md-3">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search donor name, city, phone..."
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

          <div className="col-sm-6 col-md-3">
            <select
              className="form-select form-select-sm"
              value={filterState}
              onChange={(e) => {
                setFilterState(e.target.value);
                setFilterCity('');
                setCurrentPage(1);
              }}
            >
              <option value="">All Indian States</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="col-sm-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={filterCity}
              onChange={(e) => {
                setFilterCity(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Cities</option>
              {(filterState ? getCitiesByState(filterState) : getCitiesByState(null)).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="col-sm-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="VERIFIED">Verified Only</option>
              <option value="PENDING">Pending Review</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Donors Table */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status" />
          <p className="text-muted small mt-2">Loading donors...</p>
        </div>
      ) : filteredDonors.length === 0 ? (
        <div className="bc-card p-5 bg-white text-center rounded-3 border">
          <h5 className="fw-bold text-dark">No Donors Located</h5>
          <p className="text-muted small mb-0">Adjust filters or search query to see more results.</p>
        </div>
      ) : (
        <div className="bc-card bg-white shadow-sm overflow-hidden border">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Donor</th>
                  <th>Blood Group</th>
                  <th>Availability</th>
                  <th>Location</th>
                  <th>Last Donation</th>
                  <th>Total Donations</th>
                  <th>Verification Status</th>
                  <th className="text-end">Verification Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDonors.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong className="text-dark d-block">{d.name}</strong>
                      <span className="text-muted" style={{ fontSize: '11px' }}>{d.email} • {d.phone}</span>
                    </td>
                    <td>
                      <span className="blood-badge-pill" style={{ width: '30px', height: '30px', fontSize: '0.85rem' }}>
                        {d.bloodGroup}
                      </span>
                    </td>
                    <td>
                      <span className={`badge rounded-pill ${d.availability ? 'bg-success' : 'bg-secondary'}`}>
                        {d.availability ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td>
                      <div><strong>{d.city}</strong>{d.state ? `, ${d.state}` : ''}</div>
                      <small className="text-muted">{d.address || '—'}</small>
                    </td>
                    <td>
                      <span className="text-muted">
                        {d.lastDonationDate ? new Date(d.lastDonationDate).toLocaleDateString() : 'Never logged'}
                      </span>
                    </td>
                    <td>
                      <strong>{d.totalDonations || 0}</strong>
                    </td>
                    <td>
                      {d.verificationStatus === 'VERIFIED' ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          Verified
                        </span>
                      ) : d.verificationStatus === 'PENDING' ? (
                        <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                          Pending
                        </span>
                      ) : (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-xs btn-sm btn-success py-1 px-2.5 fw-bold d-flex align-items-center gap-1"
                          onClick={() => handleVerify(d.id, 'VERIFIED')}
                          title="Verify Donor"
                        >
                          <FaCheck size={10} /> Verify
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-sm btn-outline-warning text-dark py-1 px-2"
                          onClick={() => handleVerify(d.id, 'PENDING')}
                          title="Mark Pending"
                        >
                          <FaClock size={10} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-sm btn-outline-danger py-1 px-2"
                          onClick={() => handleVerify(d.id, 'REJECTED')}
                          title="Reject Donor"
                        >
                          <FaTimes size={10} />
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
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredDonors.length)} of {filteredDonors.length} donors
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

export default DonorsManagement;
