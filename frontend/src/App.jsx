import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from './layouts/AdminLayout';

// Common
import ProtectedRoute from './components/common/ProtectedRoute';

// Public Pages
import Home from './pages/public/Home';
import About from './pages/public/About';
import HowItWorks from './pages/public/HowItWorks';
import BloodGroups from './pages/public/BloodGroups';
import HospitalInfo from './pages/public/HospitalInfo';
import Contact from './pages/public/Contact';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import FindDonors from './pages/public/FindDonors';

// Donor Pages
import DonorDashboard from './pages/donor/DonorDashboard';
import DonorProfile from './pages/donor/DonorProfile';
import AvailableRequests from './pages/donor/AvailableRequests';
import DonationHistory from './pages/donor/DonationHistory';
import DonorNotifications from './pages/donor/DonorNotifications';
import DonationScreening from './pages/donor/DonationScreening';

// Requester Pages
import RequesterDashboard from './pages/requester/RequesterDashboard';
import CreateBloodRequest from './pages/requester/CreateBloodRequest';
import MyRequests from './pages/requester/MyRequests';
import RequestDetails from './pages/requester/RequestDetails';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import UsersManagement from './pages/admin/UsersManagement';
import DonorsManagement from './pages/admin/DonorsManagement';
import BloodRequestsManagement from './pages/admin/BloodRequestsManagement';
import EmergencyRequests from './pages/admin/EmergencyRequests';
import DonationsManagement from './pages/admin/DonationsManagement';
import MedicalScreeningsManagement from './pages/admin/MedicalScreeningsManagement';
import ReportsAnalytics from './pages/admin/ReportsAnalytics';
import AdminSettings from './pages/admin/AdminSettings';

function App() {
  return (
    <Routes>
      {/* 1. PUBLIC ROUTES */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/blood-groups" element={<BloodGroups />} />
        <Route path="/hospital-info" element={<HospitalInfo />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/find-donors" element={<FindDonors />} />
        <Route path="/donors" element={<FindDonors />} />
        <Route path="/requests/:id" element={<RequestDetails />} />
      </Route>

      {/* 2. DONOR DASHBOARD ROUTES (Protected: DONOR) */}
      <Route
        path="/donor"
        element={
          <ProtectedRoute allowedRoles={['DONOR']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/donor/dashboard" replace />} />
        <Route path="dashboard" element={<DonorDashboard />} />
        <Route path="profile" element={<DonorProfile />} />
        <Route path="available-requests" element={<AvailableRequests />} />
        <Route path="screening/:requestId" element={<DonationScreening />} />
        <Route path="history" element={<DonationHistory />} />
        <Route path="notifications" element={<DonorNotifications />} />
      </Route>

      {/* 3. REQUESTER & HOSPITAL ROUTES (Protected: REQUESTER, HOSPITAL, ADMIN) */}
      <Route
        path="/requester"
        element={
          <ProtectedRoute allowedRoles={['REQUESTER', 'HOSPITAL', 'ADMIN']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/requester/dashboard" replace />} />
        <Route path="dashboard" element={<RequesterDashboard />} />
        <Route path="create-request" element={<CreateBloodRequest />} />
        <Route path="my-requests" element={<MyRequests />} />
        <Route path="notifications" element={<DonorNotifications />} />
      </Route>

      {/* 4. ADMIN LOGIN */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* 5. ADMIN CONSOLE ROUTES (Protected: ADMIN) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<UsersManagement />} />
        <Route path="donors" element={<DonorsManagement />} />
        <Route path="requests" element={<BloodRequestsManagement />} />
        <Route path="emergency" element={<EmergencyRequests />} />
        <Route path="screenings" element={<MedicalScreeningsManagement />} />
        <Route path="donations" element={<DonationsManagement />} />
        <Route path="hospitals" element={<UsersManagement initialRole="HOSPITAL" />} />
        <Route path="reports" element={<ReportsAnalytics />} />
        <Route path="notifications" element={<DonorNotifications />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* Catch-all Not Found Route */}
      <Route
        path="*"
        element={
          <div className="d-flex flex-column justify-content-center align-items-center min-vh-100 bg-light p-4 text-center">
            <h1 className="display-1 fw-bold text-danger">404</h1>
            <h4 className="fw-bold text-dark mb-2">Page Not Found</h4>
            <p className="text-muted small mb-4">The page you were looking for doesn't exist or has moved.</p>
            <a href="/" className="btn btn-blood btn-sm fw-bold px-4 py-2">
              Return to Homepage
            </a>
          </div>
        }
      />
    </Routes>
  );
}

export default App;
