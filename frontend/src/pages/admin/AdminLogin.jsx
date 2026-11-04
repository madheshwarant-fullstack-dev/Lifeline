import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaShieldAlt, FaLock, FaEnvelope, FaSignInAlt, FaExclamationCircle } from 'react-icons/fa';

const AdminLogin = () => {
  const [email, setEmail] = useState('admin@bloodconnect.org');
  const [password, setPassword] = useState('AdminPassword123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login({ email, password });
      if (user.role !== 'ADMIN') {
        setError('Access denied: This account does not possess administrator credentials.');
        return;
      }
      navigate('/admin');
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the backend server. Please make sure the backend is running on http://localhost:5000.');
      } else {
        setError(err.response?.data?.message || 'Invalid administrator credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-5 bg-dark min-vh-100 d-flex align-items-center">
      <div className="container" style={{ maxWidth: '440px' }}>
        <div className="text-center mb-4">
          <div className="d-inline-flex p-3 bg-danger rounded-circle text-white mb-2 shadow">
            <FaShieldAlt size={32} />
          </div>
          <h3 className="fw-bold text-white mb-1">Lifeline Administration</h3>
          <p className="text-light text-opacity-50 small">Authorized personnel & clinical oversight login</p>
        </div>

        <div className="bc-card p-4 p-sm-5 bg-white shadow-lg border-0">
          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 small py-2 mb-3" role="alert">
              <FaExclamationCircle className="flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleAdminLogin}>
            <div className="mb-3">
              <label className="form-label small fw-bold text-secondary">Admin Email</label>
              <div className="input-group">
                <span className="input-group-text bg-light text-muted border-end-0">
                  <FaEnvelope size={13} />
                </span>
                <input
                  type="email"
                  className="form-control border-start-0"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold text-secondary">Password</label>
              <div className="input-group">
                <span className="input-group-text bg-light text-muted border-end-0">
                  <FaLock size={13} />
                </span>
                <input
                  type="password"
                  className="form-control border-start-0"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-danger w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : <><FaSignInAlt /> Enter Admin Console</>}
            </button>
          </form>

          <div className="mt-4 pt-3 border-top text-center">
            <small className="text-muted d-block mb-1">Default Pre-seeded Superadmin:</small>
            <code className="text-danger small bg-light p-1 rounded">admin@bloodconnect.org / AdminPassword123!</code>
          </div>
        </div>

        <div className="text-center mt-3">
          <Link to="/" className="text-light text-opacity-50 small text-decoration-none">
            &larr; Return to Public Portal
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
