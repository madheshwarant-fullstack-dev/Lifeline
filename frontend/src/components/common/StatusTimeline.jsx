import React from 'react';
import { BsCheckLg, BsClock } from 'react-icons/bs';

const STEPS = [
  { key: 'PENDING', label: 'Request Created' },
  { key: 'MATCHED', label: 'Donors Matched' },
  { key: 'ACCEPTED', label: 'Donor Accepted' },
  { key: 'SCREENING_SUBMITTED', label: 'Screening Submitted' },
  { key: 'SCHEDULED', label: 'Medical Review & Coordination' },
  { key: 'DONATION_COMPLETED', label: 'Donation Completed' },
  { key: 'CLOSED', label: 'Closed' }
];

const getStepIndex = (status) => {
  switch (status) {
    case 'PENDING': return 0;
    case 'MATCHED': return 1;
    case 'DONOR_CONTACTED': return 1;
    case 'ACCEPTED': return 2;
    case 'SCREENING_SUBMITTED':
    case 'AWAITING_REVIEW': return 3;
    case 'SCHEDULED':
    case 'APPROVED':
    case 'MEDICAL_APPROVED': return 4;
    case 'DONATION_COMPLETED':
    case 'FULFILLED': return 5;
    case 'CLOSED': return 6;
    default: return -1;
  }
};

const StatusTimeline = ({ currentStatus }) => {
  const currentIndex = getStepIndex(currentStatus);

  if (currentStatus === 'CANCELLED') {
    return (
      <div className="alert alert-dark text-center my-3 py-2 small mb-0 rounded-3">
        <strong>Status:</strong> This request was cancelled.
      </div>
    );
  }

  return (
    <div className="my-4">
      <div className="d-flex justify-content-between align-items-center position-relative">
        {/* Background line */}
        <div 
          className="position-absolute start-0 end-0 bg-light-subtle border-top border-2" 
          style={{ top: '18px', zIndex: 1, borderColor: '#e2e8f0' }}
        />
        
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          let nodeBg = '#e2e8f0';
          let textColor = '#64748b';
          let icon = <span style={{ fontSize: '12px' }}>{idx + 1}</span>;

          if (isDone) {
            nodeBg = '#16a34a';
            textColor = '#ffffff';
            icon = <BsCheckLg size={12} />;
          } else if (isCurrent) {
            nodeBg = '#b91c1c';
            textColor = '#ffffff';
            icon = <BsClock size={12} />;
          }

          return (
            <div 
              key={step.key} 
              className="text-center position-relative d-flex flex-column align-items-center"
              style={{ zIndex: 2, flex: 1 }}
            >
              <div
                className="rounded-circle d-flex align-items-center justify-content-center fw-bold transition-all"
                style={{
                  width: '36px',
                  height: '36px',
                  backgroundColor: nodeBg,
                  color: textColor,
                  boxShadow: isCurrent ? '0 0 10px rgba(185, 28, 28, 0.4)' : 'none',
                  border: isCurrent ? '3px solid #fecaca' : '2px solid #ffffff'
                }}
              >
                {icon}
              </div>
              <span 
                className={`mt-2 small fw-semibold text-break px-1 ${isCurrent ? 'text-danger' : isDone ? 'text-success' : 'text-muted'}`}
                style={{ fontSize: '0.75rem', lineHeight: '1.2' }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusTimeline;
