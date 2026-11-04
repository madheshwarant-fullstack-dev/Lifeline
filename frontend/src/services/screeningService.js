import api from './api';

export const screeningService = {
  submitScreening: async (data) => {
    const response = await api.post('/screenings', data);
    return response.data;
  },

  getScreeningByRequest: async (requestId) => {
    const response = await api.get(`/screenings/request/${requestId}`);
    return response.data;
  },

  getScreeningById: async (screeningId) => {
    const response = await api.get(`/screenings/${screeningId}`);
    return response.data;
  },

  getScreenings: async (params = {}) => {
    const response = await api.get('/screenings', { params });
    return response.data;
  },

  reviewScreening: async (screeningId, reviewData) => {
    const response = await api.put(`/screenings/${screeningId}/review`, reviewData);
    return response.data;
  },

  confirmDonation: async (screeningId, donationData = {}) => {
    const response = await api.post(`/screenings/${screeningId}/confirm`, donationData);
    return response.data;
  }
};
