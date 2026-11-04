import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaTint, FaLock, FaEnvelope, FaSignInAlt, FaExclamationCircle } from 'react-icons/fa';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login({ email, password });
      
      const destination = location.state?.from?.pathname;
      if (destination) {
        navigate(destination, { replace: true });
      } else {
        if (user.role === 'ADMIN') navigate('/admin');
        else if (user.role === 'DONOR') navigate('/donor/dashboard');
        else navigate('/requester/dashboard');
      }
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the backend server. Please make sure the backend is running on http://localhost:5000.');
      } else {
        const msg = err.response?.data?.message || 'Invalid email or password. Please verify your credentials.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail, demoPw) => {
    setEmail(demoEmail);
    setPassword(demoPw);
    setError('');
  };

  return (
    <div className="py-5 bg-light min-vh-100 d-flex align-items-center">
      <div className="container" style={{ maxWidth: '480px' }}>
        <div className="text-center mb-4">
          <Link to="/" className="d-inline-flex align-items-center gap-2 text-decoration-none mb-2">
            <span className="brand-logo-badge">
              <FaTint />
            </span>
            <span className="fw-bolder fs-3 text-dark">
              Life<span className="text-danger">Line</span>
            </span>
          </Link>
          <h4 className="fw-bold text-dark">Welcome Back</h4>
          <p className="text-muted small">Sign in to your account to manage blood requests & donations</p>
        </div>

        <div className="bc-card p-4 p-sm-5 bg-white shadow-sm">
          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 small py-2.5 mb-3" role="alert">
              <FaExclamationCircle className="flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label small fw-bold text-secondary">Email Address</label>
              <div className="input-group">
                <span className="input-group-text bg-light text-muted border-end-0">
                  <FaEnvelope size={14} />
                </span>
                <input
                  type="email"
                  className="form-control border-start-0"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label small fw-bold text-secondary mb-0">Password</label>
              </div>
              <div className="input-group">
                <span className="input-group-text bg-light text-muted border-end-0">
                  <FaLock size={14} />
                </span>
                <input
                  type="password"
                  className="form-control border-start-0"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-blood w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <FaSignInAlt /> Sign In
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials for Reviewers & Testing */}
          <div className="mt-4 pt-3 border-top">
            <small className="fw-bold text-muted d-block text-center mb-2" style={{ fontSize: '11px', letterSpacing: '0.3px' }}>
              ONE-CLICK DEMO ACCOUNTS FOR EVALUATION:
            </small>
            <div className="d-flex flex-column gap-2">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm text-start py-2 px-3 small d-flex justify-content-between align-items-center"
                onClick={() => fillDemoAccount('donor@bloodconnect.org', 'Donor123!')}
              >
                <div>
                  <strong className="d-block text-danger">Demo Donor: Arjun Mehta (O+)</strong>
                  <span className="text-muted" style={{ fontSize: '11px' }}>donor@bloodconnect.org</span>
                </div>
                <span className="badge bg-danger-subtle text-danger">DONOR</span>
              </button>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm text-start py-2 px-3 small d-flex justify-content-between align-items-center"
                onClick={() => fillDemoAccount('requester@bloodconnect.org', 'Requester123!')}
              >
                <div>
                  <strong className="d-block text-primary">Demo Requester: Priya Deshmukh</strong>
                  <span className="text-muted" style={{ fontSize: '11px' }}>requester@bloodconnect.org</span>
                </div>
                <span className="badge bg-primary-subtle text-primary">REQUESTER</span>
              </button>
              <button
                type="button"
                className="btn btn-outline-dark btn-sm text-start py-2 px-3 small d-flex justify-content-between align-items-center"
                onClick={() => fillDemoAccount('admin@bloodconnect.org', 'AdminPassword123!')}
              >
                <div>
                  <strong className="d-block text-dark">Demo Admin: Dr. Sarah Sharma</strong>
                  <span className="text-muted" style={{ fontSize: '11px' }}>admin@bloodconnect.org</span>
                </div>
                <span className="badge bg-dark-subtle text-dark">ADMIN</span>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-3">
          <span className="text-muted small">Don't have an account yet? </span>
          <Link to="/register" className="text-danger fw-bold text-decoration-none small">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
