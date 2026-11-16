import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { donorService } from '../../services/donorService';
import { donationService } from '../../services/donationService';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import DonorLiveTrackingCard from '../../components/donor/DonorLiveTrackingCard';
import { 
  FaTint, 
  FaHeartbeat, 
  FaCalendarCheck, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaMapMarkerAlt, 
  FaCheck, 
  FaTimes,
  FaPhoneAlt,
  FaEnvelope,
  FaEdit,
  FaHistory,
  FaShieldAlt,
  FaHospital,
  FaCalendarAlt,
  FaNotesMedical,
  FaStethoscope,
  FaFileContract
} from 'react-icons/fa';

const DonorDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [recentDonations, setRecentDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [acceptedRequestId, setAcceptedRequestId] = useState(null);

  const fetchDashboard = async () => {
    try {
      const [dashRes, donRes] = await Promise.all([
        donorService.getDonorDashboard(),
        donationService.getDonations().catch(() => ({ data: [] }))
      ]);

      if (dashRes && dashRes.data) {
        setDashboardData(dashRes.data);
      }
      if (donRes && donRes.data) {
        setRecentDonations(donRes.data.slice(0, 5));
      }
    } catch (err) {
      console.error('Failed loading donor dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleToggleAvailability = async (newVal) => {
    try {
      setActionMessage('');
      setActionError('');
      await donorService.setAvailability(newVal);
      setActionMessage(`Your status is now ${newVal ? 'Available for requests' : 'Unavailable'}.`);
      fetchDashboard();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update availability status.');
    }
  };

  const handleRespond = async (requestId, action) => {
    try {
      setActionMessage('');
      setActionError('');
      const res = await donorService.respondToRequest(requestId, action);
      if (action === 'ACCEPT') {
        setAcceptedRequestId(requestId);
        setActionMessage('Request accepted! Please proceed to the pre-donation health screening.');
      } else {
        setActionMessage(res.message || `Successfully responded (${action}).`);
      }
      fetchDashboard();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not record response.');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status" />
        <p className="text-muted small mt-2">Loading your donor dashboard...</p>
      </div>
    );
  }

  const donor = dashboardData?.donor || user?.donorProfile || {};
  const isEligible = dashboardData?.isEligible;
  const daysUntilEligible = dashboardData?.daysUntilEligible || 0;
  const nearbyRequests = dashboardData?.nearbyRequests || [];
  const activeAcceptedRequests = dashboardData?.activeAcceptedRequests || [];

  return (
    <div>
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4 pb-3 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h2 className="fw-bold mb-0">Donor Dashboard</h2>
            <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2.5 py-1">
              {donor.bloodGroup || user?.bloodGroup || 'O+'} Voluntary Donor
            </span>
          </div>
          <p className="text-muted small mb-0">
            Welcome back, <strong className="text-dark">{donor.name || user?.name}</strong>. Manage your availability, review urgent requests, and track your donation history.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          <Link to="/donor/profile" className="btn btn-outline-secondary btn-sm rounded-pill fw-semibold d-flex align-items-center gap-1.5 px-3 py-1.5 shadow-sm">
            <FaEdit size={12} /> Edit Profile
          </Link>
          <Link to="/donor/available-requests" className="btn btn-blood btn-sm rounded-pill fw-semibold px-3 py-1.5 shadow-sm">
            Browse All Requests
          </Link>
        </div>
      </div>

      {actionMessage && (
        <div className="alert alert-success alert-dismissible fade show small py-3 mb-4 shadow-sm border-0 border-start border-success border-4" role="alert">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
            <div className="d-flex align-items-center gap-2">
              <FaCheckCircle className="text-success flex-shrink-0 fs-5" /> 
              <span>{actionMessage}</span>
            </div>
            {acceptedRequestId && (
              <Link 
                to={`/donor/screening/${acceptedRequestId}`} 
                className="btn btn-blood btn-sm fw-bold px-3 py-1.5 rounded-pill flex-shrink-0 d-inline-flex align-items-center gap-1 shadow-sm"
              >
                <FaHeartbeat size={13} /> Proceed to Donation Screening &rarr;
              </Link>
            )}
          </div>
          <button type="button" className="btn-close py-2.5" onClick={() => { setActionMessage(''); setAcceptedRequestId(null); }} />
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger alert-dismissible fade show small py-2.5 mb-4 shadow-sm" role="alert">
          <FaTimesCircle className="me-2 text-danger" /> {actionError}
          <button type="button" className="btn-close py-2.5" onClick={() => setActionError('')} />
        </div>
      )}

      {/* 1. DONOR PROFILE SUMMARY & CONTACT DETAILS CARD */}
      <div className="bc-card p-4 bg-white mb-4 shadow-sm border">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 pb-3 border-bottom gap-3">
          <div className="d-flex align-items-center gap-3">
            <span className="blood-badge-pill flex-shrink-0" style={{ width: '56px', height: '56px', fontSize: '1.35rem' }}>
              {donor.bloodGroup || user?.bloodGroup || 'O+'}
            </span>
            <div>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <h4 className="fw-bold text-dark mb-0">{donor.name || user?.name}</h4>
                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-0.5" style={{ fontSize: '11px' }}>
                  <FaCheckCircle className="me-1" size={10} /> Verified Donor
                </span>
              </div>
              <small className="text-muted">Registered Voluntary Blood Donor • {donor.gender || 'Not specified'}</small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className={`badge rounded-pill px-3 py-2 fw-semibold ${donor.availability ? 'bg-success text-white' : 'bg-secondary text-white'}`}>
              {donor.availability ? '● Available for Emergency Requests' : 'Currently Unavailable'}
            </span>
            <button
              type="button"
              className={`btn btn-sm fw-bold px-3 py-1.5 rounded-pill shadow-sm ${donor.availability ? 'btn-outline-danger' : 'btn-success text-white'}`}
              onClick={() => handleToggleAvailability(!donor.availability)}
            >
              {donor.availability ? 'Set Unavailable' : 'Set Available'}
            </button>
          </div>
        </div>

        <div className="row g-3 small">
          <div className="col-sm-6 col-lg-3">
            <div className="p-3 bg-light rounded-3 h-100 border border-light-subtle d-flex flex-column justify-content-center">
              <span className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Contact Phone</span>
              <strong className="text-dark d-flex align-items-center gap-2 text-truncate">
                <FaPhoneAlt className="text-danger flex-shrink-0" size={12} /> {donor.phone || user?.phone || 'Not provided'}
              </strong>
            </div>
          </div>
          <div className="col-sm-6 col-lg-3">
            <div className="p-3 bg-light rounded-3 h-100 border border-light-subtle d-flex flex-column justify-content-center">
              <span className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Email Address</span>
              <strong className="text-dark d-flex align-items-center gap-2 text-truncate" title={donor.email || user?.email}>
                <FaEnvelope className="text-danger flex-shrink-0" size={12} /> {donor.email || user?.email || 'Not provided'}
              </strong>
            </div>
          </div>
          <div className="col-sm-6 col-lg-3">
            <div className="p-3 bg-light rounded-3 h-100 border border-light-subtle d-flex flex-column justify-content-center">
              <span className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Location / City</span>
              <strong className="text-dark d-flex align-items-center gap-2 text-truncate">
                <FaMapMarkerAlt className="text-danger flex-shrink-0" size={12} /> {donor.city || user?.city || 'City not set'}{donor.state || user?.state ? `, ${donor.state || user?.state}` : ''}
              </strong>
            </div>
          </div>
          <div className="col-sm-6 col-lg-3">
            <div className="p-3 bg-light rounded-3 h-100 border border-light-subtle d-flex flex-column justify-content-center">
              <span className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Emergency Contact</span>
              <strong className="text-dark d-flex align-items-center gap-2 text-truncate">
                <FaShieldAlt className="text-secondary flex-shrink-0" size={12} /> {donor.emergencyContact || 'None listed'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KEY STATUS METRICS ROW */}
      <div className="row g-3 mb-4">
        {/* Blood Group Card */}
        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3.5 bg-white h-100 shadow-sm border d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Blood Group</small>
                <h3 className="fw-bold text-dark mb-0 mt-1">{donor.bloodGroup || 'O+'}</h3>
              </div>
              <span className="blood-badge-pill" style={{ width: '42px', height: '42px', fontSize: '1rem' }}>
                <FaTint />
              </span>
            </div>
            <div className="mt-2 pt-2 border-top">
              <small className="text-danger fw-semibold d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                <FaCheckCircle size={10} /> {donor.verificationStatus === 'VERIFIED' ? 'Verified Registered Donor' : 'Pending Verification'}
              </small>
            </div>
          </div>
        </div>

        {/* Availability Status Card with One-Click Toggle */}
        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3.5 bg-white h-100 shadow-sm border d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Current Availability</small>
                <h5 className={`fw-bold mb-0 mt-1 ${donor.availability ? 'text-success' : 'text-secondary'}`}>
                  {donor.availability ? 'Active / Available' : 'Inactive'}
                </h5>
              </div>
              <span className={`badge rounded-pill ${donor.availability ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '11px' }}>
                {donor.availability ? 'Ready' : 'Paused'}
              </span>
            </div>
            <div className="d-flex align-items-center justify-content-between mt-2 pt-2 border-top">
              <span className="text-muted" style={{ fontSize: '11px' }}>Toggle status:</span>
              <button
                type="button"
                className={`btn btn-xs px-2.5 py-0.5 rounded-pill fw-bold ${donor.availability ? 'btn-outline-danger' : 'btn-success text-white'}`}
                onClick={() => handleToggleAvailability(!donor.availability)}
                style={{ fontSize: '11px' }}
              >
                {donor.availability ? 'Turn Off' : 'Turn On'}
              </button>
            </div>
          </div>
        </div>

        {/* Eligibility Status */}
        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3.5 bg-white h-100 shadow-sm border d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Medical Eligibility</small>
                <h5 className={`fw-bold mb-0 mt-1 ${isEligible ? 'text-success' : 'text-warning'}`}>
                  {isEligible ? 'Eligible Now' : `Cooldown (${daysUntilEligible}d)`}
                </h5>
              </div>
              <span className={`rounded-circle p-2 ${isEligible ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`} style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaHeartbeat size={18} />
              </span>
            </div>
            <div className="mt-2 pt-2 border-top">
              <small className="text-muted" style={{ fontSize: '11px' }}>
                {isEligible ? '90-day cooldown cleared' : 'Recovery cycle in progress'}
              </small>
            </div>
          </div>
        </div>

        {/* Total Donations */}
        <div className="col-sm-6 col-lg-3">
          <div className="bc-card p-3.5 bg-white h-100 shadow-sm border d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Total Donations</small>
                <h3 className="fw-bold text-dark mb-0 mt-1">{dashboardData?.totalDonations || 0}</h3>
              </div>
              <span className="rounded-circle p-2 bg-primary-subtle text-primary" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaCalendarCheck size={18} />
              </span>
            </div>
            <div className="mt-2 pt-2 border-top">
              <small className="text-muted" style={{ fontSize: '11px' }}>
                Last: {donor.lastDonationDate ? new Date(donor.lastDonationDate).toLocaleDateString() : 'Never logged'}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* 2b. DONOR MEDICAL REVIEW & HEALTH PROFILE SECTION */}
      <div className="bc-card p-4 bg-white mb-4 shadow-sm border">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-3 pb-2 border-bottom">
          <div>
            <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
              <FaNotesMedical className="text-danger" /> Medical Review &amp; Health Clearance Profile
            </h5>
            <small className="text-muted">Clinical eligibility status and pre-screening overview</small>
          </div>
          <Link to="/donor/profile" className="btn btn-sm btn-outline-danger rounded-pill fw-semibold d-inline-flex align-items-center gap-1">
            <FaStethoscope size={11} /> View / Update Medical Profile
          </Link>
        </div>

        <div className="row g-3">
          <div className="col-sm-6 col-lg-3">
            <div className="p-3 bg-light rounded-3 h-100 border text-center">
              <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '10px' }}>Clinical Status</span>
              <span className={`badge rounded-pill px-3 py-1.5 mt-2 ${
                donor.medicalReviewStatus === 'VERIFIED' ? 'bg-success text-white' :
                donor.medicalReviewStatus === 'REQUIRES_ASSESSMENT' ? 'bg-warning text-dark' :
                donor.medicalReviewStatus === 'NOT_CLEARED' ? 'bg-danger text-white' :
                'bg-secondary text-white'
              }`} style={{ fontSize: '11px' }}>
                <FaStethoscope className="me-1" />
                {donor.medicalReviewStatus === 'VERIFIED' ? 'Verified' :
                 donor.medicalReviewStatus === 'REQUIRES_ASSESSMENT' ? 'Requires Assessment' :
                 donor.medicalReviewStatus === 'NOT_CLEARED' ? 'Not Cleared' : 'Pending Verification'}
              </span>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="p-3 bg-light rounded-3 h-100 border text-center">
              <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '10px' }}>Health Declaration</span>
              <strong className="text-dark d-block mt-2">
                {donor.healthDeclaration ? (
                  <span className="text-success d-inline-flex align-items-center gap-1">
                    <FaCheckCircle size={12} /> Declared &amp; Signed
                  </span>
                ) : (
                  <span className="text-warning d-inline-flex align-items-center gap-1">
                    <FaTimesCircle size={12} /> Pending Declaration
                  </span>
                )}
              </strong>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="p-3 bg-light rounded-3 h-100 border text-center">
              <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '10px' }}>Recorded Weight</span>
              <h4 className="fw-bold text-dark mb-0 mt-1">
                {donor.weight ? `${donor.weight} kg` : 'Not recorded'}
              </h4>
              <small className="text-muted" style={{ fontSize: '10px' }}>Min 45 kg required</small>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="p-3 bg-light rounded-3 h-100 border text-center">
              <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '10px' }}>Donation Cooldown</span>
              <h5 className={`fw-bold mb-0 mt-1 ${isEligible ? 'text-success' : 'text-danger'}`}>
                {isEligible ? 'Cleared for Donation' : `${daysUntilEligible} Days Remaining`}
              </h5>
              <small className="text-muted" style={{ fontSize: '10px' }}>90 days whole blood interval</small>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ACTIVE ACCEPTED REQUESTS & HEALTH SCREENING SECTION */}
      {activeAcceptedRequests.length > 0 && (
        <div className="bc-card p-4 bg-white mb-4 shadow-sm border border-danger-subtle">
          <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
            <div>
              <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                <FaHeartbeat className="text-danger" /> My Active Donation Commitments & Screening
              </h5>
              <small className="text-muted">Requests you have accepted. Complete screening and track medical clearance status.</small>
            </div>
            <span className="badge bg-danger rounded-pill px-2.5 py-1">
              {activeAcceptedRequests.length} Active
            </span>
          </div>

          <div className="d-flex flex-column gap-3">
            {activeAcceptedRequests.map((req) => {
              const isScreeningPending = !req.hasScreening || req.screeningStatus === 'NOT_SUBMITTED';
              const isAwaitingReview = req.screeningStatus === 'AWAITING_REVIEW' || req.status === 'SCREENING_SUBMITTED';
              const isApproved = req.screeningStatus === 'APPROVED' || req.status === 'SCHEDULED';

              return (
                <div key={req.id} className="p-3.5 bg-light rounded-3 border">
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-2">
                    <div className="d-flex align-items-center gap-3">
                      <span className="blood-badge-pill flex-shrink-0" style={{ width: '42px', height: '42px', fontSize: '1rem' }}>
                        {req.bloodGroup}
                      </span>
                      <div>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <h6 className="fw-bold text-dark mb-0">{req.patientName}</h6>
                          <UrgencyBadge urgency={req.urgency} />
                          <StatusBadge status={req.status} />
                        </div>
                        <small className="text-muted d-block mt-0.5">
                          <FaHospital className="me-1 text-secondary" /> {req.hospitalName}, {req.city} • <FaCalendarAlt className="ms-1 me-1 text-secondary" /> Date: {req.requiredDate}
                        </small>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {isScreeningPending && (
                        <Link 
                          to={`/donor/screening/${req.id}`} 
                          className="btn btn-blood btn-sm fw-bold px-3 py-2 rounded-pill shadow-sm d-inline-flex align-items-center gap-1.5"
                        >
                          <FaHeartbeat size={13} /> Proceed to Donation Screening &rarr;
                        </Link>
                      )}
                      {isAwaitingReview && (
                        <Link 
                          to={`/donor/screening/${req.id}`} 
                          className="btn btn-outline-info btn-sm fw-bold px-3 py-2 rounded-pill d-inline-flex align-items-center gap-1.5"
                        >
                          <FaCheckCircle size={13} /> Screening Submitted – Awaiting Review
                        </Link>
                      )}
                      {isApproved && (
                        <Link 
                          to={`/donor/screening/${req.id}`} 
                          className="btn btn-success btn-sm fw-bold px-3 py-2 rounded-pill text-white shadow-sm d-inline-flex align-items-center gap-1.5"
                        >
                          <FaCheckCircle size={13} /> Medically Approved – View Coordination
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Context notice */}
                  <div className="mt-2 pt-2 border-top small text-secondary">
                    {isScreeningPending && (
                      <span className="text-danger fw-semibold">
                        ● Action Required: Pre-donation health screening form must be completed before clinical donation coordination.
                      </span>
                    )}
                    {isAwaitingReview && (
                      <span className="text-primary fw-semibold">
                        ● Screening Submitted – Awaiting Medical Review. Authorized hospital staff are evaluating responses.
                      </span>
                    )}
                    {isApproved && (
                      <span className="text-success fw-semibold">
                        ● Medically Cleared: Clinical review completed. Please review hospital coordination instructions.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. NEARBY & COMPATIBLE BLOOD REQUESTS */}
      <div className="bc-card p-4 bg-white mb-4 shadow-sm border">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h5 className="fw-bold text-dark mb-0">Urgent Compatible Requests For You</h5>
            <small className="text-muted">Filtered for patients who can receive your blood type ({donor.bloodGroup})</small>
          </div>
          <Link to="/donor/available-requests" className="btn btn-outline-danger btn-sm rounded-pill fw-semibold">
            View All Requests
          </Link>
        </div>

        {nearbyRequests.length === 0 ? (
          <div className="text-center py-4 bg-light rounded-3 border">
            <FaCheckCircle className="text-success mb-2" size={28} />
            <h6 className="fw-bold text-dark mb-1">No Urgent Compatible Requests At This Moment</h6>
            <p className="text-muted small mb-0">Thank you for standing by. We will notify you when someone nearby needs your blood.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small">
                <tr>
                  <th>Patient</th>
                  <th>Required Blood</th>
                  <th>Units</th>
                  <th>Hospital & City</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th className="text-end">Respond / Actions</th>
                </tr>
              </thead>
              <tbody className="small">
                {nearbyRequests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <strong className="text-dark d-block">{req.patientName}</strong>
                      <span className="text-muted" style={{ fontSize: '11px' }}>Req: {req.requiredDate}</span>
                    </td>
                    <td>
                      <span className="blood-badge-pill" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                        {req.bloodGroup}
                      </span>
                    </td>
                    <td><strong className="text-dark">{req.unitsRequired}</strong> unit(s)</td>
                    <td>
                      <div className="text-dark fw-semibold">{req.hospitalName}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>{req.city}{req.state ? `, ${req.state}` : ''}</div>
                    </td>
                    <td>
                      <UrgencyBadge urgency={req.urgency} />
                    </td>
                    <td>
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="text-end">
                      {req.status === 'ACCEPTED' ? (
                        <Link
                          to={`/donor/screening/${req.id}`}
                          className="btn btn-sm btn-blood py-1 px-2.5 fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                          title="Complete Health Screening"
                        >
                          <FaHeartbeat size={11} /> Proceed to Screening
                        </Link>
                      ) : req.status === 'SCREENING_SUBMITTED' ? (
                        <Link
                          to={`/donor/screening/${req.id}`}
                          className="btn btn-sm btn-outline-info py-1 px-2.5 fw-bold d-inline-flex align-items-center gap-1"
                        >
                          <FaCheckCircle size={11} /> Awaiting Review
                        </Link>
                      ) : req.status === 'SCHEDULED' ? (
                        <Link
                          to={`/donor/screening/${req.id}`}
                          className="btn btn-sm btn-outline-success py-1 px-2.5 fw-bold d-inline-flex align-items-center gap-1"
                        >
                          <FaCheckCircle size={11} /> Cleared – Coordination
                        </Link>
                      ) : (
                        <div className="d-inline-flex gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-success py-1 px-2.5 fw-bold d-flex align-items-center gap-1"
                            onClick={() => handleRespond(req.id, 'ACCEPT')}
                            title="Accept this blood donation request"
                          >
                            <FaCheck size={11} /> Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-1 px-2"
                            onClick={() => handleRespond(req.id, 'REJECT')}
                            title="Decline"
                          >
                            <FaTimes size={11} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DonorLiveTrackingCard donor={donor} onStatusChange={fetchDashboard} />

      {/* 4. RECENT DONATION HISTORY PREVIEW */}
      <div className="bc-card p-4 bg-white mb-4 shadow-sm border">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h5 className="fw-bold text-dark mb-0">My Donation Records</h5>
            <small className="text-muted">Verified hospital sign-offs and units contributed</small>
          </div>
          <Link to="/donor/history" className="btn btn-outline-secondary btn-sm rounded-pill fw-semibold">
            View Complete History &rarr;
          </Link>
        </div>

        {recentDonations.length === 0 ? (
          <div className="text-center py-4 bg-light rounded-3 border">
            <FaHistory className="text-muted mb-2" size={24} />
            <h6 className="fw-bold text-dark mb-1">No Completed Donations Yet</h6>
            <p className="text-muted small mb-0">Once you fulfill an urgent request and donate, your verified certificate will be logged here.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Donation ID</th>
                  <th>Hospital & City</th>
                  <th>Units</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentDonations.map((d) => (
                  <tr key={d.id || d._id}>
                    <td><strong className="text-danger">{d.donationId || 'DON-' + String(d.id || d._id).slice(-6)}</strong></td>
                    <td>{d.hospitalName}, {d.city}</td>
                    <td><strong>{d.units || 1}</strong> unit(s)</td>
                    <td>{d.donationDate ? new Date(d.donationDate).toLocaleDateString() : 'Recent'}</td>
                    <td>
                      <span className={`badge rounded-pill ${d.status === 'COMPLETED' ? 'bg-success' : 'bg-warning text-dark'}`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DisclaimerAlert />
    </div>
  );
};

export default DonorDashboard;
