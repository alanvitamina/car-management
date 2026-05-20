import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from './layouts/MainLayout';
import Workbench from './pages/Workbench';
import NewApplication from './pages/NewApplication';
import MyApplications from './pages/MyApplications';
import ApplicationDetail from './pages/ApplicationDetail';
import Approvals from './pages/Approvals';
import DispatchPage from './pages/DispatchPage';
import ConsumptionPage from './pages/ConsumptionPage';
import SubsidyPage from './pages/SubsidyPage';
import Vehicles from './pages/Vehicles';
import Drivers from './pages/Drivers';
import Users from './pages/Users';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/login/callback" element={<Login />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/workbench" replace />} />
            <Route path="workbench" element={<Workbench />} />
            <Route path="new-application" element={<NewApplication />} />
            <Route path="my-applications" element={<MyApplications />} />
            <Route path="applications/:id" element={<ApplicationDetail />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="dispatch" element={<DispatchPage />} />
            <Route path="consumption" element={<ConsumptionPage />} />
            <Route path="subsidy" element={<SubsidyPage />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="drivers" element={<Drivers />} />
            <Route path="users" element={<Users />} />
            <Route path="dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
