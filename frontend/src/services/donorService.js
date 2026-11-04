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
  }
};
