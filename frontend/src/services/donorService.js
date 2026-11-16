import api from './api';

export const donorService = {
  async getDonors(params = {}) {
    const response = await api.get('/donors', { params });
    return response.data;
  },

  async searchDonors(params = {}) {
    const response = await api.get('/donors/search', { params });
    return response.data;
  },

  async getDonorById(donorId) {
    const response = await api.get(`/donors/${donorId}`);
    return response.data;
  },

  async updateDonorProfile(donorId, data) {
    const response = await api.put(`/donors/${donorId}`, data);
    return response.data;
  },

  async getDonorDashboard() {
    const response = await api.get('/donors/dashboard');
    return response.data;
  },

  async setAvailability(availability) {
    const response = await api.post('/donors/availability', { availability });
    return response.data;
  },

  async respondToRequest(requestId, action) {
    const response = await api.post(`/donors/requests/${requestId}/respond`, { action });
    return response.data;
  },

  async contactDonor(donorId, data) {
    const response = await api.post(`/donors/${donorId}/contact`, data);
    return response.data;
  },

  async getPublicStats() {
    const response = await api.get('/stats');
    return response.data;
  },

  async setLocationSharing(payload) {
    const response = await api.post('/donors/location-sharing', payload);
    return response.data;
  },

  async updateLiveLocation(payload) {
    const response = await api.post('/donors/location', payload);
    return response.data;
  },

  async patchAvailability(availability) {
    const response = await api.patch('/donors/availability', { availability });
    return response.data;
  },

  async getNearbyDonors(params = {}) {
    const response = await api.get('/donors/nearby', { params });
    return response.data;
  },

  async getInvitations() {
    const response = await api.get('/donors/invitations');
    return response.data;
  },

  async respondToRequestV2(requestId, action, note = null) {
    const response = await api.post(`/requests/${requestId}/respond`, { action, note });
    return response.data;
  },

  async getMedicalProfile() {
    const response = await api.get('/donors/medical-profile');
    return response.data;
  },

  async saveMedicalProfile(data) {
    const response = await api.post('/donors/medical-profile', data);
    return response.data;
  },

  async getMedicalReview(donorId, requestId = null) {
    const response = await api.get(`/donors/${donorId}/medical-review`, {
      params: requestId ? { requestId } : {}
    });
    return response.data;
  }
};
