import React from 'react';
import { BsExclamationTriangleFill, BsBellFill, BsClock, BsCheckCircleFill } from 'react-icons/bs';

const UrgencyBadge = ({ urgency }) => {
  const clean = (urgency || 'NORMAL').toUpperCase();

  if (clean === 'EMERGENCY') {
    return (
      <span className="emergency-pulse-badge">
        <BsExclamationTriangleFill /> EMERGENCY
      </span>
    );
  }

  if (clean === 'HIGH') {
    return (
      <span className="badge rounded-pill bg-warning text-dark px-2.5 py-1.5 fw-semibold d-inline-flex align-items-center gap-1">
        <BsBellFill size={11} /> High Urgency
      </span>
    );
  }

  if (clean === 'LOW') {
    return (
      <span className="badge rounded-pill bg-light text-secondary border px-2.5 py-1.5 fw-semibold d-inline-flex align-items-center gap-1">
        <BsClock size={11} /> Routine / Low
      </span>
    );
  }

  return (
    <span className="badge rounded-pill bg-info text-white px-2.5 py-1.5 fw-semibold d-inline-flex align-items-center gap-1">
      <BsCheckCircleFill size={11} /> Normal
    </span>
  );
};

export default UrgencyBadge;
