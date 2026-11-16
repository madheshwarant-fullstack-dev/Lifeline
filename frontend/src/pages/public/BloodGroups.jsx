import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BLOOD_GROUPS, BLOOD_COMPATIBILITY_INFO } from '../../utils/constants';
import DisclaimerAlert from '../../components/common/DisclaimerAlert';
import { BsDropletFill, BsCheckLg, BsXLg, BsPersonCheck, BsHeartPulse, BsArrowRight } from 'react-icons/bs';

const BloodGroups = () => {
  const [selectedGroup, setSelectedGroup] = useState('O+');
  const [lookupMode, setLookupMode] = useState('PATIENT'); // 'PATIENT' or 'DONOR'

  const info = BLOOD_COMPATIBILITY_INFO[selectedGroup];

  return (
    <div className="py-5 bg-light min-vh-100">
      <div className="container">
        {/* Title */}
        <div className="text-center max-w-700 mx-auto mb-5">
          <span className="text-danger fw-bold small text-uppercase tracking-wider">Educational & Clinical Guide</span>
          <h1 className="fw-extrabold text-dark mb-2">Blood Group Compatibility Guide</h1>
          <p className="text-muted small">
            Understand how antigens, Rh factors, and red blood cell compatibility operate across all eight blood types.
          </p>
        </div>

        {/* Interactive Compatibility Calculator Box */}
        <div className="bc-card p-4 p-lg-5 bg-white mb-5 shadow-sm">
          <div className="row align-items-center g-4">
            <div className="col-lg-5">
              <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-3 py-1 mb-2 fw-bold">
                COMPATIBILITY CHECKER
              </span>
              <h3 className="fw-bold mb-3">Interactive Blood Matching</h3>
              <p className="text-muted small mb-4">
                Choose your perspective to examine which blood groups are safe for red blood cell transfusion.
              </p>

              <div className="btn-group w-100 mb-4 p-1 bg-light rounded-3">
                <button
                  type="button"
                  className={`btn btn-sm rounded-2 fw-semibold ${lookupMode === 'PATIENT' ? 'btn-danger shadow-sm' : 'btn-light text-secondary'}`}
                  onClick={() => setLookupMode('PATIENT')}
                >
                  <BsHeartPulse className="me-1" /> If I am a Patient
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-2 fw-semibold ${lookupMode === 'DONOR' ? 'btn-danger shadow-sm' : 'btn-light text-secondary'}`}
                  onClick={() => setLookupMode('DONOR')}
                >
                  <BsPersonCheck className="me-1" /> If I am a Donor
                </button>
              </div>

              <label className="form-label small fw-bold text-dark">Select Blood Group:</label>
              <div className="d-flex flex-wrap gap-2 mb-4">
                {BLOOD_GROUPS.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setSelectedGroup(bg)}
                    className={`btn ${selectedGroup === bg ? 'btn-danger fw-bold shadow-sm' : 'btn-outline-secondary'}`}
                    style={{ minWidth: '55px', height: '44px' }}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-lg-7">
              <div className="p-4 bg-light rounded-4 border">
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="blood-badge-pill">{selectedGroup}</span>
                    <div>
                      <h5 className="fw-bold mb-0 text-dark">{selectedGroup} Profile</h5>
                      <small className="text-muted">{info?.type}</small>
                    </div>
                  </div>
                  <Link to={`/requester/create-request?bloodGroup=${selectedGroup}`} className="btn btn-sm btn-blood d-flex align-items-center gap-1">
                    Request {selectedGroup} <BsArrowRight size={10} />
                  </Link>
                </div>

                {lookupMode === 'PATIENT' ? (
                  <div>
                    <h6 className="fw-bold text-dark mb-2">Compatible Donors You Can Receive From:</h6>
                    <div className="row g-2 mb-3">
                      {BLOOD_GROUPS.map((bg) => {
                        const canReceive = info?.canReceiveFrom.includes(bg);
                        return (
                          <div key={bg} className="col-3">
                            <div className={`p-2 rounded text-center border small ${canReceive ? 'bg-success text-white fw-bold' : 'bg-white text-muted opacity-50'}`}>
                              <div>{bg}</div>
                              <div style={{ fontSize: '10px' }}>{canReceive ? 'Compatible' : 'No'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="small text-muted mb-0">{info?.description}</p>
                  </div>
                ) : (
                  <div>
                    <h6 className="fw-bold text-dark mb-2">Patients You Can Safely Donate To:</h6>
                    <div className="row g-2 mb-3">
                      {BLOOD_GROUPS.map((bg) => {
                        const canDonate = info?.canDonateTo.includes(bg);
                        return (
                          <div key={bg} className="col-3">
                            <div className={`p-2 rounded text-center border small ${canDonate ? 'bg-danger text-white fw-bold' : 'bg-white text-muted opacity-50'}`}>
                              <div>{bg}</div>
                              <div style={{ fontSize: '10px' }}>{canDonate ? 'Can Donate' : 'No'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="small text-muted mb-0">{info?.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 8 Blood Group Cards */}
        <div className="mb-5">
          <h3 className="fw-bold text-dark mb-4 text-center">Complete Blood Type Directory</h3>
          <div className="row g-4">
            {BLOOD_GROUPS.map((bg) => {
              const item = BLOOD_COMPATIBILITY_INFO[bg];
              return (
                <div key={bg} className="col-md-6 col-lg-3">
                  <div className="bc-card bc-card-hover p-4 bg-white h-100 d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="blood-badge-pill">{bg}</span>
                      <span className="badge bg-danger-subtle text-danger border border-danger-subtle small">
                        {item?.type}
                      </span>
                    </div>

                    <div className="mb-2 small">
                      <strong className="text-secondary d-block">Can Donate Red Cells To:</strong>
                      <span className="fw-semibold text-dark">{item?.canDonateTo.join(', ')}</span>
                    </div>

                    <div className="mb-3 small">
                      <strong className="text-secondary d-block">Can Receive Red Cells From:</strong>
                      <span className="fw-semibold text-dark">{item?.canReceiveFrom.join(', ')}</span>
                    </div>

                    <div className="mt-auto pt-3 border-top">
                      <small className="text-muted d-block" style={{ fontSize: '0.78rem' }}>
                        {item?.description}
                      </small>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Medical Advisory Box */}
        <DisclaimerAlert />
      </div>
    </div>
  );
};

export default BloodGroups;
