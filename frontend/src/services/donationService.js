import api from './api';

export const donationService = {
  async recordDonation(data) {
    const response = await api.post('/donations', data);
    return response.data;
  },

  async getDonations(params = {}) {
    const response = await api.get('/donations', { params });
    return response.data;
  },

  async updateDonation(id, status, notes = '') {
    const response = await api.put(`/donations/${id}`, { status, notes });
    return response.data;
  }
};
