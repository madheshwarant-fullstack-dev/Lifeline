import React from 'react';

const statusMap = {
  PENDING: { label: 'Pending', bg: 'bg-secondary text-white' },
  APPROVED: { label: 'Approved', bg: 'bg-primary text-white' },
  FULFILLED: { label: 'Fulfilled', bg: 'bg-success text-white' },
  REJECTED: { label: 'Rejected', bg: 'bg-danger text-white' },
  MATCHED: { label: 'Donors Matched', bg: 'bg-info text-white' },
  DONOR_CONTACTED: { label: 'Contacted', bg: 'bg-info text-white' },
  ACCEPTED: { label: 'Donor Accepted', bg: 'bg-success text-white' },
  SCREENING_SUBMITTED: { label: 'Screening Submitted – Awaiting Medical Review', bg: 'bg-info text-dark border border-info' },
  AWAITING_REVIEW: { label: 'Screening Submitted – Awaiting Medical Review', bg: 'bg-info text-dark border border-info' },
  MEDICAL_APPROVED: { label: 'Medically Approved', bg: 'bg-primary text-white' },
  MEDICAL_DEFERRED: { label: 'Medically Deferred', bg: 'bg-danger text-white' },
  SCHEDULED: { label: 'Scheduled / Coordination', bg: 'bg-warning text-dark' },
  DONATION_COMPLETED: { label: 'Completed', bg: 'bg-success text-white' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-dark text-white' },
  CLOSED: { label: 'Closed', bg: 'bg-secondary text-white' }
};

const StatusBadge = ({ status }) => {
  const meta = statusMap[status] || { label: status, bg: 'bg-light text-dark' };
  return (
    <span className={`badge rounded-pill px-2.5 py-1.5 fw-semibold ${meta.bg}`} style={{ fontSize: '0.78rem' }}>
      {meta.label}
    </span>
  );
};

export default StatusBadge;
