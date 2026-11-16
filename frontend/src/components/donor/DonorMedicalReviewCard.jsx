import React, { useState, useEffect } from 'react';
import { 
  FaUserCheck, 
  FaShieldAlt, 
  FaCalendarAlt, 
  FaHistory, 
  FaMapMarkerAlt, 
  FaFileContract, 
  FaStethoscope, 
  FaInfoCircle, 
  FaPaperPlane, 
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaBan
} from 'react-icons/fa';
import { donorService } from '../../services/donorService';

const getStatusBadgeClass = (status) => {
  const s = (status || '').toUpperCase();
  if (s.includes('VERIFIED')) return 'bg-success text-white';
  if (s.includes('REQUIRES') || s.includes('ASSESSMENT')) return 'bg-warning text-dark';
  if (s.includes('NOT') || s.includes('REJECTED') || s.includes('DEFERRED')) return 'bg-danger text-white';
  return 'bg-secondary text-white';
};

const getStatusIcon = (status) => {
  const s = (status || '').toUpperCase();
  if (s.includes('VERIFIED')) return <FaCheckCircle className="me-1" />;
  if (s.includes('REQUIRES') || s.includes('ASSESSMENT')) return <FaExclamationTriangle className="me-1" />;
  if (s.includes('NOT') || s.includes('REJECTED')) return <FaBan className="me-1" />;
  return <FaInfoCircle className="me-1" />;
};

