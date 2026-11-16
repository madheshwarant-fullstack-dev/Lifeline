import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../services/adminService';
import { donorService } from '../../services/donorService';
import { useWebSocket } from '../../context/WebSocketContext';
import { BLOOD_GROUPS, INDIAN_STATES, getCitiesByState } from '../../utils/constants';
import { FaBroadcastTower, FaCheck, FaTimes, FaClock, FaCheckCircle, FaExclamationCircle, FaNotesMedical, FaStethoscope, FaUserShield, FaWeight } from 'react-icons/fa';

const DonorsManagement = () => {
  const { subscribe } = useWebSocket();
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBg, setFilterBg] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Medical Profile Review Modal State
  const [medicalModalDonor, setMedicalModalDonor] = useState(null);
  const [medicalReviewLoading, setMedicalReviewLoading] = useState(false);
  const [medicalReviewData, setMedicalReviewData] = useState(null);
  const [newReviewStatus, setNewReviewStatus] = useState('VERIFIED');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const fetchDonors = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterBg) params.bloodGroup = filterBg;
      if (filterState) params.state = filterState;
      if (filterCity) params.city = filterCity;
      if (filterStatus) params.verificationStatus = filterStatus;

      const res = await adminService.getAdminDonors(params);
      const list = res?.data?.donors || res?.data || [];
      setDonors(list);
    } catch (e) {
      console.error('Failed to load donors:', e);
    } finally {
      setLoading(false);
    }
  }, [filterBg, filterState, filterCity, filterStatus]);

  useEffect(() => {
    fetchDonors();
  }, [fetchDonors]);

  useEffect(() => {
    const u1 = subscribe('donor_location_updated', fetchDonors);
    const u2 = subscribe('donor_location_stopped', fetchDonors);
    const u3 = subscribe('donor_availability_updated', fetchDonors);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [subscribe, fetchDonors]);

  const handleVerify = async (donorId, status) => {
    try {
      setFeedback('');
      setErrorMsg('');
      await adminService.verifyDonor(donorId, status);
      setFeedback(`Donor status updated to ${status}.`);
      fetchDonors();
    } catch (e) {
      setErrorMsg(e.response?.data?.message || 'Failed to update verification status.');
    }
  };

  const openMedicalReview = async (donor) => {
    setMedicalModalDonor(donor);
    setMedicalReviewLoading(true);
    setMedicalReviewData(null);
    setClinicalNotes('');
    setNewReviewStatus(donor.medicalReviewStatus || 'VERIFIED');
    try {
      const res = await donorService.getMedicalReview(donor.id);
      const data = res?.data || res;
      setMedicalReviewData(data);
      if (data?.rawMedicalReviewStatus) {
        setNewReviewStatus(data.rawMedicalReviewStatus);
      }
      if (data?.authorizedClinicalDetails?.clinicalNotes) {
        setClinicalNotes(data.authorizedClinicalDetails.clinicalNotes);
      }
    } catch (err) {
      console.error('Failed to load medical review:', err);
    } finally {
      setMedicalReviewLoading(false);
    }
  };

  const handleSaveMedicalReview = async (e) => {
    e.preventDefault();
    if (!medicalModalDonor) return;
    setSavingReview(true);
    setErrorMsg('');
    try {
      await adminService.updateDonorMedicalReview(medicalModalDonor.id, {
        status: newReviewStatus,
        clinicalNotes: clinicalNotes
      });
      setFeedback(`Medical clearance status for ${medicalModalDonor.name} updated to ${newReviewStatus.replace('_', ' ')}.`);
      setMedicalModalDonor(null);
      fetchDonors();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update medical review.');
    } finally {
      setSavingReview(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredDonors = donors.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.city && d.city.toLowerCase().includes(q)) ||
      (d.state && d.state.toLowerCase().includes(q)) ||
      (d.phone && d.phone.includes(q))
    );
  });

  const totalPages = Math.ceil(filteredDonors.length / itemsPerPage) || 1;
  const paginatedDonors = filteredDonors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">Donor Verification & Registry</h2>
          <p className="text-muted small mb-0">
            Review donor credentials, manage official verification status, and monitor cooldown metrics.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show small py-2.5 mb-4" role="alert">
          <FaCheckCircle className="me-2" /> {feedback}
          <button type="button" className="btn-close py-2.5" onClick={() => setFeedback('')} />
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show small py-2.5 mb-4" role="alert">
          <FaExclamationCircle className="me-2" /> {errorMsg}
          <button type="button" className="btn-close py-2.5" onClick={() => setErrorMsg('')} />
        </div>
      )}

      {/* Filters Bar */}
      <div className="bc-card p-3 bg-white mb-4 shadow-sm border">
        <div className="row g-2 align-items-center">
          <div className="col-md-3">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search donor name, city, phone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="col-sm-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={filterBg}
              onChange={(e) => {
                setFilterBg(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Blood Groups</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <div className="col-sm-6 col-md-3">
            <select
              className="form-select form-select-sm"
              value={filterState}
              onChange={(e) => {
                setFilterState(e.target.value);
                setFilterCity('');
                setCurrentPage(1);
              }}
            >
              <option value="">All Indian States</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="col-sm-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={filterCity}
              onChange={(e) => {
                setFilterCity(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Cities</option>
              {(filterState ? getCitiesByState(filterState) : getCitiesByState(null)).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="col-sm-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="VERIFIED">Verified Only</option>
              <option value="PENDING">Pending Review</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Donors Table */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status" />
          <p className="text-muted small mt-2">Loading donors...</p>
        </div>
      ) : filteredDonors.length === 0 ? (
        <div className="bc-card p-5 bg-white text-center rounded-3 border">
          <h5 className="fw-bold text-dark">No Donors Located</h5>
          <p className="text-muted small mb-0">Adjust filters or search query to see more results.</p>
        </div>
      ) : (
        <div className="bc-card bg-white shadow-sm overflow-hidden border">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Donor</th>
                  <th>Blood Group</th>
                  <th>Availability</th>
                  <th>Location</th>
                  <th>Medical Review</th>
                  <th>Last Donation</th>
                  <th>Total Donations</th>
                  <th>Verification</th>
                  <th className="text-end">Verification &amp; Clinical Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDonors.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong className="text-dark d-block">{d.name}</strong>
                      <span className="text-muted" style={{ fontSize: '11px' }}>{d.email} • {d.phone}</span>
                    </td>
                    <td>
                      <span className="blood-badge-pill" style={{ width: '30px', height: '30px', fontSize: '0.85rem' }}>
                        {d.bloodGroup}
                      </span>
                    </td>
                    <td>
                      <span className={`badge rounded-pill ${d.availability ? 'bg-success' : 'bg-secondary'}`}>
                        {d.availability ? 'Available' : 'Unavailable'}
                      </span>
                      {d.locationSharingEnabled && (
                        <div className="mt-1">
                          <span className="badge bg-info-subtle text-info border border-info-subtle" style={{ fontSize: '10px' }}>
                            <FaBroadcastTower size={9} className="me-1" /> Live GPS
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div><strong>{d.city}</strong>{d.state ? `, ${d.state}` : ''}</div>
                      <small className="text-muted">{d.address || '—'}</small>
                    </td>
                    <td>
                      {d.medicalReviewStatus === 'VERIFIED' ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          <FaCheck size={9} className="me-1" /> Cleared
                        </span>
                      ) : d.medicalReviewStatus === 'REQUIRES_ASSESSMENT' ? (
                        <span className="badge bg-info-subtle text-info border border-info-subtle">
                          Assessment Req.
                        </span>
                      ) : d.medicalReviewStatus === 'NOT_CLEARED' ? (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                          Not Cleared
                        </span>
                      ) : (
                        <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                          Pending Review
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="text-muted">
                        {d.lastDonationDate ? new Date(d.lastDonationDate).toLocaleDateString() : 'Never logged'}
                      </span>
                    </td>
                    <td>
                      <strong>{d.totalDonations || 0}</strong>
                    </td>
                    <td>
                      {d.verificationStatus === 'VERIFIED' ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          Verified
                        </span>
                      ) : d.verificationStatus === 'PENDING' ? (
                        <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                          Pending
                        </span>
                      ) : (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1 align-items-center">
                        <button
                          type="button"
                          className="btn btn-xs btn-sm btn-outline-danger py-1 px-2 fw-semibold d-flex align-items-center gap-1"
                          onClick={() => openMedicalReview(d)}
                          title="View Clinical Profile & Medical Clearance"
                        >
                          <FaNotesMedical size={11} /> Review
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-sm btn-success py-1 px-2 fw-bold d-flex align-items-center gap-1"
                          onClick={() => handleVerify(d.id, 'VERIFIED')}
                          title="Verify Donor"
                        >
                          <FaCheck size={10} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-sm btn-outline-warning text-dark py-1 px-2"
                          onClick={() => handleVerify(d.id, 'PENDING')}
                          title="Mark Pending"
                        >
                          <FaClock size={10} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-sm btn-outline-danger py-1 px-2"
                          onClick={() => handleVerify(d.id, 'REJECTED')}
                          title="Reject Donor"
                        >
                          <FaTimes size={10} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center p-3 border-top bg-light small">
              <span className="text-muted">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredDonors.length)} of {filteredDonors.length} donors
              </span>
              <div className="d-flex gap-1">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-2.5 py-1"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  &larr; Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    className={`btn btn-sm px-2.5 py-1 ${currentPage === pg ? 'btn-danger fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setCurrentPage(pg)}
                  >
                    {pg}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-2.5 py-1"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Medical Profile & Clearance Review Modal */}
      {medicalModalDonor && (
        <div 
          className="modal show d-block" 
          tabIndex="-1" 
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-3 overflow-hidden">
              <div className="modal-header text-white" style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' }}>
                <div className="d-flex align-items-center gap-2">
                  <div className="bg-white text-danger rounded-circle p-2 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '38px', height: '38px' }}>
                    <FaStethoscope size={18} />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-0">Donor Clinical Medical Review</h5>
                    <small className="text-white-50">
                      {medicalModalDonor.name} • Blood Group {medicalModalDonor.bloodGroup} • ID: {medicalModalDonor.id}
                    </small>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setMedicalModalDonor(null)}
                  disabled={savingReview}
                  aria-label="Close" 
                />
              </div>

              <div className="modal-body p-4 bg-light" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                {medicalReviewLoading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-danger" role="status" />
                    <p className="text-muted small mt-2">Loading clinical records and medical history...</p>
                  </div>
                ) : (
                  <>
                    <div className="alert alert-info border-info-subtle py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                      <FaUserShield className="text-info flex-shrink-0" size={16} />
                      <div>
                        <strong>Confidential Clinical Access:</strong> Full medical profile details are restricted to authorized medical officers and administrators for donation safety verification.
                      </div>
                    </div>

                    {/* Vitals & Clearance Summary */}
                    <div className="card border-0 shadow-sm rounded-3 mb-3">
                      <div className="card-body p-3">
                        <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                          <FaWeight className="text-danger" /> Physical Vitals &amp; Donation Activity
                        </h6>
                        <div className="row g-3 text-center">
                          <div className="col-6 col-md-3">
                            <div className="p-2 border rounded bg-light">
                              <small className="text-muted d-block">Age / Gender</small>
                              <strong className="text-dark">
                                {medicalReviewData?.authorizedClinicalDetails?.age || medicalModalDonor.age || '—'} yrs / {medicalReviewData?.authorizedClinicalDetails?.gender || medicalModalDonor.gender || '—'}
                              </strong>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div className="p-2 border rounded bg-light">
                              <small className="text-muted d-block">Recorded Weight</small>
                              <strong className="text-danger">
                                {medicalReviewData?.authorizedClinicalDetails?.weight ? `${medicalReviewData.authorizedClinicalDetails.weight} kg` : (medicalModalDonor.weight ? `${medicalModalDonor.weight} kg` : 'Not recorded')}
                              </strong>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div className="p-2 border rounded bg-light">
                              <small className="text-muted d-block">Last Donation</small>
                              <strong className="text-dark">
                                {medicalReviewData?.lastDonationDate ? new Date(medicalReviewData.lastDonationDate).toLocaleDateString() : 'Never logged'}
                              </strong>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div className="p-2 border rounded bg-light">
                              <small className="text-muted d-block">Health Declaration</small>
                              <span className={`badge ${medicalReviewData?.healthDeclarationStatus === 'Declared & Signed' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle'}`}>
                                {medicalReviewData?.healthDeclarationStatus || 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Clinical Declarations Card */}
                    <div className="card border-0 shadow-sm rounded-3 mb-3">
                      <div className="card-body p-3">
                        <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                          <FaNotesMedical className="text-primary" /> Self-Reported Clinical History
                        </h6>
                        <div className="row g-3 small">
                          <div className="col-md-6">
                            <div className="p-2.5 border rounded bg-white h-100">
                              <span className="fw-semibold text-secondary d-block mb-1">Medical Conditions &amp; Chronic History:</span>
                              <p className="mb-0 text-dark">
                                {medicalReviewData?.authorizedClinicalDetails?.medicalHistory || 'No chronic condition or major illness declared.'}
                              </p>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="p-2.5 border rounded bg-white h-100">
                              <span className="fw-semibold text-secondary d-block mb-1">Current Medication / Regimen:</span>
                              <p className="mb-0 text-dark">
                                {medicalReviewData?.authorizedClinicalDetails?.currentMedication || 'None declared.'}
                              </p>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="p-2.5 border rounded bg-white h-100">
                              <span className="fw-semibold text-secondary d-block mb-1">Known Allergies:</span>
                              <p className="mb-0 text-dark">
                                {medicalReviewData?.authorizedClinicalDetails?.allergies || 'No known allergies reported.'}
                              </p>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="p-2.5 border rounded bg-white h-100">
                              <span className="fw-semibold text-secondary d-block mb-1">Previous Donation Complications:</span>
                              <p className="mb-0 text-dark">
                                {medicalReviewData?.authorizedClinicalDetails?.previousComplications || 'No prior complications reported.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {medicalReviewData?.authorizedClinicalDetails?.reviewedBy && (
                          <div className="mt-3 p-2 border-start border-3 border-secondary bg-white small text-muted">
                            <strong>Previous Review:</strong> Evaluated by {medicalReviewData.authorizedClinicalDetails.reviewedBy} on{' '}
                            {medicalReviewData.authorizedClinicalDetails.reviewedAt ? new Date(medicalReviewData.authorizedClinicalDetails.reviewedAt).toLocaleString() : 'N/A'}.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Admin Evaluation Decision Form */}
                    <form onSubmit={handleSaveMedicalReview} className="card border-0 shadow-sm rounded-3">
                      <div className="card-body p-3">
                        <h6 className="fw-bold text-dark mb-2">Update Clinical Clearance &amp; Official Status</h6>
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-dark mb-1">Medical Review Clearance</label>
                            <select 
                              className="form-select form-select-sm"
                              value={newReviewStatus}
                              onChange={(e) => setNewReviewStatus(e.target.value)}
                              required
                            >
                              <option value="VERIFIED">VERIFIED — Medically Cleared for Donation</option>
                              <option value="PENDING">PENDING — Pending Verification / Documentation</option>
                              <option value="REQUIRES_ASSESSMENT">REQUIRES_ASSESSMENT — Requires On-Site Medical Check</option>
                              <option value="NOT_CLEARED">NOT_CLEARED — Not Cleared / Temporary Deferral</option>
                            </select>
                          </div>
                          <div className="col-12">
                            <label className="form-label small fw-semibold text-dark mb-1">
                              Clinical Assessment Notes &amp; Instructions <span className="text-muted fw-normal">(Shared with donor &amp; transfusion logs)</span>
                            </label>
                            <textarea 
                              className="form-control form-control-sm"
                              rows={3}
                              placeholder="e.g., Blood pressure & hemoglobin verified on site. Donor cleared for whole blood donation..."
                              value={clinicalNotes}
                              onChange={(e) => setClinicalNotes(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="d-flex justify-content-end gap-2 mt-3 pt-2 border-top">
                          <button 
                            type="button" 
                            className="btn btn-sm btn-outline-secondary px-3"
                            onClick={() => setMedicalModalDonor(null)}
                            disabled={savingReview}
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            className="btn btn-sm btn-danger px-4 fw-semibold d-flex align-items-center gap-1.5"
                            disabled={savingReview}
                          >
                            {savingReview ? (
                              <>
                                <span className="spinner-border spinner-border-sm" role="status" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <FaCheckCircle /> Save Clearance &amp; Notify
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonorsManagement;
