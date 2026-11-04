import React, { useState, useEffect } from 'react';
import { screeningService } from '../../services/screeningService';
import StatusBadge from '../../components/common/StatusBadge';
import { 
  FaUserMd, 
  FaCheck, 
  FaClipboardList, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaSearch, 
  FaHandHoldingMedical 
} from 'react-icons/fa';

const MedicalScreeningsManagement = () => {
  const [screenings, setScreenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScreening, setSelectedScreening] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewDecision, setReviewDecision] = useState('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [hospitalInstructions, setHospitalInstructions] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Donation completion state
  const [confirmingDonation, setConfirmingDonation] = useState(false);
  const [unitsConfirmed, setUnitsConfirmed] = useState(1);
  const [completionNotes, setCompletionNotes] = useState('');

  const fetchScreenings = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await screeningService.getScreenings(params);
      if (res && res.data) {
        setScreenings(res.data);
      }
    } catch (err) {
      console.error('Failed to load screenings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScreenings();
  }, [filterStatus]);

  const openReviewModal = (screening) => {
    setSelectedScreening(screening);
    setReviewDecision(screening.medicalReview?.decision === 'DEFERRED' ? 'DEFERRED' : 'APPROVED');
    setReviewNotes(screening.medicalReview?.notes || '');
    setHospitalInstructions(
      screening.medicalReview?.hospitalInstructions || 
      'Please proceed to Room 104, Blood Bank Transfusion Desk. Present donor card & photo ID.'
    );
    setUnitsConfirmed(screening.unitsRequired || 1);
    setCompletionNotes(`Completed whole blood donation at ${screening.hospitalName}.`);
    setFeedback('');
    setErrorMsg('');
  };

  const closeReviewModal = () => {
    setSelectedScreening(null);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewNotes.trim()) {
      setErrorMsg('Clinical evaluation remarks / reviewer notes are required.');
      return;
    }

    setSubmittingReview(true);
    setErrorMsg('');
    try {
      const payload = {
        decision: reviewDecision,
        notes: reviewNotes.trim(),
        hospitalInstructions: hospitalInstructions.trim()
      };

      await screeningService.reviewScreening(selectedScreening.id, payload);
      setFeedback(`Medical eligibility decision recorded: ${reviewDecision}. Donor and requester notified.`);
      closeReviewModal();
      fetchScreenings();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit medical review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleConfirmDonation = async (screeningId) => {
    setConfirmingDonation(true);
    setErrorMsg('');
    try {
      await screeningService.confirmDonation(screeningId, {
        units: unitsConfirmed,
        notes: completionNotes
      });
      setFeedback('Hospital blood donation confirmed and logged in platform records.');
      closeReviewModal();
      fetchScreenings();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to confirm donation completion.');
    } finally {
      setConfirmingDonation(false);
    }
  };

  // Search filter
  const filteredScreenings = screenings.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.donorName && s.donorName.toLowerCase().includes(q)) ||
      (s.patientName && s.patientName.toLowerCase().includes(q)) ||
      (s.hospitalName && s.hospitalName.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q)) ||
      (s.bloodGroup && s.bloodGroup.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-2 border-bottom gap-2">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h2 className="fw-bold mb-0">Pre-Donation Medical Screenings</h2>
            <span className="badge bg-danger rounded-pill px-2.5 py-1">
              Authorized Clinical Review
            </span>
          </div>
          <p className="text-muted small mb-0">
            Review donor health disclosures, evaluate medical eligibility according to clinical guidelines, and record sign-off.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show small py-3 mb-4 shadow-sm border-0 border-start border-success border-4" role="alert">
          <FaCheckCircle className="me-2 text-success fs-5" /> {feedback}
          <button type="button" className="btn-close py-2.5" onClick={() => setFeedback('')} />
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show small py-3 mb-4 shadow-sm border-0 border-start border-danger border-4" role="alert">
          <FaExclamationTriangle className="me-2 text-danger fs-5" /> {errorMsg}
          <button type="button" className="btn-close py-2.5" onClick={() => setErrorMsg('')} />
        </div>
      )}

      {/* Clinical Guidance Banner */}
      <div className="alert alert-warning border mb-4 shadow-sm small">
        <div className="d-flex align-items-start gap-2">
          <FaUserMd className="text-warning-emphasis flex-shrink-0 fs-4 mt-0.5" />
          <div>
            <strong className="d-block text-dark">Medical Staff Clinical Assessment Standard</strong>
            The six-month period and reported answers are screening inquiries, not universal automatic disqualifiers. 
            Tattoos, recent illness, or medications must be clinically assessed against national transfusion safety standards by authorized medical personnel.
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bc-card p-3 bg-white mb-4 shadow-sm border">
        <div className="row g-2 align-items-center">
          <div className="col-md-5">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted border-end-0">
                <FaSearch size={12} />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search donor name, patient, hospital, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="col-md-4">
            <select
              className="form-select form-select-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Review Statuses</option>
              <option value="AWAITING_REVIEW">Awaiting Medical Review (Pending)</option>
              <option value="APPROVED">Medically Approved / Eligible</option>
              <option value="DEFERRED">Medically Deferred</option>
            </select>
          </div>

          <div className="col-md-3 text-md-end">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm w-100 w-md-auto"
              onClick={() => { setFilterStatus(''); setSearchQuery(''); }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Screenings Table */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status" />
          <p className="text-muted small mt-2">Loading medical screenings...</p>
        </div>
      ) : filteredScreenings.length === 0 ? (
        <div className="bc-card p-5 bg-white text-center rounded-3 border">
          <FaClipboardList className="text-muted mb-2" size={32} />
          <h5 className="fw-bold text-dark mb-1">No Health Screenings Found</h5>
          <p className="text-muted small mb-0">No screening records match the selected status or search term.</p>
        </div>
      ) : (
        <div className="bc-card bg-white shadow-sm overflow-hidden border">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Donor</th>
                  <th>Blood Group</th>
                  <th>Blood Request / Patient</th>
                  <th>Hospital & City</th>
                  <th>Flagged Disclosures</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredScreenings.map((s) => {
                  const isPending = s.status === 'AWAITING_REVIEW';

                  return (
                    <tr key={s.id} className={isPending ? 'table-warning bg-opacity-25' : ''}>
                      <td>
                        <div className="fw-bold text-dark">{s.donorName}</div>
                        <small className="text-muted">{s.donorPhone}</small>
                      </td>
                      <td>
                        <span className="blood-badge-pill" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                          {s.bloodGroup}
                        </span>
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{s.patientName}</div>
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle py-0.5" style={{ fontSize: '10px' }}>
                          {s.requestBloodGroup} Needed • {s.unitsRequired || 1} Unit(s)
                        </span>
                      </td>
                      <td>
                        <div className="text-dark">{s.hospitalName}</div>
                        <small className="text-muted">{s.city}{s.state ? `, ${s.state}` : ''}</small>
                      </td>
                      <td>
                        {s.hasFlaggedAnswers ? (
                          <span className="badge bg-warning text-dark border border-warning d-inline-flex align-items-center gap-1 py-1 px-2">
                            <FaExclamationTriangle size={10} /> Disclosures Provided
                          </span>
                        ) : (
                          <span className="badge bg-success-subtle text-success border border-success-subtle py-1 px-2">
                            All Answers "No"
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={s.status} />
                      </td>
                      <td>
                        <span className="text-muted">
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className={`btn btn-sm fw-bold px-3 py-1 rounded-pill shadow-sm d-inline-flex align-items-center gap-1 ${isPending ? 'btn-danger' : 'btn-outline-primary'}`}
                          onClick={() => openReviewModal(s)}
                        >
                          <FaUserMd size={12} /> {isPending ? 'Review & Decide' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MEDICAL REVIEW MODAL / DRAWER */}
      {selectedScreening && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-dark text-white py-3">
                <div className="d-flex align-items-center gap-2">
                  <FaUserMd className="text-danger fs-5" />
                  <div>
                    <h5 className="modal-title fw-bold mb-0">Pre-Donation Medical Review</h5>
                    <small className="text-light text-opacity-75">
                      Donor: {selectedScreening.donorName} ({selectedScreening.bloodGroup}) &rarr; Patient: {selectedScreening.patientName}
                    </small>
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={closeReviewModal} />
              </div>

              <div className="modal-body p-4 bg-light">
                {/* Request Context Bar */}
                <div className="p-3 bg-white rounded-3 border mb-3 small">
                  <div className="row g-2">
                    <div className="col-sm-4">
                      <strong className="text-muted d-block" style={{ fontSize: '11px' }}>HOSPITAL / FACILITY</strong>
                      <span className="text-dark fw-bold">{selectedScreening.hospitalName}</span>
                    </div>
                    <div className="col-sm-4">
                      <strong className="text-muted d-block" style={{ fontSize: '11px' }}>LOCATION & PHONE</strong>
                      <span className="text-dark">{selectedScreening.city} ({selectedScreening.contactNumber || selectedScreening.donorPhone})</span>
                    </div>
                    <div className="col-sm-4">
                      <strong className="text-muted d-block" style={{ fontSize: '11px' }}>STATUS</strong>
                      <StatusBadge status={selectedScreening.status} />
                    </div>
                  </div>
                </div>

                {/* 5 Questions Responses Section */}
                <div className="p-3.5 bg-white rounded-3 border mb-4">
                  <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                    <FaClipboardList className="text-danger" /> Donor Health Screening Answers
                  </h6>

                  <div className="d-flex flex-column gap-3 small">
                    {/* Q1 */}
                    <div className="p-3 bg-light rounded-3 border">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <strong className="text-dark">1. Health issues or illness during last 6 months?</strong>
                        <span className={`badge ${selectedScreening.answers?.healthIssues?.answer === 'YES' ? 'bg-danger text-white' : 'bg-success text-white'} px-2.5 py-1`}>
                          {selectedScreening.answers?.healthIssues?.answer || 'NO'}
                        </span>
                      </div>
                      {selectedScreening.answers?.healthIssues?.details && (
                        <div className="mt-2 p-2 bg-white rounded border text-danger">
                          <strong>Details:</strong> {selectedScreening.answers.healthIssues.details}
                        </div>
                      )}
                    </div>

                    {/* Q2 */}
                    <div className="p-3 bg-light rounded-3 border">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <strong className="text-dark">2. Medication recently or currently taking?</strong>
                        <span className={`badge ${selectedScreening.answers?.medications?.answer === 'YES' ? 'bg-danger text-white' : 'bg-success text-white'} px-2.5 py-1`}>
                          {selectedScreening.answers?.medications?.answer || 'NO'}
                        </span>
                      </div>
                      {selectedScreening.answers?.medications?.details && (
                        <div className="mt-2 p-2 bg-white rounded border text-danger">
                          <strong>Details:</strong> {selectedScreening.answers.medications.details}
                        </div>
                      )}
                    </div>

                    {/* Q3 */}
                    <div className="p-3 bg-light rounded-3 border">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <strong className="text-dark">3. Tattoo or piercing recently?</strong>
                        <span className={`badge ${selectedScreening.answers?.tattooPiercing?.answer === 'YES' ? 'bg-danger text-white' : 'bg-success text-white'} px-2.5 py-1`}>
                          {selectedScreening.answers?.tattooPiercing?.answer || 'NO'}
                        </span>
                      </div>
                      {selectedScreening.answers?.tattooPiercing?.details && (
                        <div className="mt-2 p-2 bg-white rounded border text-danger">
                          <strong>Details:</strong> {selectedScreening.answers.tattooPiercing.details}
                        </div>
                      )}
                    </div>

                    {/* Q4 */}
                    <div className="p-3 bg-light rounded-3 border">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <strong className="text-dark">4. Undergone recent surgery or medical procedure?</strong>
                        <span className={`badge ${selectedScreening.answers?.surgery?.answer === 'YES' ? 'bg-danger text-white' : 'bg-success text-white'} px-2.5 py-1`}>
                          {selectedScreening.answers?.surgery?.answer || 'NO'}
                        </span>
                      </div>
                      {selectedScreening.answers?.surgery?.details && (
                        <div className="mt-2 p-2 bg-white rounded border text-danger">
                          <strong>Details:</strong> {selectedScreening.answers.surgery.details}
                        </div>
                      )}
                    </div>

                    {/* Q5 */}
                    <div className="p-3 bg-light rounded-3 border">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <strong className="text-dark">5. Currently experiencing fever, infection, or feeling unwell?</strong>
                        <span className={`badge ${selectedScreening.answers?.feverInfection?.answer === 'YES' ? 'bg-danger text-white' : 'bg-success text-white'} px-2.5 py-1`}>
                          {selectedScreening.answers?.feverInfection?.answer || 'NO'}
                        </span>
                      </div>
                      {selectedScreening.answers?.feverInfection?.details && (
                        <div className="mt-2 p-2 bg-white rounded border text-danger">
                          <strong>Details:</strong> {selectedScreening.answers.feverInfection.details}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 text-muted" style={{ fontSize: '11px' }}>
                    <FaCheckCircle className="text-success me-1" />
                    Accuracy declaration confirmed by donor upon submission.
                  </div>
                </div>

                {/* Medical Review Decision Form */}
                <div className="p-4 bg-white rounded-3 border">
                  <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                    <FaUserMd className="text-primary" /> Record Medical Eligibility Decision
                  </h6>

                  <form onSubmit={handleSubmitReview}>
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-secondary">Clinical Decision *</label>
                      <div className="d-flex gap-3">
                        <div className="form-check form-check-inline p-2.5 border rounded-3 bg-light w-50">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="medicalDecision"
                            id="decApprove"
                            value="APPROVED"
                            checked={reviewDecision === 'APPROVED'}
                            onChange={(e) => setReviewDecision(e.target.value)}
                          />
                          <label className="form-check-label fw-bold text-success small" htmlFor="decApprove">
                            ● Approve as Medically Eligible
                          </label>
                          <small className="d-block text-muted ps-4" style={{ fontSize: '10px' }}>
                            Clears donor for hospital arrival & donation coordination
                          </small>
                        </div>

                        <div className="form-check form-check-inline p-2.5 border rounded-3 bg-light w-50">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="medicalDecision"
                            id="decDefer"
                            value="DEFERRED"
                            checked={reviewDecision === 'DEFERRED'}
                            onChange={(e) => setReviewDecision(e.target.value)}
                          />
                          <label className="form-check-label fw-bold text-danger small" htmlFor="decDefer">
                            ● Defer Donor
                          </label>
                          <small className="d-block text-muted ps-4" style={{ fontSize: '10px' }}>
                            Requires waiting period; request reopens for other donors
                          </small>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-bold text-secondary">Medical Reviewer Notes / Remarks *</label>
                      <textarea
                        rows={3}
                        className="form-control form-control-sm"
                        placeholder="e.g. Reviewed 2-month tattoo history. Under hospital protocol, sterile clinical ink technique confirmed; donor cleared for whole blood draw."
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        required
                      />
                      <small className="text-muted" style={{ fontSize: '11px' }}>
                        Visible to the donor and clinical audit staff.
                      </small>
                    </div>

                    {reviewDecision === 'APPROVED' && (
                      <div className="mb-3">
                        <label className="form-label small fw-bold text-secondary">Hospital Arrival Instructions & Preparation</label>
                        <textarea
                          rows={2}
                          className="form-control form-control-sm"
                          placeholder="e.g. Report to Room 104, Blood Bank Transfusion Desk. Fasting not required; bring government photo ID."
                          value={hospitalInstructions}
                          onChange={(e) => setHospitalInstructions(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={closeReviewModal}>
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-blood btn-sm fw-bold px-4"
                        disabled={submittingReview}
                      >
                        {submittingReview ? 'Recording Decision...' : 'Save Medical Decision'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* If already approved: Option to Confirm Donation Completion */}
                {selectedScreening.status === 'APPROVED' && (
                  <div className="p-3.5 bg-success-subtle rounded-3 border border-success-subtle mt-3">
                    <h6 className="fw-bold text-success mb-2 d-flex align-items-center gap-2">
                      <FaHandHoldingMedical /> Transfusion Conclusion: Confirm Donation Completed
                    </h6>
                    <p className="small text-secondary mb-3">
                      When the donor has reported to the hospital and successfully donated the blood units, record completion to generate verified certificates and update platform telemetry.
                    </p>
                    <div className="d-flex gap-2 align-items-center">
                      <button
                        type="button"
                        className="btn btn-success btn-sm fw-bold px-3 d-flex align-items-center gap-1.5 shadow-sm"
                        disabled={confirmingDonation}
                        onClick={() => handleConfirmDonation(selectedScreening.id)}
                      >
                        <FaCheck size={12} /> {confirmingDonation ? 'Confirming...' : 'Mark Donation as Completed'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalScreeningsManagement;
