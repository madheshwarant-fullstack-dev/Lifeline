import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBroadcastTower,
  FaCheckCircle,
  FaExpandArrowsAlt,
  FaHospital,
  FaLocationArrow,
  FaMapMarkedAlt,
  FaPaperPlane,
  FaPlusCircle,
  FaShieldAlt,
  FaSyncAlt,
  FaTint,
  FaUsers,
  FaStethoscope,
} from 'react-icons/fa';
import { requestService } from '../../services/requestService';
import { donorService } from '../../services/donorService';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import LiveDonorMap from '../../components/maps/LiveDonorMap';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import DonorMedicalReviewCard from '../../components/donor/DonorMedicalReviewCard';
import StatusBadge from '../../components/common/StatusBadge';
import UrgencyBadge from '../../components/common/UrgencyBadge';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';

const SEARCH_RADII_KM = [5, 10, 25, 50, 100];

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
};

const HospitalDashboard = () => {
  const { user } = useAuth();
  const { connected: wsConnected, subscribe } = useWebSocket();

  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [radiusKm, setRadiusKm] = useState(25);
  const [nearbyDonors, setNearbyDonors] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [compatibleGroups, setCompatibleGroups] = useState([]);
  const [selectedDonorIds, setSelectedDonorIds] = useState([]);
  const [reviewingDonor, setReviewingDonor] = useState(null);

  // Standalone radar coordinates if no request created yet or quick scan
  const [radarBloodGroup, setRadarBloodGroup] = useState('O+');
  const [hospitalCoords, setHospitalCoords] = useState({
    lat: user?.lat ?? 13.0633,
    lng: user?.lng ?? 80.2519,
  });

  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingDonors, setLoadingDonors] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Confirmation <dialog> states
  const [inviteDialog, setInviteDialog] = useState(null); // { donorIds: [], label: '' }
  const [statusDialog, setStatusDialog] = useState(null); // { requestId, status, label }
  const [submittingAction, setSubmittingAction] = useState(false);

  const selectedRequest = useMemo(
    () => requests.find((r) => (r.id || r._id) === selectedRequestId) || null,
    [requests, selectedRequestId]
  );

  const fetchRequests = useCallback(async () => {
    try {
      const res = await requestService.getHospitalRequests();
      const list = res?.data?.requests || res?.data || [];
      setRequests(list);
      if (list.length > 0) {
        setSelectedRequestId((prev) => {
          if (prev && list.some((r) => (r.id || r._id) === prev)) return prev;
          const active = list.find(
            (r) => !['DONATION_COMPLETED', 'CANCELLED', 'CLOSED'].includes(r.status)
          );
          return (active || list[0]).id || (active || list[0])._id;
        });
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to load hospital blood requests.');
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const fetchNearbyAndInvites = useCallback(
    async (reqObj, targetRadius) => {
      setLoadingDonors(true);
      setErrorMsg('');
      try {
        if (reqObj) {
          const rId = reqObj.id || reqObj._id;
          const [donRes, invRes] = await Promise.all([
            requestService.getHospitalRequestDonors(rId, { radius_km: targetRadius }),
            requestService.getRequestInvitations(rId).catch(() => ({ data: { invitations: [] } })),
          ]);
          const data = donRes?.data || {};
          setNearbyDonors(data.donors || []);
          setCompatibleGroups(data.compatibleDonorGroups || []);
          setInvitations(invRes?.data?.invitations || []);
          if (Number.isFinite(Number(reqObj.lat)) && Number.isFinite(Number(reqObj.lng))) {
            setHospitalCoords({ lat: Number(reqObj.lat), lng: Number(reqObj.lng) });
          }
        } else {
          const donRes = await donorService.getNearbyDonors({
            bloodGroup: radarBloodGroup,
            lat: hospitalCoords.lat,
            lng: hospitalCoords.lng,
            radiusKm: targetRadius,
          });
          const data = donRes?.data || {};
          setNearbyDonors(data.donors || []);
          setCompatibleGroups(data.compatibleDonorGroups || []);
          setInvitations([]);
        }
      } catch (err) {
        const detail = err?.response?.data?.detail;
        setErrorMsg(detail || 'Unable to scan nearby verified donors.');
        setNearbyDonors([]);
      } finally {
        setLoadingDonors(false);
      }
    },
    [radarBloodGroup, hospitalCoords.lat, hospitalCoords.lng]
  );

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!loadingRequests) {
      fetchNearbyAndInvites(selectedRequest, radiusKm);
    }
  }, [loadingRequests, selectedRequest, radiusKm, fetchNearbyAndInvites]);

  // Real-Time WebSocket subscriptions for live map & response sync
  useEffect(() => {
    const activeLat = Number(selectedRequest?.lat ?? hospitalCoords.lat);
    const activeLng = Number(selectedRequest?.lng ?? hospitalCoords.lng);

    const unsubMoved = subscribe('donor_location_updated', (payload) => {
      const d = payload?.data;
      if (!d?.donorId) return;
      setNearbyDonors((prev) => {
        const idx = prev.findIndex((item) => (item.id || item.donorId) === d.donorId);
        if (idx === -1) {
          // Reload in case this donor just entered our compatible search radius
          fetchNearbyAndInvites(selectedRequest, radiusKm);
          return prev;
        }
        const nextDist =
          Number.isFinite(activeLat) && Number.isFinite(activeLng) && d.approxLat && d.approxLng
            ? haversineKm(activeLat, activeLng, d.approxLat, d.approxLng)
            : prev[idx].distanceKm;

        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          approxLat: d.approxLat,
          approxLng: d.approxLng,
          lastLocationUpdatedAt: d.lastLocationUpdatedAt,
          distanceKm: nextDist,
        };
        updated.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
        return updated;
      });
    });

    const unsubStopped = subscribe('donor_location_stopped', (payload) => {
      const donorId = payload?.data?.donorId;
      if (!donorId) return;
      setNearbyDonors((prev) => prev.filter((item) => (item.id || item.donorId) !== donorId));
      setSelectedDonorIds((prev) => prev.filter((id) => id !== donorId));
    });

    const unsubResponded = subscribe('donor_responded', () => {
      fetchRequests();
      fetchNearbyAndInvites(selectedRequest, radiusKm);
    });

    const unsubStatus = subscribe('request_status_updated', () => {
      fetchRequests();
      fetchNearbyAndInvites(selectedRequest, radiusKm);
    });

    return () => {
      unsubMoved();
      unsubStopped();
      unsubResponded();
      unsubStatus();
    };
  }, [subscribe, selectedRequest, radiusKm, hospitalCoords.lat, hospitalCoords.lng, fetchRequests, fetchNearbyAndInvites]);

  const handleUseBrowserGps = () => {
    if (!navigator?.geolocation) {
      setErrorMsg('Browser Geolocation is not available.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHospitalCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setFeedback('Hospital radar coordinates updated from current browser GPS.');
      },
      () => {
        setErrorMsg('Could not access browser GPS for hospital coordinates.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleSelectDonor = (donorId) => {
    setSelectedDonorIds((prev) =>
      prev.includes(donorId) ? prev.filter((id) => id !== donorId) : [...prev, donorId]
    );
  };

  const executeInviteConfirm = async () => {
    if (!inviteDialog || !selectedRequest) return;
    setSubmittingAction(true);
    setErrorMsg('');
    try {
      const rId = selectedRequest.id || selectedRequest._id;
      const res = await requestService.inviteDonors(rId, {
        donorIds: inviteDialog.donorIds,
        radiusKm,
      });
      const count = res?.data?.invitedCount ?? inviteDialog.donorIds.length;
      setFeedback(`Emergency blood invitation sent to ${count} compatible nearby donor(s).`);
      setSelectedDonorIds([]);
      setInviteDialog(null);
      await Promise.all([fetchRequests(), fetchNearbyAndInvites(selectedRequest, radiusKm)]);
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to send emergency invitations.');
      setInviteDialog(null);
    } finally {
      setSubmittingAction(false);
    }
  };

  const executeStatusConfirm = async () => {
    if (!statusDialog) return;
    setSubmittingAction(true);
    setErrorMsg('');
    try {
      await requestService.patchRequestStatus(statusDialog.requestId, statusDialog.status);
      setFeedback(`Blood request marked as ${statusDialog.status}.`);
      setStatusDialog(null);
      await fetchRequests();
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to update request status.');
      setStatusDialog(null);
    } finally {
      setSubmittingAction(false);
    }
  };

  const nextLargerRadius = SEARCH_RADII_KM.find((r) => r > radiusKm) || null;
  const activeMapLat = selectedRequest?.lat ?? hospitalCoords.lat;
  const activeMapLng = selectedRequest?.lng ?? hospitalCoords.lng;

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-3 py-1">
              <FaHospital className="me-1" /> Hospital Command Portal
            </span>
            <span
              className={`badge rounded-pill ${
                wsConnected ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'
              }`}
            >
              <FaBroadcastTower size={10} className="me-1" />
              {wsConnected ? 'Live Map Feed Connected' : 'Connecting Live Feed...'}
            </span>
          </div>
          <h2 className="fw-bold mb-1">Emergency Blood Request & Live Donor Radar</h2>
          <p className="text-muted small mb-0">
            Search verified, consented nearby donors with RBC compatibility rules, track live positions, and dispatch invitations.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm rounded-pill px-3 d-inline-flex align-items-center gap-1"
            onClick={() => {
              fetchRequests();
              fetchNearbyAndInvites(selectedRequest, radiusKm);
            }}
          >
            <FaSyncAlt size={12} /> Refresh
          </button>
          <Link to="/requests/new" className="btn btn-blood btn-sm d-inline-flex align-items-center gap-2 shadow-sm">
            <FaPlusCircle /> New Emergency Request
          </Link>
        </div>
      </div>

      {user?.isVerified === false && (
        <div className="alert alert-warning border-warning small mb-4">
          <FaShieldAlt className="me-2" />
          <strong>Verification Pending:</strong> Your hospital account is awaiting administrator verification. Verified status is required to access live donor maps and create emergency requests.
        </div>
      )}

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show small py-2.5 mb-3">
          <FaCheckCircle className="me-2" /> {feedback}
          <button type="button" className="btn-close py-2.5" onClick={() => setFeedback('')} />
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show small py-2.5 mb-3">
          {errorMsg}
          <button type="button" className="btn-close py-2.5" onClick={() => setErrorMsg('')} />
        </div>
      )}

      {/* Request Selector + Radius Configuration Toolbar */}
      <div className="bc-card p-3 bg-white mb-4 shadow-sm border">
        <div className="row g-3 align-items-end">
          <div className="col-lg-5">
            <label htmlFor="hospital-active-request-select" className="form-label small fw-bold text-secondary mb-1">
              Active Emergency Request
            </label>
            <select
              id="hospital-active-request-select"
              className="form-select form-select-sm"
              value={selectedRequestId}
              onChange={(e) => {
                setSelectedRequestId(e.target.value);
                setSelectedDonorIds([]);
                const req = requests.find((r) => (r.id || r._id) === e.target.value);
                if (req?.searchRadiusKm && SEARCH_RADII_KM.includes(Number(req.searchRadiusKm))) {
                  setRadiusKm(Number(req.searchRadiusKm));
                }
              }}
            >
              <option value="">Standalone Quick Radar Scan (No Selected Request)</option>
              {requests.map((req) => {
                const rid = req.id || req._id;
                return (
                  <option key={rid} value={rid}>
                    [{req.bloodGroup}] {req.patientName} — {req.unitsRequired} unit(s) ({req.status})
                  </option>
                );
              })}
            </select>
          </div>

          {!selectedRequest && (
            <div className="col-sm-4 col-lg-2">
              <label htmlFor="radar-blood-group" className="form-label small fw-bold text-secondary mb-1">
                Target Blood Group
              </label>
              <select
                id="radar-blood-group"
                className="form-select form-select-sm"
                value={radarBloodGroup}
                onChange={(e) => setRadarBloodGroup(e.target.value)}
              >
                {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
          )}

          <div className={selectedRequest ? 'col-lg-7' : 'col-lg-5'}>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <div className="small fw-bold text-secondary mb-1">Search Radius (km)</div>
                <div className="btn-group btn-group-sm" role="group" aria-label="Search radius kilometers">
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
              </div>

              {!selectedRequest && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger rounded-pill d-inline-flex align-items-center gap-1"
                  onClick={handleUseBrowserGps}
                >
                  <FaLocationArrow size={11} /> Use My GPS
                </button>
              )}
            </div>
          </div>
        </div>

        {selectedRequest && (
          <div className="mt-3 pt-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-2 small">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="badge bg-danger fs-6">{selectedRequest.bloodGroup}</span>
              <strong className="text-dark">{selectedRequest.patientName}</strong>
              <span className="text-muted">&bull; {selectedRequest.unitsRequired} Unit(s)</span>
              <UrgencyBadge urgency={selectedRequest.urgency} />
              <StatusBadge status={selectedRequest.status} />
              {compatibleGroups.length > 0 && (
                <span className="text-muted">
                  | RBC Compatible Donors: <strong>{compatibleGroups.join(', ')}</strong>
                </span>
              )}
            </div>

            <div className="d-flex gap-2">
              <Link to={`/requests/${selectedRequest.id || selectedRequest._id}`} className="btn btn-sm btn-outline-dark rounded-pill">
                Full Request Details
              </Link>
              {!['DONATION_COMPLETED', 'CANCELLED', 'CLOSED'].includes(selectedRequest.status) && (
                <button
                  type="button"
                  className="btn btn-sm btn-success rounded-pill fw-semibold"
                  onClick={() =>
                    setStatusDialog({
                      requestId: selectedRequest.id || selectedRequest._id,
                      status: 'DONATION_COMPLETED',
                      label: selectedRequest.patientName,
                    })
                  }
                >
                  Mark Completed
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Map + Nearest-First Compatible Donors Grid */}
      <div className="row g-4 mb-4">
        <div className="col-lg-7">
          <div className="bc-card p-3 bg-white h-100 shadow-sm border">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <FaMapMarkedAlt className="text-danger" /> Live Donor Tracking Map
              </h5>
              <span className="badge bg-light text-dark border">
                {nearbyDonors.length} Verified Donor(s) in {radiusKm} km
              </span>
            </div>

            <LiveDonorMap
              hospitalLat={activeMapLat}
              hospitalLng={activeMapLng}
              hospitalName={selectedRequest?.hospitalName || user?.hospitalName || user?.name}
              radiusKm={radiusKm}
              donors={nearbyDonors}
              invitations={invitations}
              selectedDonorIds={selectedDonorIds}
              onToggleSelectDonor={selectedRequest ? toggleSelectDonor : undefined}
              onReviewDonor={(donor) => setReviewingDonor(donor)}
              onInviteDonor={
                selectedRequest
                  ? (donor) =>
                      setInviteDialog({
                        donorIds: [donor.id || donor.donorId],
                        label: `${donor.name || 'Donor'} (${donor.bloodGroup}, ~${donor.distanceKm} km)`,
                      })
                  : undefined
              }
              height={440}
            />
          </div>
        </div>

        {/* Nearest-First Compatible Donors & Batch Invite Panel */}
        <div className="col-lg-5">
          <div className="bc-card p-3 bg-white h-100 shadow-sm border d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
                  <FaUsers className="text-danger" /> Nearby Compatible Donors
                </h5>
                <small className="text-muted">Sorted nearest-first &bull; Verified &amp; fresh GPS only</small>
              </div>

              {selectedRequest && selectedDonorIds.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-blood d-inline-flex align-items-center gap-1"
                  onClick={() =>
                    setInviteDialog({
                      donorIds: selectedDonorIds,
                      label: `${selectedDonorIds.length} selected compatible donor(s)`,
                    })
                  }
                >
                  <FaPaperPlane size={11} /> Invite ({selectedDonorIds.length})
                </button>
              )}
            </div>

            {loadingDonors ? (
              <div className="text-center py-5 text-muted small">
                <div className="spinner-border spinner-border-sm text-danger me-2" />
                Scanning active donors within {radiusKm} km...
              </div>
            ) : nearbyDonors.length === 0 ? (
              <div className="text-center py-5 px-3 bg-light rounded-3 border my-auto">
                <FaTint className="text-muted mb-2" size={26} />
                <h6 className="fw-bold text-dark mb-1">No Matching Donors Within {radiusKm} km</h6>
                <p className="text-muted small mb-3">
                  Compatible donors with active live GPS sharing and valid verification were not found inside this radius.
                </p>
                {nextLargerRadius && (
                  <button
                    type="button"
                    className="btn btn-blood btn-sm d-inline-flex align-items-center gap-2"
                    onClick={() => setRadiusKm(nextLargerRadius)}
                  >
                    <FaExpandArrowsAlt size={12} /> Expand Radius to {nextLargerRadius} km
                  </button>
                )}
              </div>
            ) : (
              <div className="d-flex flex-column gap-2" style={{ maxHeight: 410, overflowY: 'auto' }}>
                {nearbyDonors.map((d) => {
                  const dId = d.id || d.donorId;
                  const inv = (invitations || []).find(
                    (i) => i.donorId === dId || i.userId === d.userId
                  );
                  const invStatus = inv?.status || d.invitationStatus;
                  const isChecked = selectedDonorIds.includes(dId);

                  return (
                    <div key={dId} className="p-2.5 rounded-3 border bg-light">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div className="d-flex align-items-start gap-2">
                          {selectedRequest && !invStatus && (
                            <input
                              type="checkbox"
                              className="form-check-input mt-1"
                              checked={isChecked}
                              onChange={() => toggleSelectDonor(dId)}
                              aria-label={`Select ${d.name || 'donor'}`}
                            />
                          )}
                          <div>
                            <div className="d-flex align-items-center flex-wrap gap-1 mb-0.5">
                              <strong className="small text-dark">{d.name || 'Verified Donor'}</strong>
                              <span className="badge bg-danger">{d.bloodGroup}</span>
                              {d.exactMatch && (
                                <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                  Exact
                                </span>
                              )}
                            </div>
                            <div className="small text-muted">
                              <strong>{d.distanceKm} km</strong> &bull; Verified &bull; GPS Active
                            </div>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-1.5">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-1 px-2"
                            title="Review Donor Medical Profile"
                            onClick={() => setReviewingDonor(d)}
                          >
                            <FaStethoscope size={11} className="text-danger" />
                          </button>
                          {selectedRequest && (
                            invStatus ? (
                              <span
                                className={`badge rounded-pill ${
                                  invStatus === 'ACCEPTED'
                                    ? 'bg-success'
                                    : invStatus === 'REJECTED' || invStatus === 'DECLINED'
                                    ? 'bg-secondary'
                                    : 'bg-warning text-dark'
                                }`}
                              >
                                {invStatus}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger py-1 px-2 fw-semibold"
                                onClick={() =>
                                  setInviteDialog({
                                    donorIds: [dId],
                                    label: `${d.name || 'Donor'} (${d.bloodGroup}, ~${d.distanceKm} km)`,
                                  })
                                }
                              >
                                <FaPaperPlane size={10} className="me-1" /> Invite
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Invitations & Donor Response Tracking Table */}
      {selectedRequest && (
        <div className="bc-card p-4 bg-white mb-4 shadow-sm border">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="fw-bold text-dark mb-0">Live Emergency Invitation & Response Tracker</h5>
              <small className="text-muted">
                Real-time donor acceptance status for {selectedRequest.patientName} ({selectedRequest.bloodGroup})
              </small>
            </div>
            <span className="badge bg-light text-dark border">{invitations.length} Invitation(s)</span>
          </div>

          {invitations.length === 0 ? (
            <div className="text-center py-4 bg-light rounded-3 border small text-muted">
              No donors invited for this request yet. Select compatible donors above or on the map to dispatch invitations.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>Donor Name</th>
                    <th>Blood Group</th>
                    <th>Distance</th>
                    <th>Medical Verification</th>
                    <th>Invitation Status</th>
                    <th>Response Time</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => {
                    const status = inv.status || 'PENDING';
                    let badgeClass = 'bg-warning text-dark';
                    let statusLabel = 'Pending';
                    if (status === 'ACCEPTED') {
                      badgeClass = 'bg-success text-white';
                      statusLabel = 'Accepted';
                    } else if (status === 'REJECTED' || status === 'DECLINED') {
                      badgeClass = 'bg-danger text-white';
                      statusLabel = 'Rejected';
                    } else if (status === 'IN_PROGRESS' || status === 'DONATION_IN_PROGRESS') {
                      badgeClass = 'bg-primary text-white';
                      statusLabel = 'Donation In Progress';
                    } else if (status === 'COMPLETED') {
                      badgeClass = 'bg-success text-white';
                      statusLabel = 'Completed';
                    } else if (status === 'CANCELLED') {
                      badgeClass = 'bg-secondary text-white';
                      statusLabel = 'Cancelled';
                    }

                    const responseTime = inv.respondedAt 
                      ? new Date(inv.respondedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : (inv.createdAt ? new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Awaiting Response');

                    return (
                      <tr key={inv.id || inv.donorId}>
                        <td>
                          <strong className="text-dark">{inv.donorName || 'Verified Donor'}</strong>
                        </td>
                        <td>
                          <span className="badge bg-danger">{inv.bloodGroup || selectedRequest.bloodGroup}</span>
                        </td>
                        <td>{inv.distanceKm !== undefined ? `~${inv.distanceKm} km` : 'Nearby'}</td>
                        <td>
                          <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2">
                            {inv.medicalVerificationStatus || 'Verified'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge rounded-pill px-2.5 py-1 ${badgeClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="text-muted">
                          {responseTime}
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-1 px-2.5 rounded-pill d-inline-flex align-items-center gap-1"
                            onClick={() => setReviewingDonor(inv)}
                          >
                            <FaStethoscope size={11} /> Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Donor Medical Review Modal */}
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
                requestId={selectedRequest?.id || selectedRequest?._id}
                onClose={() => setReviewingDonor(null)}
                onInvite={(d) => {
                  const id = d.id || d.donorId;
                  setReviewingDonor(null);
                  setInviteDialog({
                    donorIds: [id],
                    label: `${d.name || d.donorName || 'Donor'} (${d.bloodGroup}, ~${d.distanceKm ?? ''} km)`,
                  });
                }}
                isInvited={invitations.some((i) => (i.donorId || i.id) === (reviewingDonor.id || reviewingDonor.donorId))}
                invitationStatus={
                  (invitations.find((i) => (i.donorId || i.id) === (reviewingDonor.id || reviewingDonor.donorId)) || {}).status
                }
              />
            </div>
          </div>
        </div>
      )}

      <DisclaimerAlert />

      <ConfirmDialog
        open={Boolean(inviteDialog)}
        variant="info"
        title="Send Emergency Blood Invitation?"
        message={`Send an immediate real-time emergency blood alert to ${inviteDialog?.label} for patient ${selectedRequest?.patientName || ''} (${selectedRequest?.bloodGroup || ''})?`}
        confirmLabel="Dispatch Invitation"
        loading={submittingAction}
        onConfirm={executeInviteConfirm}
        onCancel={() => setInviteDialog(null)}
      />

      <ConfirmDialog
        open={Boolean(statusDialog)}
        variant="info"
        title="Confirm Donation Completion?"
        message={`Mark blood request for ${statusDialog?.label} as ${statusDialog?.status}? This updates active hospital tracking and notifies involved donors.`}
        confirmLabel="Yes, Mark Completed"
        loading={submittingAction}
        onConfirm={executeStatusConfirm}
        onCancel={() => setStatusDialog(null)}
      />
    </div>
  );
};

export default HospitalDashboard;

