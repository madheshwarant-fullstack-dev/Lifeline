import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { FaBroadcastTower, FaCheck, FaHospital, FaPaperPlane, FaShieldAlt, FaStethoscope } from 'react-icons/fa';

const DEFAULT_CENTER = [13.0633, 80.2519]; // Default center when GPS not yet selected

const createPinIcon = (bgColor, label) =>
  L.divIcon({
    className: 'lifeline-pin-marker',
    html: `<div class="lifeline-pin-dot" style="background:${bgColor};"><span>${label}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });

const MapRecenter = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.setView(center, zoom ?? map.getZoom(), { animate: true });
    }
  }, [center, zoom, map]);
  return null;
};

const MapClickHandler = ({ enabled, onPickLocation }) => {
  useMapEvents({
    click(e) {
      if (enabled && onPickLocation) {
        onPickLocation(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      }
    },
  });
  return null;
};

const zoomForRadius = (radiusKm) => {
  const r = Number(radiusKm) || 25;
  if (r <= 5) return 13;
  if (r <= 10) return 12;
  if (r <= 25) return 11;
  if (r <= 50) return 10;
  return 9;
};

const formatAge = (iso) => {
  if (!iso) return 'Active';
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (Number.isNaN(diffSec)) return 'Active';
  if (diffSec < 60) return `${diffSec}s ago`;
  return `${Math.round(diffSec / 60)}m ago`;
};

const LiveDonorMap = ({
  hospitalLat,
  hospitalLng,
  hospitalName = 'Requesting Hospital',
  radiusKm = 25,
  donors = [],
  invitations = [],
  onInviteDonor,
  onReviewDonor = null,
  onPickLocation,
  pickerMode = false,
  selectedDonorIds = [],
  onToggleSelectDonor,
  height = 420,
}) => {
  const hasHospitalCoords =
    Number.isFinite(Number(hospitalLat)) && Number.isFinite(Number(hospitalLng));
  const center = useMemo(
    () => (hasHospitalCoords ? [Number(hospitalLat), Number(hospitalLng)] : DEFAULT_CENTER),
    [hasHospitalCoords, hospitalLat, hospitalLng]
  );

  const invitationByDonorId = useMemo(() => {
    const map = {};
    (invitations || []).forEach((inv) => {
      const id = inv.donorId || inv.userId;
      if (id) map[id] = inv;
    });
    return map;
  }, [invitations]);

  const hospitalIcon = useMemo(() => createPinIcon('#0f172a', 'H'), []);

  return (
    <div className="lifeline-map-wrapper bg-white shadow-sm">
      <MapContainer
        center={center}
        zoom={zoomForRadius(radiusKm)}
        style={{ width: '100%', height }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRecenter center={center} zoom={zoomForRadius(radiusKm)} />
        <MapClickHandler enabled={pickerMode} onPickLocation={onPickLocation} />

        {/* Hospital Marker + Configurable Search Radius Circle */}
        {hasHospitalCoords && (
          <>
            <Circle
              center={center}
              radius={(Number(radiusKm) || 25) * 1000}
              pathOptions={{
                color: '#b91c1c',
                fillColor: '#ef4444',
                fillOpacity: 0.08,
                weight: 1.5,
                dashArray: '6 4',
              }}
            />
            <Marker position={center} icon={hospitalIcon}>
              <Popup>
                <div className="small">
                  <div className="fw-bold text-danger d-flex align-items-center gap-1 mb-1">
                    <FaHospital /> {hospitalName}
                  </div>
                  <div className="text-muted">Search Radius: {radiusKm} km</div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {center[0].toFixed(4)}, {center[1].toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Live Verified Consented Donor Markers */}
        {!pickerMode &&
          (donors || []).map((donor) => {
            const dId = donor.id || donor.donorId;
            const lat = Number(donor.approxLat ?? donor.lat);
            const lng = Number(donor.approxLng ?? donor.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

            const inv = invitationByDonorId[dId] || invitationByDonorId[donor.userId];
            const invStatus = inv?.status || donor.invitationStatus;
            const isAccepted = invStatus === 'ACCEPTED';
            const isInvited = invStatus === 'INVITED' || invStatus === 'PENDING';
            const isExact = donor.exactMatch || donor.matchType === 'EXACT';

            let color = isExact ? '#b91c1c' : '#0284c7';
            if (isInvited) color = '#d97706';
            if (isAccepted) color = '#16a34a';

            const icon = createPinIcon(color, donor.bloodGroup || '?');
            const isSelected = selectedDonorIds.includes(dId);

            return (
              <Marker
                key={dId}
                position={[lat, lng]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    if (onReviewDonor) onReviewDonor(donor);
                  },
                }}
              >
                <Popup minWidth={230}>
                  <div className="small">
                    <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                      <strong className="text-dark">{donor.name || 'Verified Donor'}</strong>
                      <span className="badge bg-danger">{donor.bloodGroup}</span>
                    </div>
                    <div className="text-muted mb-1">
                      Distance: <strong>{donor.distanceKm ?? '?'} km</strong> &bull;{' '}
                      <span className={isExact ? 'text-danger fw-semibold' : 'text-primary fw-semibold'}>
                        {isExact ? 'Exact Match' : 'Compatible'}
                      </span>
                    </div>
                    <div className="text-muted mb-2 d-flex align-items-center gap-2" style={{ fontSize: '0.75rem' }}>
                      <span className="d-inline-flex align-items-center gap-1 text-success">
                        <FaShieldAlt /> Verified
                      </span>
                      <span className="d-inline-flex align-items-center gap-1">
                        <FaBroadcastTower /> {formatAge(donor.lastLocationUpdatedAt)}
                      </span>
                    </div>

                    {onReviewDonor && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger w-100 mb-2 d-flex align-items-center justify-content-center gap-1 py-1"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => onReviewDonor(donor)}
                      >
                        <FaStethoscope size={11} /> Donor Medical Review
                      </button>
                    )}

                    {invStatus ? (
                      <div
                        className={`badge w-100 py-1.5 ${
                          isAccepted
                            ? 'bg-success'
                            : invStatus === 'REJECTED' || invStatus === 'DECLINED'
                            ? 'bg-secondary'
                            : 'bg-warning text-dark'
                        }`}
                      >
                        Invitation Status: {invStatus}
                      </div>
                    ) : (
                      <div className="d-flex gap-1 mt-1">
                        {onToggleSelectDonor && (
                          <button
                            type="button"
                            className={`btn btn-sm flex-grow-1 ${
                              isSelected ? 'btn-dark' : 'btn-outline-secondary'
                            }`}
                            onClick={() => onToggleSelectDonor(dId)}
                          >
                            {isSelected ? (
                              <>
                                <FaCheck size={10} className="me-1" /> Selected
                              </>
                            ) : (
                              'Select'
                            )}
                          </button>
                        )}
                        {onInviteDonor && (
                          <button
                            type="button"
                            className="btn btn-sm btn-blood flex-grow-1"
                            onClick={() => onInviteDonor(donor)}
                          >
                            <FaPaperPlane size={10} className="me-1" /> Invite
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>

      {/* Map Color Legend */}
      <div className="px-3 py-2 bg-light border-top d-flex flex-wrap align-items-center justify-content-between gap-2 small">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <span className="d-inline-flex align-items-center gap-1">
            <span className="rounded-circle d-inline-block" style={{ width: 10, height: 10, background: '#0f172a' }} />
            Hospital ({radiusKm} km radius)
          </span>
          {!pickerMode && (
            <>
              <span className="d-inline-flex align-items-center gap-1">
                <span className="rounded-circle d-inline-block" style={{ width: 10, height: 10, background: '#b91c1c' }} />
                Exact Match
              </span>
              <span className="d-inline-flex align-items-center gap-1">
                <span className="rounded-circle d-inline-block" style={{ width: 10, height: 10, background: '#0284c7' }} />
                Compatible
              </span>
              <span className="d-inline-flex align-items-center gap-1">
                <span className="rounded-circle d-inline-block" style={{ width: 10, height: 10, background: '#d97706' }} />
                Invited
              </span>
              <span className="d-inline-flex align-items-center gap-1">
                <span className="rounded-circle d-inline-block" style={{ width: 10, height: 10, background: '#16a34a' }} />
                Accepted
              </span>
            </>
          )}
        </div>
        {pickerMode && (
          <span className="text-muted">Click anywhere on the map to pin exact hospital coordinates</span>
        )}
      </div>
    </div>
  );
};

export default LiveDonorMap;

