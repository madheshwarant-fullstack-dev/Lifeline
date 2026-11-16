import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { useWebSocket } from '../../context/WebSocketContext';
import StatusBadge from '../../components/common/StatusBadge';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import { 
  FaUsers, 
  FaUserCheck, 
  FaHandHoldingHeart, 
  FaClipboardList, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaHospital, 
  FaChartPie, 
  FaChartBar,
  FaArrowRight
} from 'react-icons/fa';

const AdminDashboard = () => {
  const { subscribe } = useWebSocket();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAdminStats = useCallback(async () => {
    try {
      const res = await adminService.getDashboardStats();
      if (res && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminStats();
    const unsubAll = subscribe('*', (payload) => {
      if (
        payload?.event &&
        ['request_created', 'donor_responded', 'request_status_updated', 'donor_availability_updated'].includes(
          payload.event
        )
      ) {
        fetchAdminStats();
      }
    });
    return unsubAll;
  }, [fetchAdminStats, subscribe]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status" />
        <p className="text-muted small mt-2">Compiling platform telemetry and statistics...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const charts = data?.charts || {};
  const recentEmergency = data?.recentEmergency || [];
  const recentUsers = data?.recentUsers || [];

  const bloodGroupDistribution = charts.bloodGroupDistribution || {};
  const urgencyDistribution = charts.urgencyDistribution || {};
  const cityDistribution = charts.cityDistribution || {};

  return (
    <div>
      {/* Top Welcome */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">Administrative Overview</h2>
          <p className="text-muted small mb-0">
            Real-time telemetry, donor network availability, and clinical transfusion workflow metrics.
          </p>
        </div>
        <div className="mt-3 mt-md-0 d-flex gap-2">
          <Link to="/admin/emergency" className="btn btn-danger btn-sm rounded-pill fw-bold d-flex align-items-center gap-1.5 px-3">
            <FaExclamationTriangle /> Review Emergency Queue ({stats.emergencyRequests || 0})
          </Link>
        </div>
      </div>

      {/* 1. SEVEN CORE KPI CARDS */}
      <div className="row g-3 mb-4">
        {/* Total Users */}
        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3 bg-white h-100 d-flex align-items-center justify-content-between">
            <div>
              <small className="text-muted fw-semibold">Total Users</small>
              <h3 className="fw-bold text-dark mb-0 mt-1">{stats.totalUsers || 0}</h3>
              <small className="text-muted" style={{ fontSize: '11px' }}>Platform Accounts</small>
            </div>
            <span className="rounded-circle p-2.5 bg-secondary-subtle text-secondary fs-5">
              <FaUsers />
            </span>
          </div>
        </div>

        {/* Total Donors */}
        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3 bg-white h-100 d-flex align-items-center justify-content-between">
            <div>
              <small className="text-muted fw-semibold">Total Donors</small>
              <h3 className="fw-bold text-danger mb-0 mt-1">{stats.totalDonors || 0}</h3>
              <small className="text-muted" style={{ fontSize: '11px' }}>Registered in registry</small>
            </div>
            <span className="rounded-circle p-2.5 bg-danger-subtle text-danger fs-5">
              <FaUserCheck />
            </span>
          </div>
        </div>

        {/* Available Donors */}
        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3 bg-white h-100 d-flex align-items-center justify-content-between">
            <div>
              <small className="text-muted fw-semibold">Available Donors</small>
              <h3 className="fw-bold text-success mb-0 mt-1">{stats.availableDonors || 0}</h3>
              <small className="text-success fw-semibold" style={{ fontSize: '11px' }}>Ready for dispatch</small>
            </div>
            <span className="rounded-circle p-2.5 bg-success-subtle text-success fs-5">
              <FaHandHoldingHeart />
            </span>
          </div>
        </div>

        {/* Total Blood Requests */}
        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3 bg-white h-100 d-flex align-items-center justify-content-between">
            <div>
              <small className="text-muted fw-semibold">Total Requests</small>
              <h3 className="fw-bold text-dark mb-0 mt-1">{stats.totalRequests || 0}</h3>
              <small className="text-muted" style={{ fontSize: '11px' }}>Created to date</small>
            </div>
            <span className="rounded-circle p-2.5 bg-primary-subtle text-primary fs-5">
              <FaClipboardList />
            </span>
          </div>
        </div>

        {/* Emergency Requests */}
        <div className="col-sm-6 col-lg-4">
          <div className="bc-card emergency-card-glow p-3 h-100 d-flex align-items-center justify-content-between">
            <div>
              <small className="text-danger fw-bold">Emergency Requests</small>
              <h3 className="fw-bold text-danger mb-0 mt-1">{stats.emergencyRequests || 0}</h3>
              <small className="text-danger" style={{ fontSize: '11px' }}>Immediate trauma alerts</small>
            </div>
            <span className="rounded-circle p-2.5 bg-danger text-white fs-5">
              <FaExclamationTriangle />
            </span>
          </div>
        </div>

        {/* Completed Donations */}
        <div className="col-sm-6 col-lg-4">
          <div className="bc-card p-3 bg-white h-100 d-flex align-items-center justify-content-between">
            <div>
              <small className="text-muted fw-semibold">Completed Donations</small>
              <h3 className="fw-bold text-success mb-0 mt-1">{stats.completedDonations || 0}</h3>
              <small className="text-muted" style={{ fontSize: '11px' }}>Transfusions fulfilled</small>
            </div>
            <span className="rounded-circle p-2.5 bg-success-subtle text-success fs-5">
              <FaCheckCircle />
            </span>
          </div>
        </div>

        {/* Registered Hospitals */}
        <div className="col-sm-6 col-lg-4">
          <div className="bc-card p-3 bg-white h-100 d-flex align-items-center justify-content-between">
            <div>
              <small className="text-muted fw-semibold">Registered Hospitals</small>
              <h3 className="fw-bold text-dark mb-0 mt-1">{stats.totalHospitals || 0}</h3>
              <small className="text-muted" style={{ fontSize: '11px' }}>Certified partner centers</small>
            </div>
            <span className="rounded-circle p-2.5 bg-info-subtle text-info fs-5">
              <FaHospital />
            </span>
          </div>
        </div>
      </div>

      {/* 2. ANALYTICS CHARTS CARDS */}
      <div className="row g-3 mb-4">
        {/* Blood Group Distribution Bar / Visual Matrix */}
        <div className="col-lg-5">
          <div className="bc-card p-4 bg-white h-100 shadow-sm">
            <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
              <FaChartBar className="text-danger" /> Blood Group Distribution
            </h5>
            <small className="text-muted d-block mb-3">Count of registered donors by blood type</small>

            <div className="d-flex flex-column gap-2">
              {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => {
                const count = bloodGroupDistribution[bg] || 0;
                const maxVal = Math.max(...Object.values(bloodGroupDistribution), 1);
                const percent = Math.round((count / maxVal) * 100);
                return (
                  <div key={bg} className="d-flex align-items-center gap-2 small">
                    <span className="fw-bold text-dark" style={{ width: '38px' }}>{bg}</span>
                    <div className="progress flex-grow-1" style={{ height: '14px' }}>
                      <div
                        className="progress-bar bg-danger"
                        role="progressbar"
                        style={{ width: `${percent}%` }}
                        aria-valuenow={count}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>
                    <span className="text-muted fw-semibold text-end" style={{ width: '28px' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Emergency vs Normal Breakdown */}
        <div className="col-lg-3">
          <div className="bc-card p-4 bg-white h-100 shadow-sm d-flex flex-column justify-content-between">
            <div>
              <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                <FaChartPie className="text-warning" /> Urgency Breakdown
              </h5>
              <small className="text-muted d-block mb-3">Patient urgency segmentation</small>

              <div className="p-3 bg-light rounded-3 border mb-3">
                <div className="d-flex justify-content-between mb-2">
                  <span className="small fw-semibold text-danger">EMERGENCY</span>
                  <strong className="text-danger">{urgencyDistribution['EMERGENCY'] || 0}</strong>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="small fw-semibold text-warning">HIGH</span>
                  <strong className="text-warning">{urgencyDistribution['HIGH'] || 0}</strong>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="small fw-semibold text-info">NORMAL</span>
                  <strong className="text-info">{urgencyDistribution['NORMAL'] || 0}</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="small fw-semibold text-secondary">LOW</span>
                  <strong className="text-secondary">{urgencyDistribution['LOW'] || 0}</strong>
                </div>
              </div>
            </div>

            <Link to="/admin/requests" className="btn btn-outline-secondary btn-sm w-100">
              Manage All Blood Requests
            </Link>
          </div>
        </div>

        {/* Active Donors by City */}
        <div className="col-lg-4">
          <div className="bc-card p-4 bg-white h-100 shadow-sm">
            <h5 className="fw-bold text-dark mb-1">Top Active Cities (India)</h5>
            <small className="text-muted d-block mb-3">Donor concentration across Indian metropolitan regions</small>

            <ul className="list-group list-group-flush small">
              {Object.entries(cityDistribution).slice(0, 5).map(([city, count]) => (
                <li key={city} className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                  <span className="fw-semibold text-dark">{city}</span>
                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">
                    {count} Donors
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 3. RECENT EMERGENCY REQUESTS AT TOP */}
      <div className="bc-card p-4 bg-white mb-4 shadow-sm border-start border-4 border-danger">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h5 className="fw-bold text-danger mb-0 d-flex align-items-center gap-2">
              <FaExclamationTriangle /> Urgent Emergency Requests Queue
            </h5>
            <small className="text-muted">High priority blood shortages requiring administrator tracking</small>
          </div>
          <Link to="/admin/emergency" className="btn btn-sm btn-outline-danger rounded-pill fw-semibold">
            Emergency Console
          </Link>
        </div>

        {recentEmergency.length === 0 ? (
          <p className="text-muted small mb-0">No active emergency requests in queue.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Patient</th>
                  <th>Blood Group</th>
                  <th>Units</th>
                  <th>Hospital & City</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th className="text-end">Manage</th>
                </tr>
              </thead>
              <tbody>
                {recentEmergency.map((r) => (
                  <tr key={r.id}>
                    <td><strong className="text-dark">{r.patientName}</strong></td>
                    <td><span className="blood-badge-pill" style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}>{r.bloodGroup}</span></td>
                    <td>{r.unitsRequired}</td>
                    <td>{r.hospitalName}, {r.city}{r.state ? `, ${r.state}` : ''}</td>
                    <td>{r.contactNumber}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-end">
                      <Link to={`/requests/${r.id}`} className="btn btn-xs btn-sm btn-danger py-0.5 px-2.5 rounded-pill fw-bold">
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. RECENT USERS */}
      <div className="bc-card p-4 bg-white shadow-sm">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="fw-bold text-dark mb-0">Recent User Registrations</h5>
          <Link to="/admin/users" className="btn btn-sm btn-outline-secondary rounded-pill fw-semibold">
            View All Users
          </Link>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 small">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Blood Group</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge bg-secondary-subtle text-secondary">{u.role}</span>
                  </td>
                  <td>{u.bloodGroup || '—'}</td>
                  <td>{u.city}{u.state ? `, ${u.state}` : ''}</td>
                  <td>
                    <span className={`badge rounded-pill ${u.status === 'ACTIVE' ? 'bg-success' : 'bg-danger'}`}>
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
