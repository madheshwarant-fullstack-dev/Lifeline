import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { requestService } from '../../services/requestService';
import { donorService } from '../../services/donorService';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import StatusBadge from '../../components/common/StatusBadge';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import { 
  FaTint, 
  FaSearch, 
  FaUserPlus, 
  FaHospital, 
  FaCheckCircle, 
  FaArrowRight,
  FaMapMarkerAlt,
  FaFileMedical,
  FaHandsHelping
} from 'react-icons/fa';

const Home = () => {
  const { user } = useAuth();
  const [openRequests, setOpenRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [stats, setStats] = useState({
    totalDonors: 0,
    totalRequests: 0,
    successfulDonations: 0,
    availableDonors: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    // 1. Fetch real open blood requests
    const fetchRequests = async () => {
      try {
        const res = await requestService.getRequests();
        if (res && res.data) {
          // Filter requests that are active/open
          const active = res.data.filter(r => 
            ['OPEN', 'PENDING', 'MATCHED'].includes(r.status)
          );
          setOpenRequests(active.slice(0, 4));
        }
      } catch (e) {
        console.warn('Failed loading open requests:', e);
      } finally {
        setLoadingRequests(false);
      }
    };

    // 2. Fetch real live telemetry statistics from database
    const fetchLiveStats = async () => {
      try {
        const res = await donorService.getPublicStats();
        if (res && res.data) {
          setStats(res.data);
        }
      } catch (e) {
        console.warn('Failed loading platform stats:', e);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchRequests();
    fetchLiveStats();
  }, []);

  return (
    <div className="bg-white">
      {/* 1. HERO SECTION */}
      <section className="py-5 py-lg-6 position-relative border-bottom" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fffbfb 100%)' }}>
        <div className="container py-4">
          <div className="row align-items-center g-5">
            <div className="col-lg-8">
              <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-danger-subtle text-danger small fw-bold mb-3 border border-danger-subtle">
                <FaTint /> Location-Aware Blood Donation & Hospital Transfusion Network
              </div>
              
              <h1 className="display-4 fw-extrabold text-dark mb-3 lh-sm">
                Give Blood. <span className="text-danger">Save Lives.</span>
              </h1>
              
              <p className="lead text-secondary mb-4 fs-5" style={{ maxWidth: '640px' }}>
                Lifeline connects voluntary blood donors with hospitals and patients in immediate need of blood based on blood group, location, availability, and appropriate clinical screening.
              </p>

              {/* Primary & Secondary Action CTAs */}
              <div className="d-flex flex-wrap gap-3 mb-5">
                <Link to="/find-donors" className="btn btn-blood btn-lg px-4 shadow-sm d-flex align-items-center gap-2 fw-bold">
                  <FaSearch /> Find Blood
                </Link>
                <Link to="/register" className="btn btn-outline-danger btn-lg px-4 shadow-sm d-flex align-items-center gap-2 fw-bold bg-white">
                  <FaUserPlus /> Become a Donor
                </Link>
              </div>

              {/* Verified Live Platform Telemetry */}
              <div className="row g-4 pt-3 border-top border-light-subtle">
                <div className="col-6 col-sm-3">
                  <div className="text-secondary small fw-semibold">Registered Donors</div>
                  <h3 className="fw-extrabold text-dark mb-0 mt-1">
                    {loadingStats ? <span className="spinner-border spinner-border-sm text-danger" /> : (stats.totalDonors || 0)}
                  </h3>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="text-secondary small fw-semibold">Available Donors</div>
                  <h3 className="fw-extrabold text-success mb-0 mt-1">
                    {loadingStats ? <span className="spinner-border spinner-border-sm text-success" /> : (stats.availableDonors || 0)}
                  </h3>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="text-secondary small fw-semibold">Blood Requests</div>
                  <h3 className="fw-extrabold text-dark mb-0 mt-1">
                    {loadingStats ? <span className="spinner-border spinner-border-sm text-danger" /> : (stats.totalRequests || 0)}
                  </h3>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="text-secondary small fw-semibold">Completed Donations</div>
                  <h3 className="fw-extrabold text-danger mb-0 mt-1">
                    {loadingStats ? <span className="spinner-border spinner-border-sm text-danger" /> : (stats.successfulDonations || 0)}
                  </h3>
                </div>
              </div>
            </div>

            {/* Hero Quick Reference Card */}
            <div className="col-lg-4">
              <div className="bc-card p-4 shadow-sm border bg-white rounded-3">
                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <FaHospital className="text-danger" /> Hospital Access
                  </h6>
                  <span className="badge bg-danger-subtle text-danger px-2 py-1 rounded-pill small">
                    Verified Centers
                  </span>
                </div>
                <p className="text-muted small mb-3">
                  Hospitals and accredited medical centers can issue official blood requests and coordinate with matched voluntary donors.
                </p>
                <div className="d-grid gap-2">
                  <Link to="/hospital-info" className="btn btn-outline-secondary btn-sm fw-bold py-2">
                    Hospital Guidelines & Verification
                  </Link>
                  <Link to="/requester/create-request" className="btn btn-blood btn-sm fw-bold py-2">
                    Issue Hospital Blood Request
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW LIFELINE WORKS */}
      <section className="py-5 bg-light border-bottom">
        <div className="container py-2">
          <div className="text-center max-w-700 mx-auto mb-5">
            <span className="text-danger fw-bold small text-uppercase tracking-wider">Patient-First Protocol</span>
            <h2 className="fw-bold mb-2 text-dark">How Lifeline Works</h2>
            <p className="text-muted small">
              A structured, four-step clinical workflow connecting patients and voluntary donors safely.
            </p>
          </div>

          <div className="row g-4">
            {/* Step 1 */}
            <div className="col-md-6 col-lg-3">
              <div className="bc-card bc-card-hover p-4 h-100 bg-white shadow-sm border-0 rounded-3 text-center d-flex flex-column align-items-center">
                <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3 fw-bold" style={{ width: '52px', height: '52px', fontSize: '20px' }}>
                  1
                </div>
                <h5 className="fw-bold mb-2 text-dark">Register as a Donor</h5>
                <p className="text-muted small mb-0">
                  Register with your basic contact information, blood group, and location. Health and medical questions are never asked during ordinary registration.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="col-md-6 col-lg-3">
              <div className="bc-card bc-card-hover p-4 h-100 bg-white shadow-sm border-0 rounded-3 text-center d-flex flex-column align-items-center">
                <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3 fw-bold" style={{ width: '52px', height: '52px', fontSize: '20px' }}>
                  2
                </div>
                <h5 className="fw-bold mb-2 text-dark">Find Matching Requests</h5>
                <p className="text-muted small mb-0">
                  Receive notifications for compatible blood requests from nearby hospitals based on blood group, geographic proximity, and availability.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="col-md-6 col-lg-3">
              <div className="bc-card bc-card-hover p-4 h-100 bg-white shadow-sm border-0 rounded-3 text-center d-flex flex-column align-items-center">
                <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3 fw-bold" style={{ width: '52px', height: '52px', fontSize: '20px' }}>
                  3
                </div>
                <h5 className="fw-bold mb-2 text-dark">Donation-Time Screening</h5>
                <p className="text-muted small mb-0">
                  When you accept a blood request, complete a dedicated five-question pre-donation health questionnaire to protect your health and patient safety.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="col-md-6 col-lg-3">
              <div className="bc-card bc-card-hover p-4 h-100 bg-white shadow-sm border-0 rounded-3 text-center d-flex flex-column align-items-center">
                <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3 fw-bold" style={{ width: '52px', height: '52px', fontSize: '20px' }}>
                  4
                </div>
                <h5 className="fw-bold mb-2 text-dark">Coordinate with Hospital</h5>
                <p className="text-muted small mb-0">
                  Authorized medical staff review the screening, confirm clinical eligibility, provide arrival instructions, and confirm completion of your donation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. BLOOD REQUEST SUMMARY (Real Data Only) */}
      <section className="py-5 bg-white border-bottom">
        <div className="container py-2">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end mb-4">
            <div>
              <span className="text-danger fw-bold small text-uppercase tracking-wider d-flex align-items-center gap-1.5">
                <FaTint /> Live Demand
              </span>
              <h2 className="fw-bold mb-1 text-dark">Open Blood Requests</h2>
              <p className="text-muted mb-0 small">
                Verified hospital and patient requests actively seeking compatible voluntary blood donors.
              </p>
            </div>
            <Link to="/find-donors" className="btn btn-outline-danger btn-sm rounded-pill mt-3 mt-md-0 fw-semibold px-3">
              View All Donors & Requests <FaArrowRight size={11} className="ms-1" />
            </Link>
          </div>

          {loadingRequests ? (
            <div className="text-center py-5">
              <div className="spinner-border text-danger spinner-border-sm" role="status" />
              <div className="small text-muted mt-2">Checking active blood requests...</div>
            </div>
          ) : openRequests.length === 0 ? (
            <div className="p-4 bg-light rounded-3 text-center border my-3">
              <FaCheckCircle className="text-success mb-2" size={24} />
              <h6 className="fw-bold text-dark mb-1">No Open Blood Requests Right Now</h6>
              <p className="text-muted small mb-0" style={{ maxWidth: '500px', margin: '0 auto' }}>
                All current hospital requirements are fulfilled. Check back soon or register as a voluntary donor to be alerted when a matching need arises.
              </p>
            </div>
          ) : (
            <div className="row g-3">
              {openRequests.map((req) => (
                <div key={req.id || req._id} className="col-md-6 col-lg-3">
                  <div className="bc-card bc-card-hover p-3 h-100 d-flex flex-column bg-white shadow-sm border rounded-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="blood-badge-pill" style={{ width: '40px', height: '40px', fontSize: '1rem' }}>
                        {req.bloodGroup}
                      </span>
                      <UrgencyBadge urgency={req.urgency} />
                    </div>
                    
                    <h6 className="fw-bold mb-1 text-dark text-truncate">
                      {req.patientName || 'Patient In Need'}
                    </h6>
                    
                    <div className="text-muted small mb-1 d-flex align-items-center gap-1">
                      <FaHospital className="text-secondary flex-shrink-0" size={12} />
                      <span className="text-truncate">{req.hospitalName}</span>
                    </div>
                    
                    <div className="text-muted small mb-3 d-flex align-items-center gap-1">
                      <FaMapMarkerAlt className="text-danger flex-shrink-0" size={12} />
                      <span className="text-truncate">{req.city}{req.state ? `, ${req.state}` : ''} • <strong className="text-dark">{req.unitsRequired} unit(s)</strong></span>
                    </div>

                    <div className="mt-auto pt-2 border-top d-flex justify-content-between align-items-center">
                      <StatusBadge status={req.status} />
                      <Link 
                        to={user?.role === 'DONOR' ? `/donor/available-requests` : `/requests/${req.id || req._id}`} 
                        className="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1 small fw-bold"
                      >
                        {user?.role === 'DONOR' ? 'Review & Donate' : 'View Details'}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. ABOUT LIFELINE (One Concise, Meaningful Section) */}
      <section className="py-5 bg-light">
        <div className="container py-2" style={{ maxWidth: '960px' }}>
          <div className="bc-card p-4 p-md-5 bg-white border shadow-sm rounded-3">
            <div className="text-center mb-4">
              <span className="text-danger fw-bold small text-uppercase tracking-wider">About Lifeline</span>
              <h3 className="fw-bold text-dark mt-1">Connecting Humanity in Critical Moments</h3>
            </div>
            
            <p className="text-secondary text-center mb-4" style={{ lineHeight: '1.8' }}>
              Lifeline is a dedicated healthcare coordination platform developed to eliminate life-threatening delays in emergency medicine. By directly bridging certified hospital blood banks with altruistic voluntary donors based on serological compatibility and geographic proximity, Lifeline streamlines donation coordination while rigorously upholding clinical safety and data privacy protocols.
            </p>

            <div className="row g-4 pt-3 border-top text-center">
              <div className="col-md-4">
                <div className="p-2">
                  <FaHandsHelping className="text-danger mb-2" size={26} />
                  <h6 className="fw-bold text-dark">Voluntary Altruism</h6>
                  <p className="text-muted small mb-0">Championing non-remunerated, compassionate blood donation aligned with national healthcare ethics.</p>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-2">
                  <FaMapMarkerAlt className="text-danger mb-2" size={26} />
                  <h6 className="fw-bold text-dark">Location Proximity</h6>
                  <p className="text-muted small mb-0">Prioritizing nearby donors to minimize transit time when critical transfusion deadlines approach.</p>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-2">
                  <FaFileMedical className="text-danger mb-2" size={26} />
                  <h6 className="fw-bold text-dark">Clinical Screening</h6>
                  <p className="text-muted small mb-0">Pre-donation health assessment evaluated by authorized medical personnel before transfusion.</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 text-center">
              <DisclaimerAlert />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
