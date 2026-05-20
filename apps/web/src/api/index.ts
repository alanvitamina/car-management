import client from './client';

// Auth
export const authApi = {
  login: (data: { code?: string; open_id?: string }) => {
    if (data.code) return client.post('/auth/feishu/callback', { code: data.code });
    return client.post('/auth/feishu/login', { open_id: data.open_id });
  },
  getAuthUrl: () => client.get('/auth/feishu/auth-url'),
  getMe: () => client.get('/auth/me'),
};

// Users
export const userApi = {
  list: (params?: any) => client.get('/users', { params }),
  todoSummary: () => client.get('/users/todo-summary'),
  update: (id: number, data: any) => client.put(`/users/${id}`, data),
};

// Departments
export const deptApi = {
  tree: () => client.get('/departments/tree'),
  getApprover: (deptId: number) => client.get(`/departments/${deptId}/approver`),
};

// Vehicles
export const vehicleApi = {
  list: (params?: any) => client.get('/vehicles', { params }),
  available: (params?: any) => client.get('/vehicles/available', { params }),
  create: (data: any) => client.post('/vehicles', data),
  update: (id: number, data: any) => client.put(`/vehicles/${id}`, data),
  remove: (id: number) => client.delete(`/vehicles/${id}`),
};

// Drivers
export const driverApi = {
  list: (params?: any) => client.get('/drivers', { params }),
  available: (params?: any) => client.get('/drivers/available', { params }),
  create: (data: any) => client.post('/drivers', data),
  update: (id: number, data: any) => client.put(`/drivers/${id}`, data),
  remove: (id: number) => client.delete(`/drivers/${id}`),
};

// Applications
export const applicationApi = {
  list: (params?: any) => client.get('/applications', { params }),
  detail: (id: number) => client.get(`/applications/${id}`),
  create: (data: any) => client.post('/applications', data),
  update: (id: number, data: any) => client.put(`/applications/${id}`, data),
  submit: (id: number) => client.post(`/applications/${id}/submit`),
  cancel: (id: number, reason?: string) => client.post(`/applications/${id}/cancel`, { reason }),
  change: (id: number, data: any) => client.post(`/applications/${id}/change`, data),
  remove: (id: number) => client.delete(`/applications/${id}`),
};

// Approvals
export const approvalApi = {
  pending: () => client.get('/approvals/pending'),
  approve: (id: number, comment?: string) => client.post(`/approvals/${id}/approve`, { comment }),
  reject: (id: number, comment?: string) => client.post(`/approvals/${id}/reject`, { comment }),
};

// Dispatch
export const dispatchApi = {
  pending: () => client.get('/dispatches/pending'),
  create: (data: any) => client.post('/dispatches', data),
  reassign: (id: number, data: any) => client.put(`/dispatches/${id}/reassign`, data),
  start: (id: number) => client.post(`/dispatches/${id}/start`),
};

// Consumption
export const consumptionApi = {
  list: (params?: any) => client.get('/consumptions', { params }),
  myDispatches: () => client.get('/consumptions/my-dispatches'),
  create: (data: any) => client.post('/consumptions', data),
  uploadPhoto: (image: string) => client.post('/consumptions/upload-photo', { image }),
  ocrPhoto: (url: string) => client.post('/consumptions/ocr-photo', { url }),
  confirm: (id: number) => client.post(`/consumptions/${id}/confirm`),
  adminConfirm: (id: number) => client.post(`/consumptions/${id}/admin-confirm`),
  reject: (id: number, reason: string) => client.post(`/consumptions/${id}/reject`, { reason }),
};

// Subsidy
export const subsidyApi = {
  rules: () => client.get('/subsidies/rules'),
  updateRule: (id: number, data: any) => client.put(`/subsidies/rules/${id}`, data),
  calculatePrivateCar: (data: any) => client.post('/subsidies/calculate/private-car', data),
  calculateDriver: (data: any) => client.post('/subsidies/calculate/driver', data),
  driverOvertimeSummary: (params?: any) => client.get('/subsidies/driver-overtime-summary', { params }),
  settlements: (params?: any) => client.get('/subsidies/settlements', { params }),
};

// Dashboard
export const dashboardApi = {
  summary: () => client.get('/dashboard/summary'),
  trend: () => client.get('/dashboard/trend'),
};

// Notifications
export const notificationApi = {
  list: (params?: any) => client.get('/notifications', { params }),
  unreadCount: () => client.get('/notifications/unread-count'),
  markRead: (id: number) => client.put(`/notifications/${id}/read`),
};

// Feishu
export const feishuApi = {
  createApproval: (applicationId: number) => client.post('/feishu/create-approval', { application_id: applicationId }),
  sendMessage: (data: any) => client.post('/feishu/send-message', data),
  syncOrg: () => client.post('/feishu/sync-org'),
};
