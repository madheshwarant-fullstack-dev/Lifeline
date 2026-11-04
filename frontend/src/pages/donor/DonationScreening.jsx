import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestService } from '../../services/requestService';
import { screeningService } from '../../services/screeningService';
import StatusBadge from '../../components/common/StatusBadge';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import { 
  FaHeartbeat, 
  FaHospital, 
  FaMapMarkerAlt, 
  FaPhoneAlt, 
  FaCheckCircle, 
  FaExclamationCircle, 
  FaArrowLeft, 
  FaShieldAlt, 
  FaInfoCircle, 
  FaFileMedicalAlt, 
  FaClipboardCheck 
} from 'react-icons/fa';

const QUESTIONS = [
  {
    id: 'healthIssues',
    num: 1,
    title: 'Health Issues & Illness',
    question: 'Have you experienced any health issues or illness during the last 6 months?',
    followUpLabel: 'Please describe the health issue, illness, symptoms, and duration:',
    followUpPlaceholder: 'e.g. Mild seasonal flu 2 months ago, fully recovered after 4 days'
  },
  {
    id: 'medications',
    num: 2,
    title: 'Current or Recent Medications',
    question: 'Have you taken any medication recently or are you currently taking medication?',
    followUpLabel: 'Please list medication name(s), purpose, dosage, and when you last took them:',
    followUpPlaceholder: 'e.g. Paracetamol 500mg taken 3 days ago for mild headache'
  },
  {
    id: 'tattooPiercing',
    num: 3,
    title: 'Tattoo or Piercing History',
    question: 'Have you had a tattoo or piercing recently?',
    followUpLabel: 'Please specify the approximate date of the tattoo/piercing and location or facility:',
    followUpPlaceholder: 'e.g. Ear piercing at licensed clinic on 15th January, fully healed'
  },
  {
    id: 'surgery',
    num: 4,
    title: 'Surgeries & Medical Procedures',
    question: 'Have you undergone any recent surgery or medical procedure?',
    followUpLabel: 'Please specify the surgery/procedure, hospital or clinic, and date performed:',
    followUpPlaceholder: 'e.g. Minor dental procedure 3 weeks ago'
  },
  {
    id: 'feverInfection',
    num: 5,
    title: 'Current Symptoms & Wellness',
    question: 'Are you currently experiencing fever, infection, or feeling unwell?',
    followUpLabel: 'Please describe your current symptoms, temperature, or infection details:',
    followUpPlaceholder: 'e.g. Low grade temperature (99°F) or sore throat since yesterday'
  }
];

