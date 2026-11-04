import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { FaBell, FaCheckDouble, FaExclamationTriangle, FaCheckCircle, FaInfoCircle } from 'react-icons/fa';

const DonorNotifications = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">Notification Center</h2>
          <p className="text-muted small mb-0">
            Real-time emergency broadcasts, request alerts, and donation updates.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="btn btn-outline-danger btn-sm rounded-pill fw-semibold d-flex align-items-center gap-1.5"
            onClick={markAllAsRead}
          >
            <FaCheckDouble size={13} /> Mark All as Read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bc-card p-5 bg-white text-center rounded-3 border">
          <FaBell className="text-muted mb-3" size={36} />
          <h5 className="fw-bold text-dark">No Notifications</h5>
          <p className="text-muted small mb-0">You're all caught up! When new alerts occur, they will appear here.</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-2.5">
          {notifications.map((n) => {
            const isEmergency = n.type === 'EMERGENCY';
            return (
              <div
                key={n.id}
                className={`bc-card p-3.5 transition-all ${!n.isRead ? 'bg-white border-start border-4 border-danger shadow-sm' : 'bg-light bg-opacity-50'}`}
              >
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div className="d-flex align-items-start gap-3">
                    <span className={`p-2 rounded-circle fs-6 ${isEmergency ? 'bg-danger text-white' : 'bg-danger-subtle text-danger'}`}>
                      {isEmergency ? <FaExclamationTriangle /> : <FaBell />}
                    </span>
                    <div>
                      <h6 className={`fw-bold mb-1 ${isEmergency ? 'text-danger' : 'text-dark'}`}>
                        {n.title}
                      </h6>
                      <p className="text-secondary small mb-1">{n.message}</p>
                      <small className="text-muted" style={{ fontSize: '11px' }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </small>
                    </div>
                  </div>

                  {!n.isRead && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary py-1 px-2.5 small flex-shrink-0"
                      onClick={() => markAsRead(n.id)}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DonorNotifications;
