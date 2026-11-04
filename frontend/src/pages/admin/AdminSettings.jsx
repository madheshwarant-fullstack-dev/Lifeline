import React from 'react';
import { FaCogs, FaDatabase, FaKey, FaEnvelope, FaServer, FaCheckCircle } from 'react-icons/fa';

const AdminSettings = () => {
  return (
    <div>
      <div className="mb-4 pb-2 border-bottom">
        <h2 className="fw-bold mb-1">Platform Settings & Environment</h2>
        <p className="text-muted small mb-0">
          Backend server configuration, database connections, and security telemetry.
        </p>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="bc-card p-4 bg-white h-100 shadow-sm">
            <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <FaDatabase className="text-danger" /> Database Configuration
            </h5>
            <ul className="list-group list-group-flush small">
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">Database Engine:</span>
                <strong className="text-dark">MongoDB Community Server</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">Database Name:</span>
                <strong className="text-dark">bloodconnect</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">Connection Status:</span>
                <span className="badge bg-success-subtle text-success border border-success-subtle">
                  Connected & Active
                </span>
              </li>
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">Indexed Collections:</span>
                <strong className="text-dark">users, donors, blood_requests, donations, hospitals</strong>
              </li>
            </ul>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="bc-card p-4 bg-white h-100 shadow-sm">
            <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <FaKey className="text-warning" /> Security & JWT
            </h5>
            <ul className="list-group list-group-flush small">
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">Hashing Algorithm:</span>
                <strong className="text-dark">bcrypt (Salt rounds: 12)</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">JWT Algorithm:</span>
                <strong className="text-dark">HMAC-SHA256 (HS256)</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">Token Lifespan:</span>
                <strong className="text-dark">86,400 seconds (24 Hours)</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">Role-Based Access:</span>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                  Enforced on Frontend & API
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="bc-card p-4 bg-white h-100 shadow-sm">
            <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <FaEnvelope className="text-info" /> Email Notification Subsystem
            </h5>
            <p className="text-muted small mb-3">
              SMTP transmission mode with resilient fallback logging in development environments.
            </p>
            <ul className="list-group list-group-flush small">
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">SMTP Protocol:</span>
                <strong className="text-dark">TLS via Port 587</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">Development Mode:</span>
                <span className="badge bg-success-subtle text-success">
                  Safe Console Logging Active
                </span>
              </li>
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">Automated Triggers:</span>
                <strong className="text-dark">Registration, Emergency Alert, Verification, Acceptance</strong>
              </li>
            </ul>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="bc-card p-4 bg-white h-100 shadow-sm">
            <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <FaServer className="text-secondary" /> Microservice Architecture
            </h5>
            <ul className="list-group list-group-flush small">
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">Backend Service:</span>
                <strong className="text-dark">Python Flask 3.1 REST API</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">Frontend Service:</span>
                <strong className="text-dark">React 19 + Bootstrap 5 + Vite</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between px-0 py-2.5">
                <span className="text-muted">CORS Policy:</span>
                <strong className="text-dark">Enabled for Client Application</strong>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
