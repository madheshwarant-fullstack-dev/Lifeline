import api from './api';

export const adminService = {
  async getDashboardStats() {
    const response = await api.get('/admin/dashboard');
    return response.data;
  },

  async getUsers(params = {}) {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  async updateUserStatus(userId, status) {
    const response = await api.put(`/admin/users/${userId}/status`, { status });
    return response.data;
  },

  async verifyDonor(donorId, status) {
    const response = await api.put(`/admin/donors/${donorId}/verify`, { status });
    return response.data;
  },

  async deleteUser(userId) {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },

  async verifyHospital(hospitalId, isVerified = true) {
    const response = await api.put(`/admin/hospitals/${hospitalId}/verify`, { isVerified });
    return response.data;
  },

  async getReports() {
    const response = await api.get('/admin/reports');
    return response.data;
  },

  async getAdminDonors(params = {}) {
    const response = await api.get('/admin/donors', { params });
    return response.data;
  },

  async getAdminHospitals(params = {}) {
    const response = await api.get('/admin/hospitals', { params });
    return response.data;
  },

  async getAdminRequests(params = {}) {
    const response = await api.get('/admin/requests', { params });
    return response.data;
  },

  async updateDonorMedicalReview(donorId, data) {
    const response = await api.put(`/admin/donors/${donorId}/medical-review`, data);
    return response.data;
  }
};
