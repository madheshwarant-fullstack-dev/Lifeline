import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import Navbar from '../components/common/Navbar';
import { 
  BsSpeedometer2, 
  BsPersonGear, 
  BsHeartFill, 
  BsClockHistory, 
  BsBell, 
  BsPlusCircle, 
  BsListCheck, 
  BsPeople, 
  BsGeoAlt,
  BsList, 
  BsXLg,
  BsBoxArrowRight,
  BsExclamationTriangleFill 
} from 'react-icons/bs';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isDonor = user?.role === 'DONOR';

  return (
    <div className="d-flex flex-column min-vh-100 bg-light">
      <Navbar />

      {/* Mobile Sidebar Toggle bar */}
      <div className="d-lg-none bg-white py-2 px-3 border-bottom d-flex justify-content-between align-items-center">
        <span className="fw-bold small text-secondary">
          {isDonor ? 'Donor Portal' : (user?.role === 'HOSPITAL' ? 'Hospital Transfusion Portal' : 'Requester Portal')}
        </span>
        <button 
          className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1.5"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          type="button"
          aria-label="Toggle navigation drawer"
        >
          {sidebarOpen ? <BsXLg size={13} /> : <BsList size={13} />}
          <span>{sidebarOpen ? 'Close Menu' : 'Navigation Menu'}</span>
        </button>
      </div>

      <div className="d-flex flex-grow-1 position-relative" style={{ minHeight: 'calc(100vh - 65px)' }}>
        {/* Sidebar */}
        <aside 
          className={`dashboard-sidebar bg-white border-end d-flex flex-column ${sidebarOpen ? 'd-flex' : 'd-none d-lg-flex'}`}
          style={{ width: '260px', minWidth: '260px', flexShrink: 0 }}
        >
          <div className="p-3 border-bottom bg-light bg-opacity-50">
            <div className="small text-muted fw-semibold">Signed in as</div>
            <div className="fw-bold text-dark text-truncate">{user?.name}</div>
            <span className="badge bg-danger-subtle text-danger border border-danger-subtle mt-1 rounded-pill" style={{ fontSize: '11px' }}>
              {user?.role} {isDonor && (user?.bloodGroup || user?.donorProfile?.bloodGroup) ? `• Blood Group ${user?.bloodGroup || user?.donorProfile?.bloodGroup}` : ''}
            </span>
          </div>

          <nav className="nav flex-column py-2 flex-grow-1">
            {isDonor ? (
              <>
                <NavLink to="/donor/dashboard" className="sidebar-link" end onClick={() => setSidebarOpen(false)}>
                  <BsSpeedometer2 /> Dashboard
                </NavLink>
                <NavLink to="/donor/emergency-requests" className="sidebar-link text-danger fw-semibold" onClick={() => setSidebarOpen(false)}>
                  <BsExclamationTriangleFill /> Emergency Alerts &amp; Invites
                </NavLink>
                <NavLink to="/donor/profile" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
                  <BsPersonGear /> My Profile &amp; Location
                </NavLink>
                <NavLink to="/donor/available-requests" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
                  <BsHeartFill /> Available Requests
                </NavLink>
                <NavLink to="/donor/history" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
                  <BsClockHistory /> Donation History
                </NavLink>
                <NavLink to="/donor/notifications" className="sidebar-link d-flex align-items-center justify-content-between" onClick={() => setSidebarOpen(false)}>
                  <span className="d-flex align-items-center gap-2">
                    <BsBell /> Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="badge bg-danger rounded-pill" style={{ fontSize: '10px' }}>
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/requester/dashboard" className="sidebar-link" end onClick={() => setSidebarOpen(false)}>
                  <BsSpeedometer2 /> Dashboard
                </NavLink>
                {user?.role === 'HOSPITAL' && (
                  <NavLink to="/hospital/dashboard" className="sidebar-link fw-semibold text-danger" onClick={() => setSidebarOpen(false)}>
                    <BsGeoAlt /> Live Donor Map &amp; Radar
                  </NavLink>
                )}
                <NavLink to="/requester/create-request" className="sidebar-link text-danger fw-semibold" onClick={() => setSidebarOpen(false)}>
                  <BsPlusCircle /> {user?.role === 'HOSPITAL' ? 'Create Official Request' : 'Request Blood'}
                </NavLink>
                <NavLink to="/requester/my-requests" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
                  <BsListCheck /> My Requests
                </NavLink>
                <NavLink to="/find-donors" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
                  <BsPeople /> Search Donors
                </NavLink>
                <NavLink to="/requester/notifications" className="sidebar-link d-flex align-items-center justify-content-between" onClick={() => setSidebarOpen(false)}>
                  <span className="d-flex align-items-center gap-2">
                    <BsBell /> Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="badge bg-danger rounded-pill" style={{ fontSize: '10px' }}>
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              </>
            )}
          </nav>

          <div className="p-3 border-top mt-auto bg-white">
            <button 
              className="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
              onClick={handleLogout}
              type="button"
            >
              <BsBoxArrowRight /> Sign Out
            </button>
          </div>
        </aside>

        {/* Main Dashboard Area */}
        <main className="flex-grow-1 p-3 p-md-4 p-xl-4 bg-light" style={{ minWidth: 0, overflowX: 'hidden' }}>
          <div className="container-fluid px-0 px-xl-2" style={{ maxWidth: '1400px' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
