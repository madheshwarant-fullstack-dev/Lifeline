import api from './api';

export const requestService = {
  async createRequest(data) {
    const response = await api.post('/requests', data);
    return response.data;
  },

  async getRequests(params = {}) {
    const response = await api.get('/requests', { params });
    return response.data;
  },

  async getRequestById(id) {
    const response = await api.get(`/requests/${id}`);
    return response.data;
  },

  async updateRequestStatus(id, status) {
    const response = await api.put(`/requests/${id}/status`, { status });
    return response.data;
  },

  async deleteRequest(id) {
    const response = await api.delete(`/requests/${id}`);
    return response.data;
  },

  async getMatchesForRequest(requestId, onlyVerified = false) {
    const response = await api.get(`/matching/${requestId}`, {
      params: { only_verified: onlyVerified }
    });
    return response.data;
  },

  async createHospitalRequest(data) {
    const response = await api.post('/hospitals/requests', data);
    return response.data;
  },

  async getHospitalRequests(params = {}) {
    const response = await api.get('/hospitals/requests', { params });
    return response.data;
  },

  async getHospitalRequestDonors(requestId, params = {}) {
    const response = await api.get(`/hospitals/requests/${requestId}/donors`, { params });
    return response.data;
  },

  async inviteDonors(requestId, payload) {
    const response = await api.post(`/requests/${requestId}/invite`, payload);
    return response.data;
  },

  async patchRequestStatus(id, status) {
    const response = await api.patch(`/requests/${id}/status`, { status });
    return response.data;
  },

  async getRequestInvitations(requestId) {
    const response = await api.get(`/requests/${requestId}/invitations`);
    return response.data;
  }
};