const DonorMedicalReviewCard = ({
  donorId,
  donorSummary = null,
  requestId = null,
  onClose = null,
  onInvite = null,
  isInvited = false,
  invitationStatus = null
}) => {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    const fetchReview = async () => {
      const targetId = donorId || donorSummary?.id || donorSummary?.donorId;
      if (!targetId) return;

      setLoading(true);
      setErrorMsg('');
      try {
        const res = await donorService.getMedicalReview(targetId, requestId);
        if (active) {
          setReview(res?.data || res || null);
        }
      } catch (err) {
        if (active) {
          setErrorMsg(err?.response?.data?.message || 'Could not load donor medical review.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchReview();
    return () => { active = false; };
  }, [donorId, donorSummary, requestId]);

  const donorName = review?.donorName || donorSummary?.name || 'Verified Voluntary Donor';
  const bloodGroup = review?.bloodGroup || donorSummary?.bloodGroup || 'O+';
  const verificationStatus = review?.donorVerificationStatus || donorSummary?.verificationStatus || 'VERIFIED';
  const medicalReviewStatus = review?.medicalReviewStatus || 'Pending Verification';
  const lastDonationDate = review?.lastDonationDate || donorSummary?.lastDonationDate;
  const totalDonations = review?.totalDonations ?? donorSummary?.totalDonations ?? 0;
  const healthDeclarationStatus = review?.healthDeclarationStatus || 'Declared & Signed';
  const eligibilityStatus = review?.medicalEligibilityStatus || 'Pending Medical Staff Review';
  const distanceKm = review?.distanceKm ?? donorSummary?.distanceKm;
  const approxLocation = review?.approximateLocation || {};
  const city = approxLocation.city || donorSummary?.city || '';
  const state = approxLocation.state || donorSummary?.state || '';

  return (
    <div className="bc-card p-4 bg-white border shadow-sm rounded-3 position-relative">
      {onClose && (
        <button
          type="button"
          className="btn-close position-absolute top-0 end-0 m-3"
          aria-label="Close"
          onClick={onClose}
        />
      )}

      {/* Header Profile Summary */}
      <div className="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom pe-4">
        <span className="blood-badge-pill" style={{ width: 50, height: 50, fontSize: '1.25rem' }}>
          {bloodGroup}
        </span>
        <div className="flex-grow-1">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <h5 className="fw-bold text-dark mb-0">{donorName}</h5>
            {verificationStatus === 'VERIFIED' && (
              <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5 small">
                <FaShieldAlt className="me-1" size={10} /> Verified Donor
              </span>
            )}
          </div>
          <div className="text-muted small d-flex flex-wrap align-items-center gap-2">
            {(city || state) && (
              <span className="d-inline-flex align-items-center gap-1">
                <FaMapMarkerAlt className="text-danger" size={11} /> {city}{state ? `, ${state}` : ''}
              </span>
            )}
            {distanceKm !== undefined && distanceKm !== null && (
              <span className="fw-semibold text-dark">
                &bull; ~{distanceKm} km away
              </span>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4 text-muted small">
          <div className="spinner-border spinner-border-sm text-danger me-2" role="status" />
          Loading clinical eligibility & medical clearance summary...
        </div>
      ) : errorMsg ? (
        <div className="alert alert-warning py-2 small mb-3">
          {errorMsg}
        </div>
      ) : (
        <>
          {/* Status Badges Grid */}
          <div className="row g-2 mb-3">
            <div className="col-sm-6">
              <div className="p-2.5 bg-light rounded-3 border h-100">
                <small className="text-muted d-block" style={{ fontSize: '11px' }}>
                  Medical Review Status
                </small>
                <div className="mt-1">
                  <span className={`badge rounded-pill px-2.5 py-1 ${getStatusBadgeClass(medicalReviewStatus)}`} style={{ fontSize: '12px' }}>
                    {getStatusIcon(medicalReviewStatus)} {medicalReviewStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="col-sm-6">
              <div className="p-2.5 bg-light rounded-3 border h-100">
                <small className="text-muted d-block" style={{ fontSize: '11px' }}>
                  Clinical Eligibility Assessment
                </small>
                <div className="mt-1 fw-bold text-dark small">
                  {eligibilityStatus}
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Clearance Details */}
          <div className="p-3 bg-light bg-opacity-50 rounded-3 border mb-3 small">
            <div className="row g-2">
              <div className="col-6">
                <span className="text-secondary d-block" style={{ fontSize: '11px' }}>
                  <FaCalendarAlt className="me-1 text-danger" /> Last Donation Date:
                </span>
                <strong className="text-dark">
                  {lastDonationDate ? new Date(lastDonationDate).toLocaleDateString() : 'First-time voluntary donor'}
                </strong>
              </div>

              <div className="col-6">
                <span className="text-secondary d-block" style={{ fontSize: '11px' }}>
                  <FaHistory className="me-1 text-danger" /> Total Completed Donations:
                </span>
                <strong className="text-dark">
                  {totalDonations} {totalDonations === 1 ? 'donation' : 'donations'}
                </strong>
              </div>

              <div className="col-12 pt-2 border-top">
                <span className="text-secondary d-block" style={{ fontSize: '11px' }}>
                  <FaFileContract className="me-1 text-danger" /> Health Declaration Status:
                </span>
                <span className={`badge rounded-pill px-2 py-0.5 mt-1 ${healthDeclarationStatus.includes('Declared') ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary'}`}>
                  {healthDeclarationStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Privacy & Clinical Protocol Disclaimer */}
          <div className="p-2.5 rounded-3 bg-light border small text-muted mb-3" style={{ fontSize: '0.78rem' }}>
            <div className="d-flex align-items-start gap-1.5">
              <FaStethoscope className="text-danger flex-shrink-0 mt-0.5" />
              <div>
                <strong>Clinical Safety Protocol:</strong> Sensitive medical history, current medications, and allergy records are restricted to authorized medical personnel. Final donor fitness is determined in-person at the clinical donation centre.
              </div>
            </div>
          </div>

          {/* Invitation Status or Invite Action */}
          <div className="d-flex justify-content-end gap-2 pt-1">
            {invitationStatus ? (
              <span className={`badge rounded-pill px-3 py-2 ${
                invitationStatus === 'ACCEPTED' ? 'bg-success text-white' :
                invitationStatus === 'REJECTED' || invitationStatus === 'DECLINED' ? 'bg-secondary text-white' :
                'bg-warning text-dark'
              }`}>
                Invitation Status: {invitationStatus}
              </span>
            ) : isInvited ? (
              <span className="badge bg-warning text-dark rounded-pill px-3 py-2">
                Invitation Dispatched
              </span>
            ) : onInvite ? (
              <button
                type="button"
                className="btn btn-blood btn-sm fw-bold px-3 py-1.5 rounded-pill d-inline-flex align-items-center gap-1.5 shadow-sm"
                onClick={() => onInvite(review || donorSummary)}
              >
                <FaPaperPlane size={11} /> Send Emergency Invitation
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

export default DonorMedicalReviewCard;
