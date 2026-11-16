import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaBroadcastTower,
  FaCheck,
  FaExclamationTriangle,
  FaHospital,
  FaLocationArrow,
  FaLock,
  FaMapMarkerAlt,
  FaStopCircle,
  FaSyncAlt,
  FaTimes,
  FaToggleOff,
  FaToggleOn,
} from 'react-icons/fa';
import { donorService } from '../../services/donorService';
import { useWebSocket } from '../../context/WebSocketContext';
import ConfirmDialog from '../common/ConfirmDialog';

const MIN_PUSH_INTERVAL_MS = 15000;

const parseAvailBool = (val) => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toUpperCase() === 'AVAILABLE' || val.toLowerCase() === 'true';
  return true;
};

const formatTimestamp = (value) => {
  if (!value) return 'Never updated';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Just now';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const DonorLiveTrackingCard = ({ donor, onStatusChange }) => {
  const { connected: wsConnected, subscribe } = useWebSocket();

  const [sharingEnabled, setSharingEnabled] = useState(Boolean(donor?.locationSharingEnabled));
  const [consentChecked, setConsentChecked] = useState(Boolean(donor?.locationSharingEnabled));
  const [availability, setAvailability] = useState(parseAvailBool(donor?.availability));
  const [lastUpdatedAt, setLastUpdatedAt] = useState(donor?.lastLocationUpdatedAt || null);
  const [accuracyMeters, setAccuracyMeters] = useState(null);

  const [geoState, setGeoState] = useState(donor?.locationSharingEnabled ? 'active' : 'idle');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [togglingShare, setTogglingShare] = useState(false);
  const [togglingAvail, setTogglingAvail] = useState(false);

  const [invitations, setInvitations] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null);
  const [responding, setResponding] = useState(false);

  const watchIdRef = useRef(null);
  const lastPushTimeRef = useRef(0);

  useEffect(() => {
    if (donor) {
      setSharingEnabled(Boolean(donor.locationSharingEnabled));
      if (donor.locationSharingEnabled) {
        setConsentChecked(true);
        setGeoState((prev) => (prev === 'idle' ? 'active' : prev));
      }
      if (donor.availability !== undefined && donor.availability !== null) {
        setAvailability(parseAvailBool(donor.availability));
      }
      if (donor.lastLocationUpdatedAt) {
        setLastUpdatedAt(donor.lastLocationUpdatedAt);
      }
    }
  }, [donor]);

  const loadInvitations = useCallback(async () => {
    try {
      const res = await donorService.getInvitations();
      const list = res?.data?.invitations || res?.invitations || [];
      setInvitations(list);
    } catch {
      // Non-fatal fallback
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  useEffect(() => {
    const unsubInvite = subscribe('request_invitation', () => {
      loadInvitations();
      onStatusChange?.();
    });
    const unsubStatus = subscribe('request_status_updated', () => {
      loadInvitations();
      onStatusChange?.();
    });
    return () => {
      unsubInvite();
      unsubStatus();
    };
  }, [subscribe, loadInvitations, onStatusChange]);

  const clearWatcher = useCallback(() => {
    if (watchIdRef.current !== null && navigator?.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const pushCoordinates = useCallback(
    async (lat, lng, accuracy = null, force = false) => {
      const now = Date.now();
      if (!force && now - lastPushTimeRef.current < MIN_PUSH_INTERVAL_MS) {
        return;
      }
      lastPushTimeRef.current = now;
      try {
        const res = await donorService.updateLiveLocation({
          lat,
          lng,
          accuracy,
          consent: true,
        });
        const data = res?.data || res || {};
        setLastUpdatedAt(data.lastLocationUpdatedAt || new Date().toISOString());
        if (accuracy !== null && accuracy !== undefined) {
          setAccuracyMeters(Math.round(accuracy));
        }
        setGeoState('active');
        setErrorMsg('');
      } catch (err) {
        const detail = err?.response?.data?.detail;
        if (err?.response?.status === 403) {
          clearWatcher();
          setSharingEnabled(false);
          setGeoState('idle');
          setErrorMsg(detail || 'Live location sharing requires explicit consent.');
        } else if (err?.response?.status !== 429) {
          setErrorMsg(detail || 'Failed to sync GPS coordinates.');
        }
      }
    },
    [clearWatcher]
  );

  // Maintain active geolocation watcher only when sharingEnabled is true
  useEffect(() => {
    if (!sharingEnabled) {
      clearWatcher();
      return undefined;
    }

    if (!navigator?.geolocation) {
      setGeoState('error');
      setErrorMsg('Geolocation is not supported by your browser.');
      return undefined;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        pushCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy,
          false
        );
      },
      (geoErr) => {
        if (geoErr.code === 1) {
          setGeoState('denied');
          setErrorMsg('Browser location permission was denied. Please allow GPS access to continue live sharing.');
        } else {
          setGeoState('error');
          setErrorMsg(geoErr.message || 'Unable to acquire live GPS signal.');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    return () => {
      clearWatcher();
    };
  }, [sharingEnabled, clearWatcher, pushCoordinates]);

  const handleStartSharing = () => {
    setErrorMsg('');
    setFeedback('');

    if (!consentChecked) {
      setErrorMsg('Please confirm the location consent checkbox before starting live GPS sharing.');
      return;
    }

    if (!navigator?.geolocation) {
      setGeoState('error');
      setErrorMsg('Browser Geolocation API is unavailable on this device.');
      return;
    }

    setTogglingShare(true);
    setGeoState('requesting');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        try {
          const res = await donorService.setLocationSharing({
            enabled: true,
            consent: true,
            lat,
            lng,
          });
          const data = res?.data || res || {};
          lastPushTimeRef.current = Date.now();
          setSharingEnabled(true);
          setGeoState('active');
          setLastUpdatedAt(data.lastLocationUpdatedAt || new Date().toISOString());
          if (accuracy !== undefined) setAccuracyMeters(Math.round(accuracy));
          setFeedback('Live GPS sharing started. Only verified hospitals during active matching see your approximate area.');
          onStatusChange?.();
        } catch (err) {
          setGeoState('error');
          setErrorMsg(err?.response?.data?.detail || 'Could not enable live location sharing.');
        } finally {
          setTogglingShare(false);
        }
      },
      (geoErr) => {
        setTogglingShare(false);
        if (geoErr.code === 1) {
          setGeoState('denied');
          setErrorMsg('GPS permission denied by browser. Enable location permissions in browser settings and retry.');
        } else {
          setGeoState('error');
          setErrorMsg(geoErr.message || 'Unable to capture current GPS coordinates.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const handleStopSharing = async () => {
    setTogglingShare(true);
    setErrorMsg('');
    setFeedback('');
    clearWatcher();
    try {
      await donorService.setLocationSharing({ enabled: false, consent: false });
      setSharingEnabled(false);
      setGeoState('idle');
      setAccuracyMeters(null);
      setFeedback('Live GPS sharing stopped and active coordinates cleared from the live map.');
      onStatusChange?.();
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to disable live location sharing.');
    } finally {
      setTogglingShare(false);
    }
  };

  const handleAvailabilityToggle = async () => {
    setTogglingAvail(true);
    setErrorMsg('');
    const nextState = !availability;
    try {
      const res = await donorService.patchAvailability(nextState);
      const data = res?.data || res || {};
      setAvailability(parseAvailBool(data.availability !== undefined ? data.availability : nextState));
      setFeedback(`Donor availability updated to ${nextState ? 'Available' : 'Unavailable'}.`);
      onStatusChange?.();
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Could not update availability.');
    } finally {
      setTogglingAvail(false);
    }
  };

  const executeConfirmRespond = async () => {
    if (!confirmAction) return;
    setResponding(true);
    try {
      const res = await donorService.respondToRequestV2(
        confirmAction.requestId,
        confirmAction.action
      );
      setFeedback(res?.message || `Invitation ${confirmAction.action === 'ACCEPT' ? 'accepted' : 'declined'} successfully.`);
      setConfirmAction(null);
      await loadInvitations();
      onStatusChange?.();
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to record emergency response.');
      setConfirmAction(null);
    } finally {
      setResponding(false);
    }
  };

  const activeInvitations = invitations.filter(
    (inv) => inv.status === 'INVITED' || inv.status === 'ACCEPTED' || inv.status === 'PENDING'
  );

  return (
    <div className="row g-3 mb-4">
      {/* Live GPS Consent & Sharing Control Card */}
      <div className="col-lg-6">
        <div className="bc-card p-4 bg-white h-100 border shadow-sm">
          <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
            <div>
              <span
                className={`badge rounded-pill mb-2 d-inline-flex align-items-center gap-1 ${
                  sharingEnabled ? 'bg-success-subtle text-success border border-success' : 'bg-light text-secondary border'
                }`}
              >
                <FaBroadcastTower size={11} />
                {sharingEnabled ? 'LIVE LOCATION ACTIVE' : 'LOCATION SHARING OFF'}
              </span>
              <h5 className="fw-bold text-dark mb-1">Real-Time Donor GPS Tracking</h5>
              <small className="text-muted">
                Privacy-first opt-in GPS for emergency hospital proximity matching
              </small>
            </div>
            <span
              className={`badge rounded-pill ${wsConnected ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}
              title="Real-time WebSocket status"
            >
              {wsConnected ? 'Live Sync On' : 'Reconnecting'}
            </span>
          </div>

          {feedback && (
            <div className="alert alert-success py-2 small mb-3 d-flex justify-content-between align-items-center">
              <span>{feedback}</span>
              <button type="button" className="btn-close btn-sm" onClick={() => setFeedback('')} />
            </div>
          )}

          {errorMsg && (
            <div className="alert alert-danger py-2 small mb-3 d-flex justify-content-between align-items-center">
              <span>
                <FaExclamationTriangle className="me-1" /> {errorMsg}
              </span>
              <button type="button" className="btn-close btn-sm" onClick={() => setErrorMsg('')} />
            </div>
          )}

          <div className="p-3 rounded-3 bg-light border mb-3 small">
            <div className="form-check mb-2">
              <input
                id="donor-gps-consent-checkbox"
                type="checkbox"
                className="form-check-input"
                checked={consentChecked}
                disabled={sharingEnabled}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <label htmlFor="donor-gps-consent-checkbox" className="form-check-label fw-semibold text-dark">
                I consent to share my live GPS location while sharing is active.
              </label>
            </div>
            <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
              <FaLock size={11} /> Exact GPS coordinates are never public; inactive locations auto-expire after 30 minutes.
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <div className="d-flex gap-2">
              {!sharingEnabled ? (
                <button
                  type="button"
                  className="btn btn-blood btn-sm d-inline-flex align-items-center gap-2"
                  disabled={togglingShare}
                  onClick={handleStartSharing}
                >
                  <FaLocationArrow size={12} />
                  {togglingShare || geoState === 'requesting' ? 'Starting GPS...' : 'Start Sharing'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2 fw-semibold"
                  disabled={togglingShare}
                  onClick={handleStopSharing}
                >
                  <FaStopCircle size={13} />
                  {togglingShare ? 'Stopping...' : 'Stop Sharing'}
                </button>
              )}

              <button
                type="button"
                className={`btn btn-sm d-inline-flex align-items-center gap-1 ${
                  availability ? 'btn-outline-success' : 'btn-outline-secondary'
                }`}
                disabled={togglingAvail}
                onClick={handleAvailabilityToggle}
              >
                {availability ? <FaToggleOn size={16} /> : <FaToggleOff size={16} />}
                {availability ? 'Available' : 'Unavailable'}
              </button>
            </div>

            <div className="text-end small text-muted">
              <div>
                Last GPS sync: <strong className="text-dark">{formatTimestamp(lastUpdatedAt)}</strong>
              </div>
              {accuracyMeters !== null && (
                <div style={{ fontSize: '0.75rem' }}>Precision: ~{accuracyMeters} m</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Emergency Hospital Invitations Card */}
      <div className="col-lg-6">
        <div className="bc-card p-4 bg-white h-100 border shadow-sm">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="fw-bold text-dark mb-0">Hospital Emergency Invitations</h5>
              <small className="text-muted">Direct emergency alerts from verified hospitals near you</small>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-light border rounded-pill"
              onClick={loadInvitations}
              title="Refresh invitations"
            >
              <FaSyncAlt size={12} />
            </button>
          </div>

          {loadingInvites ? (
            <div className="text-center py-4 small text-muted">Checking hospital invitations...</div>
          ) : activeInvitations.length === 0 ? (
            <div className="text-center py-4 bg-light rounded-3 border">
              <FaMapMarkerAlt className="text-muted mb-2" size={22} />
              <h6 className="fw-bold text-dark mb-1">No Active Emergency Invitations</h6>
              <p className="text-muted small mb-0">
                Keep availability on and live sharing active during emergencies to receive rapid invitations.
              </p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {activeInvitations.map((inv) => {
                const req = inv.request || {};
                const hospitalName = inv.hospitalName || req.hospitalName || 'Verified Hospital';
                const bloodGroup = inv.bloodGroup || req.bloodGroup || 'Blood';
                const units = inv.unitsRequired || req.unitsRequired || 1;
                const urgency = inv.urgency || req.urgency || 'URGENT';
                const city = inv.city || req.city || 'Local area';
                const distKm = inv.approximateDistanceKm ?? inv.distanceKm;
                const isAccepted = inv.status === 'ACCEPTED';

                return (
                  <div key={inv.id || inv.requestId} className="p-3 rounded-3 border bg-light">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
                          <span className="badge bg-danger">{bloodGroup}</span>
                          <span className="fw-bold text-dark small">
                            <FaHospital className="me-1 text-danger" />
                            {hospitalName}
                          </span>
                          {distKm !== null && distKm !== undefined && (
                            <span className="badge bg-white text-dark border">~{distKm} km away</span>
                          )}
                        </div>
                        <div className="small text-muted">
                          {city} &bull; {units} unit(s) &bull;{' '}
                          <span className="fw-semibold text-danger">{urgency}</span>
                        </div>
                      </div>

                      {isAccepted ? (
                        <span className="badge bg-success rounded-pill px-2 py-1">Accepted</span>
                      ) : (
                        <div className="d-flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            className="btn btn-sm btn-success py-1 px-2 fw-semibold"
                            onClick={() =>
                              setConfirmAction({
                                requestId: inv.requestId,
                                action: 'ACCEPT',
                                hospitalName,
                                bloodGroup,
                              })
                            }
                          >
                            <FaCheck size={11} className="me-1" /> Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-1 px-2"
                            onClick={() =>
                              setConfirmAction({
                                requestId: inv.requestId,
                                action: 'REJECT',
                                hospitalName,
                                bloodGroup,
                              })
                            }
                          >
                            <FaTimes size={11} /> Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        variant={confirmAction?.action === 'ACCEPT' ? 'info' : 'danger'}
        title={
          confirmAction?.action === 'ACCEPT'
            ? 'Accept Emergency Blood Invitation?'
            : 'Decline Emergency Invitation?'
        }
        message={
          confirmAction?.action === 'ACCEPT'
            ? `Confirm you are ready to donate ${confirmAction?.bloodGroup} blood for ${confirmAction?.hospitalName}. Your coordination details will be shared with the requesting hospital.`
            : `Are you sure you want to decline the emergency request from ${confirmAction?.hospitalName}?`
        }
        confirmLabel={confirmAction?.action === 'ACCEPT' ? 'Yes, Accept Request' : 'Decline Invitation'}
        loading={responding}
        onConfirm={executeConfirmRespond}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default DonorLiveTrackingCard;
