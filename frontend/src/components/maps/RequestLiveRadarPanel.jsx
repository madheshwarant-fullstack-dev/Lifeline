import React, { useCallback, useEffect, useState } from 'react';
import {
  FaBroadcastTower,
  FaCheckCircle,
  FaExpandArrowsAlt,
  FaMapMarkedAlt,
  FaPaperPlane,
  FaSyncAlt,
  FaStethoscope,
} from 'react-icons/fa';
import { requestService } from '../../services/requestService';
import { useWebSocket } from '../../context/WebSocketContext';
import LiveDonorMap from './LiveDonorMap';
import ConfirmDialog from '../common/ConfirmDialog';
import DonorMedicalReviewCard from '../donor/DonorMedicalReviewCard';

const SEARCH_RADII_KM = [5, 10, 25, 50, 100];

const RequestLiveRadarPanel = ({ requestDoc }) => {
  const { connected, subscribe } = useWebSocket();
  const requestId = requestDoc?.id || requestDoc?._id;

  const [radiusKm, setRadiusKm] = useState(Number(requestDoc?.searchRadiusKm) || 25);
  const [donors, setDonors] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [compatibleGroups, setCompatibleGroups] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(requestDoc?.status || 'PENDING');
  const [reviewingDonor, setReviewingDonor] = useState(null);

  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [inviteConfirm, setInviteConfirm] = useState(null);
  const [statusConfirm, setStatusConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (requestDoc?.status) setCurrentStatus(requestDoc.status);
  }, [requestDoc?.status]);

  const loadRadar = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const [donRes, invRes] = await Promise.all([
        requestService.getHospitalRequestDonors(requestId, { radius_km: radiusKm }),
        requestService.getRequestInvitations(requestId).catch(() => ({ data: { invitations: [] } })),
      ]);
      const dData = donRes?.data || {};
      setDonors(dData.donors || []);
      setCompatibleGroups(dData.compatibleDonorGroups || []);
      setInvitations(invRes?.data?.invitations || []);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Could not load live nearby donor radar.');
    } finally {
      setLoading(false);
    }
  }, [requestId, radiusKm]);

  useEffect(() => {
    loadRadar();
  }, [loadRadar]);

  useEffect(() => {
    const u1 = subscribe('donor_location_updated', loadRadar);
    const u2 = subscribe('donor_location_stopped', loadRadar);
    const u3 = subscribe('donor_responded', loadRadar);
    const u4 = subscribe('request_status_updated', (p) => {
      if (p?.data?.requestId === requestId && p?.data?.status) {
        setCurrentStatus(p.data.status);
      }
      loadRadar();
    });
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [subscribe, loadRadar, requestId]);

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const executeInvite = async () => {
    if (!inviteConfirm || !requestId) return;
    setSubmitting(true);
    try {
      const res = await requestService.inviteDonors(requestId, {
        donorIds: inviteConfirm.donorIds,
        radiusKm,
      });
      setFeedback(`Invited ${res?.data?.invitedCount ?? inviteConfirm.donorIds.length} donor(s).`);
      setSelectedIds([]);
      setInviteConfirm(null);
      await loadRadar();
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to dispatch donor invitation.');
      setInviteConfirm(null);
    } finally {
      setSubmitting(false);
    }
  };

  const executeStatusPatch = async () => {
    if (!statusConfirm || !requestId) return;
    setSubmitting(true);
    try {
      await requestService.patchRequestStatus(requestId, statusConfirm);
      setCurrentStatus(statusConfirm);
      setFeedback(`Request status updated to ${statusConfirm}.`);
      setStatusConfirm(null);
      await loadRadar();
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to update status.');
      setStatusConfirm(null);
    } finally {
      setSubmitting(false);
    }
  };

  const nextRadius = SEARCH_RADII_KM.find((r) => r > radiusKm) || null;
  const hasCoords =
    Number.isFinite(Number(requestDoc?.lat)) && Number.isFinite(Number(requestDoc?.lng));

  return (
    <div className="bc-card p-4 bg-white mb-4 shadow-sm border">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h4 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
              <FaMapMarkedAlt className="text-danger" /> Live Geo-Radius Donor Radar
            </h4>
            <span
              className={`badge rounded-pill ${
                connected ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'
              }`}
            >
              <FaBroadcastTower size={10} className="me-1" />
              {connected ? 'Real-Time Sync' : 'Reconnecting'}
            </span>
          </div>
          <small className="text-muted">
            Verified, consented donors within {radiusKm} km{' '}
            {compatibleGroups.length > 0 && `• Compatible groups: ${compatibleGroups.join(', ')}`}
          </small>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <div className="btn-group btn-group-sm" role="group" aria-label="Search radius">
            {SEARCH_RADII_KM.map((r) => (
              <button
                key={r}
                type="button"
                className={`btn ${radiusKm === r ? 'btn-blood' : 'btn-outline-secondary'}`}
                onClick={() => setRadiusKm(r)}
              >
                {r} km
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-light border rounded-pill"
            onClick={loadRadar}
            title="Refresh live map"
          >
            <FaSyncAlt size={12} />
          </button>
          {!['DONATION_COMPLETED', 'CANCELLED', 'CLOSED'].includes(currentStatus) && (
            <button
              type="button"
              className="btn btn-sm btn-success rounded-pill fw-semibold"
              onClick={() => setStatusConfirm('DONATION_COMPLETED')}
            >
              <FaCheckCircle size={11} className="me-1" /> Complete Donation
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="alert alert-success py-2 small mb-3 d-flex justify-content-between align-items-center">
          <span>{feedback}</span>
          <button type="button" className="btn-close btn-sm" onClick={() => setFeedback('')} />
        </div>
      )}
      {errorMsg && (
        <div className="alert alert-danger py-2 small mb-3 d-flex justify-content-between align-items-center">
          <span>{errorMsg}</span>
          <button type="button" className="btn-close btn-sm" onClick={() => setErrorMsg('')} />
        </div>
      )}

      {!hasCoords && (
        <div className="alert alert-info py-2 small mb-3">
          Hospital GPS coordinates were not attached to this older request. Using default reference center for display.
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-7">
          <LiveDonorMap
            hospitalLat={requestDoc?.lat ?? 13.0633}
            hospitalLng={requestDoc?.lng ?? 80.2519}
            hospitalName={requestDoc?.hospitalName}
            radiusKm={radiusKm}
            donors={donors}
            invitations={invitations}
            selectedDonorIds={selectedIds}
            onToggleSelectDonor={handleToggleSelect}
            onReviewDonor={(donor) => setReviewingDonor(donor)}
            onInviteDonor={(donor) =>
              setInviteConfirm({
                donorIds: [donor.id || donor.donorId],
                label: `${donor.name || 'Donor'} (${donor.bloodGroup}, ~${donor.distanceKm} km)`,
              })
            }
            height={360}
          />
        </div>

        <div className="col-lg-5 d-flex flex-column">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong className="small text-secondary text-uppercase">
              Nearby Active Donors ({donors.length})
            </strong>
            {selectedIds.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-blood"
                onClick={() =>
                  setInviteConfirm({
                    donorIds: selectedIds,
                    label: `${selectedIds.length} selected donor(s)`,
                  })
                }
              >
                <FaPaperPlane size={10} className="me-1" /> Invite Selected ({selectedIds.length})
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-4 small text-muted">Scanning GPS donors...</div>
          ) : donors.length === 0 ? (
            <div className="p-4 bg-light rounded-3 border text-center my-auto">
              <p className="small text-muted mb-2">
                No active live-sharing compatible donors within {radiusKm} km.
              </p>
              {nextRadius && (
                <button
                  type="button"
                  className="btn btn-sm btn-blood"
                  onClick={() => setRadiusKm(nextRadius)}
                >
                  <FaExpandArrowsAlt size={11} className="me-1" /> Expand to {nextRadius} km
                </button>
              )}
            </div>
          ) : (
            <div className="d-flex flex-column gap-2" style={{ maxHeight: 330, overflowY: 'auto' }}>
              {donors.map((d) => {
                const dId = d.id || d.donorId;
                const inv = invitations.find((i) => i.donorId === dId || i.userId === d.userId);
                const status = inv?.status || d.invitationStatus;
                return (
                  <div key={dId} className="p-2.5 rounded-3 border bg-light d-flex justify-content-between align-items-center gap-2">
                    <div className="d-flex align-items-center gap-2">
                      {!status && (
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedIds.includes(dId)}
                          onChange={() => handleToggleSelect(dId)}
                        />
                      )}
                      <div>
                        <div className="small fw-bold text-dark">
                          {d.name} <span className="badge bg-danger ms-1">{d.bloodGroup}</span>
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                          {d.distanceKm} km away &bull; {d.exactMatch ? 'Exact Match' : 'Compatible'}
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-1.5">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-1 px-2"
                        title="Review Donor Medical Clearance"
                        onClick={() => setReviewingDonor(d)}
                      >
                        <FaStethoscope size={11} className="text-danger" />
                      </button>
                      {status ? (
                        <span
                          className={`badge rounded-pill ${
                            status === 'ACCEPTED'
                              ? 'bg-success'
                              : status === 'REJECTED' || status === 'DECLINED'
                              ? 'bg-secondary'
                              : 'bg-warning text-dark'
                          }`}
                        >
                          {status}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger py-1 px-2"
                          onClick={() =>
                            setInviteConfirm({
                              donorIds: [dId],
                              label: `${d.name} (${d.bloodGroup}, ~${d.distanceKm} km)`,
                            })
                          }
                        >
                          Invite
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {reviewingDonor && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', zIndex: 1060 }}
          tabIndex="-1"
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 520 }}>
            <div className="modal-content border-0 shadow-lg p-0" style={{ borderRadius: 16 }}>
              <DonorMedicalReviewCard
                donorId={reviewingDonor.id || reviewingDonor.donorId}
                donorSummary={reviewingDonor}
                requestId={requestId}
                onClose={() => setReviewingDonor(null)}
                onInvite={(d) => {
                  const id = d.id || d.donorId;
                  setReviewingDonor(null);
                  setInviteConfirm({
                    donorIds: [id],
                    label: `${d.name || d.donorName || 'Donor'} (${d.bloodGroup}, ~${d.distanceKm ?? ''} km)`,
                  });
                }}
                isInvited={invitations.some((i) => i.donorId === (reviewingDonor.id || reviewingDonor.donorId))}
                invitationStatus={
                  (invitations.find((i) => i.donorId === (reviewingDonor.id || reviewingDonor.donorId)) || {}).status
                }
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(inviteConfirm)}
        variant="info"
        title="Dispatch Emergency Donor Invitation?"
        message={`Send an immediate emergency blood invitation to ${inviteConfirm?.label}?`}
        confirmLabel="Send Invitation"
        loading={submitting}
        onConfirm={executeInvite}
        onCancel={() => setInviteConfirm(null)}
      />

      <ConfirmDialog
        open={Boolean(statusConfirm)}
        variant="info"
        title="Mark Donation Completed?"
        message={`Confirm that the emergency blood request for ${requestDoc?.patientName} has been fulfilled?`}
        confirmLabel="Confirm Completed"
        loading={submitting}
        onConfirm={executeStatusPatch}
        onCancel={() => setStatusConfirm(null)}
      />
    </div>
  );
};

export default RequestLiveRadarPanel;

