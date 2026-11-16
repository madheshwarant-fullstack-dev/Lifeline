import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { BLOOD_GROUPS } from '../../utils/constants';
import { FaSearch, FaBan, FaCheck, FaTrash, FaCheckCircle, FaExclamationCircle, FaShieldAlt } from 'react-icons/fa';

const UsersManagement = ({ initialRole = '' }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(initialRole);
  const [bgFilter, setBgFilter] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setRoleFilter(initialRole);
  }, [initialRole]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (bgFilter) params.bloodGroup = bgFilter;

      const res = await adminService.getUsers(params);
      if (res && res.data) {
        setUsers(res.data);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchUsers();
    setCurrentPage(1);
  }, [roleFilter, bgFilter]);

  const totalPages = Math.ceil(users.length / itemsPerPage) || 1;
  const paginatedUsers = users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    try {
      setFeedback('');
      setErrorMsg('');
      await adminService.updateUserStatus(user.id, newStatus);
      setFeedback(`User ${user.name} is now ${newStatus}.`);
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Status update failed.');
    }
  };

  const handleVerifyHospital = async (user) => {
    const newVerification = !user.isVerified;
    try {
      setFeedback('');
      setErrorMsg('');
      await adminService.verifyHospital(user.id, newVerification);
      setFeedback(`Hospital "${user.name}" is now ${newVerification ? 'Verified' : 'Unverified'}.`);
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Verification update failed.');
    }
  };

  const handleDeleteUser = (user) => {
    setDeleteTargetUser(user);
  };

  const executeDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setDeleting(true);
    try {
      setFeedback('');
      setErrorMsg('');
      await adminService.deleteUser(deleteTargetUser.id);
      setFeedback(`Account for ${deleteTargetUser.name} was deleted successfully.`);
      setDeleteTargetUser(null);
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.response?.data?.message || 'Failed to delete account.');
      setDeleteTargetUser(null);
    } finally {
      setDeleting(false);
    }
  };

  const isHospitalView = initialRole === 'HOSPITAL';

  return (
    <div>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">
            {isHospitalView ? 'Hospital & Partner Centers Management' : 'User Account Management'}
          </h2>
          <p className="text-muted small mb-0">
            {isHospitalView 
              ? 'Manage verified clinical hospital coordinators, transfusion banks, and institutional accounts.'
              : 'Control user access privileges, account statuses, and system roles across the platform.'}
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

      {/* Filter and Search Bar */}
      <div className="bc-card p-3 bg-white mb-4 shadow-sm">
        <form onSubmit={handleSearchSubmit}>
          <div className="row g-2 align-items-center">
            <div className="col-md-4">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light text-muted">
                  <FaSearch size={12} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search name, email, city, state..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="col-md-3">
              <select
                className="form-select form-select-sm"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="DONOR">DONOR</option>
                <option value="REQUESTER">REQUESTER</option>
                <option value="HOSPITAL">HOSPITAL</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div className="col-md-3">
              <select
                className="form-select form-select-sm"
                value={bgFilter}
                onChange={(e) => setBgFilter(e.target.value)}
              >
                <option value="">All Blood Groups</option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <button type="submit" className="btn btn-danger btn-sm w-100 fw-bold">
                Search
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status" />
          <p className="text-muted small mt-2">Loading user accounts...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="bc-card p-5 bg-white text-center rounded-3 border">
          <h5 className="fw-bold text-dark">No Users Matching Criteria</h5>
          <p className="text-muted small mb-0">Try clearing the search query or changing role filters.</p>
        </div>
      ) : (
        <div className="bc-card bg-white shadow-sm overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>User Details</th>
                  <th>Role</th>
                  <th>Blood Group</th>
                  <th>Contact Info</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong className="text-dark d-block">{u.name}</strong>
                      <span className="text-muted" style={{ fontSize: '11px' }}>Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                      {u.role === 'HOSPITAL' && (
                        <div className="mt-1 d-flex align-items-center gap-1">
                          {u.isVerified ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5" style={{ fontSize: '10px' }}>
                              <FaShieldAlt className="me-1" /> Verified Partner
                            </span>
                          ) : (
                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-2 py-0.5" style={{ fontSize: '10px' }}>
                              <FaShieldAlt className="me-1" /> Unverified
                            </span>
                          )}
                          {u.registrationNumber && (
                            <span className="text-muted font-monospace" style={{ fontSize: '10px' }}>
                              ({u.registrationNumber})
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge bg-secondary-subtle text-secondary">{u.role}</span>
                    </td>
                    <td>
                      {u.bloodGroup ? (
                        <span className="blood-badge-pill" style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}>
                          {u.bloodGroup}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <div>{u.email}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>{u.phone}</div>
                    </td>
                    <td>
                      <div><strong>{u.city}</strong>{u.state ? `, ${u.state}` : ''}</div>
                      <small className="text-muted text-truncate d-block" style={{ maxWidth: '140px' }}>{u.address}</small>
                    </td>
                    <td>
                      <span className={`badge rounded-pill ${u.status === 'ACTIVE' ? 'bg-success' : 'bg-danger'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1.5">
                        {u.role === 'HOSPITAL' && (
                          <button
                            type="button"
                            className={`btn btn-xs btn-sm py-1 px-2.5 rounded-pill fw-bold ${u.isVerified ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                            onClick={() => handleVerifyHospital(u)}
                            title={u.isVerified ? 'Revoke Hospital Verification' : 'Verify Hospital Account'}
                          >
                            <FaShieldAlt size={10} className="me-1" />
                            {u.isVerified ? 'Unverify' : 'Verify'}
                          </button>
                        )}

                        <button
                          type="button"
                          className={`btn btn-xs btn-sm py-1 px-2.5 rounded-pill fw-bold ${u.status === 'ACTIVE' ? 'btn-outline-warning text-dark' : 'btn-outline-success'}`}
                          onClick={() => handleToggleStatus(u)}
                          title={u.status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
                        >
                          {u.status === 'ACTIVE' ? <><FaBan size={10} /> Block</> : <><FaCheck size={10} /> Unblock</>}
                        </button>

                        {u.role !== 'ADMIN' && (
                          <button
                            type="button"
                            className="btn btn-xs btn-sm btn-outline-danger p-1.5"
                            onClick={() => handleDeleteUser(u)}
                            title="Delete Permanently"
                          >
                            <FaTrash size={11} />
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
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, users.length)} of {users.length} users
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
        open={Boolean(deleteTargetUser)}
        variant="danger"
        title="Permanently Delete User Account?"
        message={`Delete "${deleteTargetUser?.name}" (${deleteTargetUser?.email})? This removes all associated user and profile data.`}
        confirmLabel="Delete Account"
        loading={deleting}
        onConfirm={executeDeleteUser}
        onCancel={() => setDeleteTargetUser(null)}
      />
    </div>
  );
};

export default UsersManagement;
