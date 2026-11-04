import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  BsDropletFill, 
  BsSpeedometer2, 
  BsPeople, 
  BsPersonCheck, 
  BsCardChecklist, 
  BsExclamationTriangleFill, 
  BsHeartFill, 
  BsHospital, 
  BsBarChartFill, 
  BsBell, 
  BsGearFill, 
  BsBoxArrowRight,
  BsList,
  BsArrowLeft,
  BsHeartPulse
} from 'react-icons/bs';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="d-flex flex-column min-vh-100 bg-light">
      {/* Admin Top Header */}
      <header className="bg-dark text-white px-3 py-2 border-bottom border-secondary border-opacity-50 sticky-top">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <button 
              className="btn btn-sm btn-outline-light d-lg-none"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <BsList />
            </button>
            <div className="d-flex align-items-center gap-2">
              <span className="brand-logo-badge p-1" style={{ width: '32px', height: '32px', fontSize: '1rem' }}>
                <BsDropletFill />
              </span>
              <span className="fw-bold fs-5 text-white">
                Life<span className="text-danger">Line</span> <span className="badge bg-danger small ms-1">ADMIN CONSOLE</span>
              </span>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3">
            <NavLink to="/" className="btn btn-outline-light btn-sm d-flex align-items-center gap-1">
              <BsArrowLeft size={12} /> View Public Portal
            </NavLink>
            <div className="text-end d-none d-sm-block">
              <div className="small fw-semibold text-white">{user?.name || 'Administrator'}</div>
              <small className="text-light text-opacity-50" style={{ fontSize: '11px' }}>Chief Administrator</small>
            </div>
            <button 
              className="btn btn-danger btn-sm rounded-pill px-3 d-flex align-items-center gap-1.5"
              onClick={handleLogout}
            >
              <BsBoxArrowRight size={12} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="d-flex flex-grow-1 position-relative" style={{ minHeight: 'calc(100vh - 53px)' }}>
        {/* Admin Sidebar */}
        <aside 
          className={`dashboard-sidebar bg-white border-end d-flex flex-column ${sidebarOpen ? 'd-flex' : 'd-none d-lg-flex'}`}
          style={{ width: '260px', minWidth: '260px', flexShrink: 0 }}
        >
          <div className="p-3 border-bottom bg-light bg-opacity-75">
            <small className="text-uppercase tracking-wider fw-bold text-muted" style={{ fontSize: '11px' }}>
              Management Operations
            </small>
          </div>
          <nav className="nav flex-column py-2 flex-grow-1">
            <NavLink to="/admin" className="sidebar-link" end onClick={() => setSidebarOpen(false)}>
              <BsSpeedometer2 /> Dashboard
            </NavLink>
            <NavLink to="/admin/users" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
              <BsPeople /> Users Management
            </NavLink>
            <NavLink to="/admin/donors" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
              <BsPersonCheck /> Donors & Verification
            </NavLink>
            <NavLink to="/admin/requests" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
              <BsCardChecklist /> Blood Requests
            </NavLink>
            <NavLink to="/admin/emergency" className="sidebar-link text-danger fw-semibold" onClick={() => setSidebarOpen(false)}>
              <BsExclamationTriangleFill /> Emergency Requests
            </NavLink>
            <NavLink to="/admin/screenings" className="sidebar-link text-primary fw-semibold" onClick={() => setSidebarOpen(false)}>
              <BsHeartPulse /> Medical Screenings
            </NavLink>
            <NavLink to="/admin/donations" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
              <BsHeartFill /> Donations
            </NavLink>
            <NavLink to="/admin/hospitals" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
              <BsHospital /> Hospitals
            </NavLink>
            <NavLink to="/admin/reports" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
              <BsBarChartFill /> Reports & Analytics
            </NavLink>
            <NavLink to="/admin/notifications" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
              <BsBell /> System Alerts
            </NavLink>
            <NavLink to="/admin/settings" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
              <BsGearFill /> Settings
            </NavLink>
          </nav>
        </aside>

        {/* Admin Content Area */}
        <main className="flex-grow-1 p-3 p-md-4 p-xl-4 bg-light" style={{ minWidth: 0, overflowX: 'hidden' }}>
          <div className="container-fluid px-0 px-xl-2" style={{ maxWidth: '1400px' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
