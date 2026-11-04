import React, { useState, useEffect } from 'react';
import { donationService } from '../../services/donationService';
import { useAuth } from '../../context/AuthContext';
import { FaHistory, FaHospital, FaCalendarAlt, FaCheckCircle, FaFileAlt } from 'react-icons/fa';

const DonationHistory = () => {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDonations = async () => {
      try {
        const res = await donationService.getDonations();
        if (res && res.data) {
          setDonations(res.data);
        }
      } catch (e) {
        console.error('Failed to load donation history:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDonations();
  }, []);

  return (
    <div>
      <div className="mb-4 pb-2 border-bottom">
        <h2 className="fw-bold mb-1">My Donation History</h2>
        <p className="text-muted small mb-0">
          A verifiable record of your lifesaving contributions and hospital sign-offs.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status" />
          <p className="text-muted small mt-2">Loading donation records...</p>
        </div>
      ) : donations.length === 0 ? (
        <div className="bc-card p-5 bg-white text-center rounded-3 border">
          <FaHistory className="text-muted mb-3" size={36} />
          <h5 className="fw-bold text-dark">No Donation Records Found</h5>
          <p className="text-muted small mb-0">
            Once you accept a request and complete the donation at the hospital blood bank, your verified record will appear here.
          </p>
        </div>
      ) : (
        <div className="bc-card bg-white shadow-sm overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small">
                <tr>
                  <th>Donation ID</th>
                  <th>Hospital & Location</th>
                  <th>Blood Group</th>
                  <th>Units</th>
                  <th>Donation Date</th>
                  <th>Status</th>
                  <th>Clinical Notes</th>
                </tr>
              </thead>
              <tbody className="small">
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong className="text-danger">{d.donationId}</strong>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">{d.hospitalName}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>{d.city}{d.state ? `, ${d.state}` : ''}</div>
                    </td>
                    <td>
                      <span className="blood-badge-pill" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                        {d.bloodGroup}
                      </span>
                    </td>
                    <td><strong>{d.units || 1}</strong> unit(s)</td>
                    <td>
                      <div className="text-dark d-flex align-items-center gap-1">
                        <FaCalendarAlt className="text-muted" size={11} />
                        {new Date(d.donationDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <span className={`badge rounded-pill ${d.status === 'COMPLETED' ? 'bg-success' : 'bg-warning text-dark'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="text-muted">
                      {d.notes || 'Routine donation sign-off'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonationHistory;
