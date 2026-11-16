import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { 
  BsDropletFill, 
  BsBell, 
  BsPersonCircle, 
  BsBoxArrowRight, 
  BsPlusCircle, 
  BsGraphUp, 
  BsList, 
  BsXLg 
} from 'react-icons/bs';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notifRef = useRef(null);
  const navigate = useNavigate();

  // Close notifications dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.role === 'ADMIN') return '/admin';
    if (user.role === 'DONOR') return '/donor/dashboard';
    if (user.role === 'REQUESTER' || user.role === 'HOSPITAL') return '/requester/dashboard';
    return '/';
  };

  const handleNotificationClick = (n) => {
    markAsRead(n.id);
    setShowNotifications(false);
    setMobileMenuOpen(false);
    if (user?.role === 'ADMIN') {
      navigate('/admin/notifications');
    } else if (user?.role === 'DONOR') {
      navigate('/donor/notifications');
    } else {
      navigate('/requester/notifications');
    }
  };

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setShowNotifications(false);
  };

  return (
    <header className="sticky-top navbar-custom shadow-sm">
      <nav className="navbar navbar-expand-lg py-2">
        <div className="container">
          {/* Brand Logo */}
          <Link to="/" className="navbar-brand d-flex align-items-center gap-2 text-decoration-none" onClick={closeMenus}>
            <span className="brand-logo-badge">
              <BsDropletFill />
            </span>
            <div className="d-flex flex-column">
              <span className="fw-bolder fs-4 text-dark lh-1" style={{ letterSpacing: '-0.5px' }}>
                Life<span className="text-danger">Line</span>
              </span>
              <small className="text-muted fw-semibold" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>
                EMERGENCY DONOR NETWORK
              </small>
            </div>
          </Link>

          {/* Mobile Toggle */}
          <button
            className="navbar-toggler border-0 shadow-none p-1.5"
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <BsXLg size={18} /> : <BsList size={22} />}
          </button>

          {/* Links */}
          <div className={`collapse navbar-collapse ${mobileMenuOpen ? 'show' : ''}`} id="mainNavbar">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-3 gap-lg-1">
              <li className="nav-item">
                <NavLink to="/" className="nav-link px-2 fw-medium" end onClick={closeMenus}>
                  Home
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/find-donors" className="nav-link px-2 fw-bold text-danger" onClick={closeMenus}>
                  Find Blood
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/hospital-info" className="nav-link px-2 fw-medium" onClick={closeMenus}>
                  Hospital Info
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/about" className="nav-link px-2 fw-medium" onClick={closeMenus}>
                  About
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/contact" className="nav-link px-2 fw-medium" onClick={closeMenus}>
                  Contact
                </NavLink>
              </li>

              {/* Role specific links in nav */}
              {isAuthenticated && user?.role === 'DONOR' && (
                <li className="nav-item">
                  <NavLink to="/donor/available-requests" className="nav-link px-2 fw-semibold text-danger" onClick={closeMenus}>
                    Available Requests
                  </NavLink>
                </li>
              )}
              {isAuthenticated && (user?.role === 'REQUESTER' || user?.role === 'HOSPITAL') && (
                <li className="nav-item">
                  <NavLink to="/requester/create-request" className="nav-link px-2 fw-semibold text-danger d-flex align-items-center gap-1" onClick={closeMenus}>
                    <BsPlusCircle size={13} /> Request Blood
                  </NavLink>
                </li>
              )}
            </ul>

            {/* Right Side: Auth / Notifications / User */}
            <div className="d-flex align-items-center gap-2 mt-3 mt-lg-0">
              {isAuthenticated ? (
                <>
                  {/* Notification Center */}
                  <div className="position-relative" ref={notifRef}>
                    <button
                      className="btn btn-light rounded-circle p-2 position-relative border"
                      type="button"
                      onClick={() => setShowNotifications(!showNotifications)}
                      aria-label="Notifications"
                    >
                      <BsBell size={16} className="text-secondary" />
                      {unreadCount > 0 && (
                        <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '10px' }}>
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Notification Dropdown */}
                    {showNotifications && (
                      <div 
                        className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg border p-0"
                        style={{ width: '320px', zIndex: 1050 }}
                      >
                        <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
                          <h6 className="mb-0 fw-bold">Notifications</h6>
                          {unreadCount > 0 && (
                            <button 
                              className="btn btn-sm btn-link text-decoration-none p-0 text-danger small fw-semibold"
                              onClick={markAllAsRead}
                            >
                              Mark all read
                            </button>
                          )}
                        </div>
                        <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                          {notifications.length === 0 ? (
                            <div className="p-3 text-center text-muted small">
                              No notifications yet.
                            </div>
                          ) : (
                            notifications.slice(0, 10).map((n) => (
                              <div
                                key={n.id}
                                className={`notification-dropdown-item p-2.5 px-3 border-bottom text-start small transition-all ${n.isRead ? 'bg-white' : 'bg-light'}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleNotificationClick(n)}
                              >
                                <div className="d-flex justify-content-between align-items-start">
                                  <strong className={n.type === 'EMERGENCY' ? 'text-danger' : 'text-dark'}>
                                    {n.title}
                                  </strong>
                                  {!n.isRead && <span className="badge bg-danger rounded-pill p-1" />}
                                </div>
                                <div className="text-muted mt-1" style={{ fontSize: '0.8rem' }}>
                                  {n.message}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="p-2 text-center border-top bg-light rounded-bottom-3">
                          <Link 
                            to={user?.role === 'ADMIN' ? '/admin/notifications' : user?.role === 'DONOR' ? '/donor/notifications' : '/requester/notifications'}
                            className="text-danger small fw-semibold text-decoration-none"
                            onClick={closeMenus}
                          >
                            View All in Center &rarr;
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dashboard Shortcut Button */}
                  <Link to={getDashboardLink()} className="btn btn-outline-danger btn-sm rounded-pill fw-semibold px-3 d-flex align-items-center gap-1" onClick={closeMenus}>
                    <BsGraphUp size={13} />
                    <span>Dashboard</span>
                  </Link>

                  {/* User Profile dropdown */}
                  <div className="dropdown">
                    <button
                      className="btn btn-light btn-sm rounded-pill border px-2.5 py-1.5 d-flex align-items-center gap-2"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <BsPersonCircle className="text-danger" size={18} />
                      <span className="fw-semibold small text-truncate" style={{ maxWidth: '100px' }}>
                        {user.name.split(' ')[0]}
                      </span>
                      <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill py-0.5" style={{ fontSize: '10px' }}>
                        {user.role}
                      </span>
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end shadow-sm border mt-2">
                      <li>
                        <div className="px-3 py-1.5 text-muted small">
                          Signed in as <br />
                          <strong className="text-dark">{user.email}</strong>
                        </div>
                      </li>
                      <li><hr className="dropdown-divider my-1" /></li>
                      <li>
                        <Link to={getDashboardLink()} className="dropdown-item small py-1.5" onClick={closeMenus}>
                          My Dashboard
                        </Link>
                      </li>
                      {user.role === 'DONOR' && (
                        <li>
                          <Link to="/donor/profile" className="dropdown-item small py-1.5" onClick={closeMenus}>
                            Donor Profile
                          </Link>
                        </li>
                      )}
                      <li><hr className="dropdown-divider my-1" /></li>
                      <li>
                        <button className="dropdown-item small text-danger py-1.5 d-flex align-items-center gap-2" onClick={handleLogout}>
                          <BsBoxArrowRight /> Sign Out
                        </button>
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn btn-outline-secondary btn-sm rounded-pill px-3 fw-semibold" onClick={closeMenus}>
                    Login
                  </Link>
                  <Link to="/register" className="btn btn-danger btn-sm rounded-pill px-3.5 fw-semibold shadow-sm" onClick={closeMenus}>
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
