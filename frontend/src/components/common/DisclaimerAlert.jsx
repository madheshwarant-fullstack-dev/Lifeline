import React from 'react';
import { BsShieldCheck } from 'react-icons/bs';

const DisclaimerAlert = ({ customText }) => {
  return (
    <div className="medical-disclaimer-box d-flex align-items-start gap-2 shadow-sm my-3">
      <BsShieldCheck className="text-secondary mt-1 flex-shrink-0" size={16} />
      <div>
        <strong className="d-block text-dark" style={{ fontSize: '0.8rem' }}>
          Clinical Transfusion Advisory Notice:
        </strong>
        <span style={{ fontSize: '0.78rem' }}>
          {customText || 
            "Lifeline donor matching algorithms serve strictly as an administrative coordination aid. Final red blood cell crossmatching, Rh/antibody screening, and transfusion authorizations must be independently verified by licensed physicians and accredited hospital blood banks."
          }
        </span>
      </div>
    </div>
  );
};

export default DisclaimerAlert;
