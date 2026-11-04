import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { FaChartBar, FaDownload, FaCheckCircle, FaFilePdf, FaPrint } from 'react-icons/fa';

const ReportsAnalytics = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await adminService.getReports();
        if (res && res.data) {
          setReport(res.data);
        }
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status" />
        <p className="text-muted small mt-2">Generating analytics report...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">Operational Reports & Analytics</h2>
          <p className="text-muted small mb-0">
            Fulfillment velocity, transfusion outcome tracking, and historical performance audit.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm rounded-pill fw-semibold d-flex align-items-center gap-1.5"
          onClick={() => window.print()}
        >
          <FaPrint size={12} /> Print Report
        </button>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="bc-card p-3 bg-white h-100">
            <small className="text-muted fw-bold d-block">Overall Fulfillment Rate</small>
            <h2 className="fw-bold text-success mb-0 mt-1">{report?.fulfillmentRate || 0}%</h2>
            <small className="text-muted" style={{ fontSize: '11px' }}>Requests fulfilled successfully</small>
          </div>
        </div>

        <div className="col-md-3">
          <div className="bc-card p-3 bg-white h-100">
            <small className="text-muted fw-bold d-block">Completed Donations</small>
            <h2 className="fw-bold text-dark mb-0 mt-1">{report?.totalDonations || 0}</h2>
            <small className="text-muted" style={{ fontSize: '11px' }}>Verified transfusion logs</small>
          </div>
        </div>

        <div className="col-md-3">
          <div className="bc-card p-3 bg-white h-100">
            <small className="text-muted fw-bold d-block">Total Requests Handled</small>
            <h2 className="fw-bold text-dark mb-0 mt-1">{report?.totalRequests || 0}</h2>
            <small className="text-muted" style={{ fontSize: '11px' }}>Registered cases</small>
          </div>
        </div>

        <div className="col-md-3">
          <div className="bc-card p-3 bg-white h-100">
            <small className="text-muted fw-bold d-block">Report Timestamp</small>
            <div className="fw-semibold text-dark mt-2 small">
              {new Date(report?.generatedAt || Date.now()).toLocaleString()}
            </div>
            <small className="text-success" style={{ fontSize: '11px' }}>Audit Grade Certified</small>
          </div>
        </div>
      </div>

      <div className="bc-card p-4 bg-white shadow-sm">
        <h5 className="fw-bold text-dark mb-3">Compliance & Quality Control Summary</h5>
        <div className="p-3 bg-light rounded-3 border mb-3 small">
          <p className="mb-2">
            <strong>1. Cold Chain & Clinical Testing:</strong> All recorded donations comply with institutional blood banking guidelines. Crossmatching is performed prior to whole blood or component transfusion.
          </p>
          <p className="mb-2">
            <strong>2. Donor Safety Protocol:</strong> The platform enforces a minimum 90-day whole blood donation hiatus per donor to prevent donor anemia.
          </p>
          <p className="mb-0">
            <strong>3. Emergency Broadcast Velocity:</strong> Emergency cases are distributed within sub-second latencies to local donors within registered metropolitan boundaries.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportsAnalytics;