const DonationScreening = () => {
  const { requestId } = useParams();

  const [requestDoc, setRequestDoc] = useState(null);
  const [existingScreening, setExistingScreening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form State
  const [answers, setAnswers] = useState({
    healthIssues: { answer: '', details: '' },
    medications: { answer: '', details: '' },
    tattooPiercing: { answer: '', details: '' },
    surgery: { answer: '', details: '' },
    feverInfection: { answer: '', details: '' }
  });

  const [declaration, setDeclaration] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [reqRes, scrRes] = await Promise.all([
          requestService.getRequestById(requestId).catch(() => null),
          screeningService.getScreeningByRequest(requestId).catch(() => null)
        ]);

        if (reqRes && reqRes.data) {
          setRequestDoc(reqRes.data);
        }

        if (scrRes && scrRes.data) {
          setExistingScreening(scrRes.data);
        }
      } catch (err) {
        console.error('Failed to load screening data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (requestId) {
      fetchData();
    }
  }, [requestId]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        answer: value,
        // Reset details if switched to NO
        details: value === 'NO' ? '' : prev[questionId].details
      }
    }));
    setFormError('');
  };

  const handleDetailsChange = (questionId, text) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        details: text
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    // Validation
    for (const q of QUESTIONS) {
      const qState = answers[q.id];
      if (!qState || !qState.answer) {
        setFormError(`Please answer Question #${q.num}: "${q.title}"`);
        return;
      }
      if (qState.answer === 'YES' && !qState.details.trim()) {
        setFormError(`Please provide additional details for Question #${q.num} ("${q.title}")`);
        return;
      }
    }

    if (!declaration) {
      setFormError('You must confirm the accuracy declaration before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        requestId,
        answers,
        declaration: true
      };

      const res = await screeningService.submitScreening(payload);
      if (res && res.data) {
        setExistingScreening(res.data);
        setFormSuccess('Screening Submitted – Awaiting Medical Review.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit health screening. Please check form inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status" />
        <p className="text-muted small mt-2">Loading pre-donation screening information...</p>
      </div>
    );
  }

  if (!requestDoc) {
    return (
      <div className="bc-card p-5 bg-white text-center rounded-3 border">
        <FaExclamationCircle className="text-warning mb-2" size={32} />
        <h5 className="fw-bold text-dark">Blood Request Not Found</h5>
        <p className="text-muted small">The requested blood donation request could not be located.</p>
        <Link to="/donor/available-requests" className="btn btn-outline-secondary btn-sm">
          &larr; Back to Available Requests
        </Link>
      </div>
    );
  }

  const isEmergency = requestDoc.urgency === 'EMERGENCY';

  return (
    <div className="container-fluid p-0" style={{ maxWidth: '900px' }}>
      {/* Top Breadcrumb */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <Link to="/donor/dashboard" className="btn btn-outline-secondary btn-sm rounded-pill d-inline-flex align-items-center gap-1.5">
          <FaArrowLeft size={11} /> Back to Dashboard
        </Link>
        <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-3 py-1.5 fw-semibold small">
          Step: Pre-Donation Health Screening
        </span>
      </div>

      {formSuccess && (
        <div className="alert alert-success d-flex align-items-center gap-2 small py-3 mb-4 shadow-sm border-0 border-start border-success border-4" role="alert">
          <FaCheckCircle className="text-success flex-shrink-0 fs-5" />
          <div>
            <strong className="d-block text-dark">Screening Submitted Successfully</strong>
            {formSuccess} Authorized hospital medical staff will review your responses.
          </div>
        </div>
      )}

      {formError && (
        <div className="alert alert-danger d-flex align-items-center gap-2 small py-3 mb-4 shadow-sm border-0 border-start border-danger border-4" role="alert">
          <FaExclamationCircle className="text-danger flex-shrink-0 fs-5" />
          <div>
            <strong className="d-block text-danger">Please review your submission:</strong>
            {formError}
          </div>
        </div>
      )}

      {/* 1. MATCHING BLOOD REQUEST DETAILS CARD */}
      <div className={`bc-card p-4 bg-white mb-4 shadow-sm border ${isEmergency ? 'border-2 border-danger' : ''}`}>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3 pb-3 mb-3 border-bottom">
          <div className="d-flex align-items-center gap-3">
            <span className="blood-badge-pill flex-shrink-0" style={{ width: '54px', height: '54px', fontSize: '1.35rem' }}>
              {requestDoc.bloodGroup}
            </span>
            <div>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <h4 className="fw-bold text-dark mb-0">{requestDoc.patientName}</h4>
                <UrgencyBadge urgency={requestDoc.urgency} />
              </div>
              <small className="text-muted">
                Required Units: <strong className="text-dark">{requestDoc.unitsRequired} unit(s)</strong> • Date: <strong className="text-dark">{requestDoc.requiredDate}</strong>
              </small>
            </div>
          </div>
          <div>
            <StatusBadge status={requestDoc.status} />
          </div>
        </div>

        {/* Hospital & Coordination Info Grid */}
        <div className="row g-3 small">
          <div className="col-md-4">
            <div className="p-3 bg-light rounded-3 h-100 border border-light-subtle">
              <span className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Hospital / Transfusion Center</span>
              <strong className="text-dark d-flex align-items-center gap-1.5">
                <FaHospital className="text-secondary flex-shrink-0" /> {requestDoc.hospitalName}
              </strong>
            </div>
          </div>
          <div className="col-md-4">
            <div className="p-3 bg-light rounded-3 h-100 border border-light-subtle">
              <span className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Hospital Address & City</span>
              <strong className="text-dark d-flex align-items-center gap-1.5">
                <FaMapMarkerAlt className="text-danger flex-shrink-0" /> {requestDoc.city}{requestDoc.state ? `, ${requestDoc.state}` : ''} ({requestDoc.hospitalAddress || 'Address on file'})
              </strong>
            </div>
          </div>
          <div className="col-md-4">
            <div className="p-3 bg-light rounded-3 h-100 border border-light-subtle">
              <span className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Coordination Contact</span>
              <strong className="text-dark d-flex align-items-center gap-1.5">
                <FaPhoneAlt className="text-secondary flex-shrink-0" /> {requestDoc.contactNumber || requestDoc.requesterPhone || 'Via Lifeline Desk'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. IF SCREENING IS ALREADY SUBMITTED: SHOW STATUS, NEXT STEPS & COORDINATION */}
      {existingScreening ? (
        <div className="bc-card p-4 p-md-5 bg-white shadow-sm border mb-4">
          <div className="text-center py-3 mb-4 border-bottom">
            <div className="d-inline-flex p-3 rounded-circle bg-info bg-opacity-10 text-primary mb-3">
              <FaClipboardCheck size={42} className="text-primary" />
            </div>

            {existingScreening.status === 'AWAITING_REVIEW' && (
              <>
                <h3 className="fw-bold text-dark mb-2">Screening Submitted – Awaiting Medical Review</h3>
                <p className="text-muted small mx-auto mb-2" style={{ maxWidth: '640px' }}>
                  Thank you for submitting your pre-donation health responses. Authorized medical staff at the hospital are reviewing your screening against clinical blood donation standards.
                </p>
                <span className="badge bg-warning text-dark px-3 py-2 rounded-pill fw-bold">
                  Status: Under Medical Review
                </span>
              </>
            )}

            {existingScreening.status === 'APPROVED' && (
              <>
                <h3 className="fw-bold text-success mb-2">Medically Cleared for Donation</h3>
                <p className="text-muted small mx-auto mb-2" style={{ maxWidth: '640px' }}>
                  An authorized medical officer has reviewed your responses and cleared you for blood donation.
                </p>
                <span className="badge bg-success text-white px-3 py-2 rounded-pill fw-bold">
                  Status: Medically Approved & Ready for Coordination
                </span>
              </>
            )}

            {existingScreening.status === 'DEFERRED' && (
              <>
                <h3 className="fw-bold text-danger mb-2">Medical Review Guidance: Deferral</h3>
                <p className="text-muted small mx-auto mb-2" style={{ maxWidth: '640px' }}>
                  Thank you for your noble intent to donate. In accordance with blood donation safety guidelines, our medical staff have recommended deferral at this time.
                </p>
                <span className="badge bg-danger text-white px-3 py-2 rounded-pill fw-bold">
                  Status: Medically Deferred
                </span>
              </>
            )}
          </div>

          {/* Hospital Coordination Next Steps Box */}
          <div className="p-4 rounded-3 bg-light border mb-4">
            <h5 className="fw-bold text-dark d-flex align-items-center gap-2 mb-3">
              <FaHospital className="text-danger" /> Hospital Coordination & Next Steps
            </h5>

            {existingScreening.status === 'AWAITING_REVIEW' && (
              <div className="small text-secondary">
                <p className="mb-2">
                  <strong>1. Medical Evaluation:</strong> Medical staff will review any reported conditions, recent medications, or procedures.
                </p>
                <p className="mb-2">
                  <strong>2. Hospital Coordination Desk:</strong> Once authorized, you will receive confirmation and hospital coordination instructions on your dashboard.
                </p>
                <p className="mb-0">
                  <strong>3. Preparation Reminder:</strong> Please stay well-hydrated, consume a light and nutritious meal, and avoid heavy strenuous workouts before reporting to the hospital blood bank.
                </p>
              </div>
            )}

            {existingScreening.status === 'APPROVED' && (
              <div className="small">
                <div className="alert alert-success d-flex align-items-start gap-2 mb-3">
                  <FaCheckCircle className="text-success mt-1 flex-shrink-0" />
                  <div>
                    <strong>Hospital Instructions:</strong>
                    <div className="mt-1">
                      {existingScreening.medicalReview?.hospitalInstructions || 
                        "Please proceed directly to the blood transfusion department. Present your government photo ID and reference this request ID."}
                    </div>
                  </div>
                </div>
                {existingScreening.medicalReview?.notes && (
                  <div className="p-3 bg-white rounded border mb-3">
                    <strong>Medical Officer Remarks:</strong>
                    <div className="text-muted mt-1">{existingScreening.medicalReview.notes}</div>
                    <small className="text-muted d-block mt-1">
                      Reviewed by: {existingScreening.medicalReview.reviewedBy || 'Authorized Medical Officer'}
                    </small>
                  </div>
                )}
                <div className="row g-2 text-muted">
                  <div className="col-sm-6">
                    <strong>Hospital Name:</strong> {requestDoc.hospitalName}
                  </div>
                  <div className="col-sm-6">
                    <strong>Coordination Desk:</strong> {requestDoc.contactNumber}
                  </div>
                </div>
              </div>
            )}

            {existingScreening.status === 'DEFERRED' && (
              <div className="small text-secondary">
                <div className="alert alert-warning border mb-3">
                  <strong>Clinical Remarks:</strong>
                  <div className="mt-1">
                    {existingScreening.medicalReview?.notes || "Medical guidelines require a waiting period based on the answers provided."}
                  </div>
                  <small className="text-muted d-block mt-2">
                    Evaluated by: {existingScreening.medicalReview?.reviewedBy || 'Medical Review Team'}
                  </small>
                </div>
                <p className="mb-0">
                  Donation safety rules exist to protect both recipient health and donor well-being. Lifeline will notify you when you become eligible to donate again.
                </p>
              </div>
            )}
          </div>

          {/* Submitted Responses Accordion / Summary */}
          <div className="border rounded-3 p-3.5 bg-white">
            <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <FaFileMedicalAlt className="text-primary" /> Your Submitted Pre-Donation Answers
            </h6>
            <div className="d-flex flex-column gap-3 small">
              {QUESTIONS.map((q) => {
                const ansObj = existingScreening.answers?.[q.id] || {};
                const isYes = ansObj.answer === 'YES';
                return (
                  <div key={q.id} className="p-3 bg-light rounded-3 border">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                      <strong className="text-dark">
                        {q.num}. {q.question}
                      </strong>
                      <span className={`badge ${isYes ? 'bg-warning text-dark' : 'bg-success text-white'} px-2.5 py-1`}>
                        {ansObj.answer || 'Not recorded'}
                      </span>
                    </div>
                    {isYes && ansObj.details && (
                      <div className="mt-2 p-2 bg-white rounded border text-secondary" style={{ fontSize: '0.85rem' }}>
                        <span className="fw-semibold text-dark">Details provided: </span> {ansObj.details}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-top d-flex justify-content-between align-items-center text-muted small">
              <span>
                <FaShieldAlt className="text-success me-1" /> Declaration signed on {new Date(existingScreening.createdAt).toLocaleString()}
              </span>
              <Link to="/donor/dashboard" className="btn btn-blood btn-sm fw-semibold rounded-pill px-3">
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* 3. SHOW SCREENING FORM (WHEN DONOR HAS NOT SUBMITTED YET) */
        <div className="bc-card p-4 p-md-5 bg-white shadow-sm border mb-4">
          <div className="mb-4 pb-3 border-bottom">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="blood-badge-pill p-2" style={{ width: '38px', height: '38px', fontSize: '1rem' }}>
                <FaHeartbeat />
              </span>
              <h3 className="fw-bold text-dark mb-0">Pre-Donation Health Screening</h3>
            </div>
            <p className="text-muted small mb-0">
              Please answer the following standard medical screening questions honestly before proceeding to donate. Authorized medical personnel will evaluate your responses in accordance with blood donation safety standards.
            </p>
          </div>

          <div className="alert alert-info d-flex align-items-center gap-2 small py-2.5 mb-4" role="alert">
            <FaInfoCircle className="flex-shrink-0 text-primary" size={16} />
            <div>
              <strong>Clinical Disclosure Notice:</strong> Answering "Yes" to any question will open a field to provide details for review. Answers are evaluated by authorized medical staff and do not automatically exclude you.
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="d-flex flex-column gap-4 mb-4">
              {QUESTIONS.map((q) => {
                const currentAnswer = answers[q.id]?.answer;
                const currentDetails = answers[q.id]?.details;
                const isYes = currentAnswer === 'YES';
                const isNo = currentAnswer === 'NO';

                return (
                  <div key={q.id} className="p-3.5 p-md-4 rounded-3 border bg-light-subtle transition-all shadow-sm">
                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 mb-2">
                      <div className="pe-sm-3">
                        <span className="badge bg-secondary-subtle text-secondary mb-1 fw-bold" style={{ fontSize: '11px' }}>
                          Question #{q.num} • {q.title}
                        </span>
                        <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '0.98rem', lineHeight: '1.4' }}>
                          {q.question}
                        </h6>
                      </div>

                      {/* Yes / No Toggle Buttons */}
                      <div className="btn-group flex-shrink-0" role="group" aria-label={`Question ${q.num} answer`}>
                        <button
                          type="button"
                          className={`btn btn-sm px-3 py-1.5 fw-bold ${isYes ? 'btn-danger shadow-sm' : 'btn-outline-secondary bg-white'}`}
                          onClick={() => handleAnswerChange(q.id, 'YES')}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm px-3 py-1.5 fw-bold ${isNo ? 'btn-success shadow-sm' : 'btn-outline-secondary bg-white'}`}
                          onClick={() => handleAnswerChange(q.id, 'NO')}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    {/* Conditional Follow-up Field for "YES" */}
                    {isYes && (
                      <div className="mt-3 pt-3 border-top">
                        <label className="form-label small fw-bold text-danger d-flex align-items-center gap-1.5 mb-1.5">
                          <FaInfoCircle size={13} /> {q.followUpLabel} *
                        </label>
                        <textarea
                          rows={2}
                          className="form-control form-control-sm border-danger bg-white shadow-sm"
                          placeholder={q.followUpPlaceholder}
                          value={currentDetails}
                          onChange={(e) => handleDetailsChange(q.id, e.target.value)}
                          required
                        />
                        <small className="text-muted mt-1 d-block" style={{ fontSize: '11px' }}>
                          Please be as specific as possible (dates, condition, medication names) to aid medical assessment.
                        </small>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Declaration Checkbox */}
            <div className="p-3.5 bg-light rounded-3 border mb-4">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="screeningDeclaration"
                  checked={declaration}
                  onChange={(e) => setDeclaration(e.target.checked)}
                  required
                />
                <label className="form-check-label fw-bold text-dark small" htmlFor="screeningDeclaration">
                  "I confirm that the information I have provided is accurate to the best of my knowledge."
                </label>
              </div>
              <small className="text-muted d-block mt-2 ps-4" style={{ fontSize: '11px' }}>
                <FaShieldAlt className="text-secondary me-1" />
                Medical Privacy Guarantee: Your screening responses are saved securely, encrypted, and accessible solely to authorized hospital medical staff.
              </small>
            </div>

            {/* Action Buttons */}
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3 pt-2">
              <Link to="/donor/available-requests" className="btn btn-outline-secondary btn-sm px-4 py-2 fw-semibold order-2 order-sm-1">
                Cancel & Return
              </Link>
              <button
                type="submit"
                className="btn btn-blood fw-bold px-4 py-2.5 shadow-sm d-flex align-items-center gap-2 order-1 order-sm-2 w-100 w-sm-auto justify-content-center"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" />
                    Submitting Screening for Review...
                  </>
                ) : (
                  <>
                    <FaCheckCircle size={15} /> Submit Screening
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <DisclaimerAlert />
    </div>
  );
};

export default DonationScreening;
