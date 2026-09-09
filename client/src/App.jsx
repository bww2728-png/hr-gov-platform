import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { setLang } from './i18n';
import Layout from './components/Layout';

import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import EmployeeNew from './pages/EmployeeNew';
import EmployeeCredentials from './pages/EmployeeCredentials';
import OrgChart from './pages/OrgChart';
import KnowledgeHub from './pages/KnowledgeHub';
import PolicyRulesHub from './pages/PolicyRulesHub';
import Workflows from './pages/Workflows';
import ComplianceHub from './pages/ComplianceHub';
import TransformationHub from './pages/TransformationHub';
import Analytics from './pages/Analytics';
import Users from './pages/Users';
import Roles from './pages/Roles';
import SystemAdminHub from './pages/SystemAdminHub';
import Audit from './pages/Audit';
import Settings from './pages/Settings';
import MyHub from './pages/MyHub';
import Leaves from './pages/Leaves';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import Performance from './pages/Performance';
import Learning from './pages/Learning';
import TalentHub from './pages/TalentHub';
import Relations from './pages/Relations';
import ExpatHub from './pages/ExpatHub';
import Requests from './pages/Requests';
import RecruitmentHub from './pages/RecruitmentHub';
import Security from './pages/Security';
import Transparency from './pages/Transparency';
import ApprovalsInbox from './pages/ApprovalsInbox';
import ReportsCenter from './pages/ReportsCenter';

setLang(localStorage.getItem('hr_lang') || 'ar');

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-full flex items-center justify-center text-ink-500">جاري التحميل...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route
        path="*"
        element={
          <Protected>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/my-hub" element={<MyHub />} />
                <Route path="/profile" element={<Navigate to="/my-hub" replace />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/employees/new" element={<EmployeeNew />} />
                <Route path="/employees/credentials" element={<EmployeeCredentials />} />
                <Route path="/employees/:id" element={<EmployeeDetail />} />
                <Route path="/org-chart" element={<OrgChart />} />
                <Route path="/recruitment" element={<RecruitmentHub />} />
                <Route path="/candidates" element={<Navigate to="/recruitment" replace />} />
                <Route path="/requests" element={<Requests />} />
                <Route path="/leaves" element={<Leaves />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/payroll" element={<Payroll />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/learning" element={<Learning />} />
                <Route path="/talent" element={<TalentHub />} />
                <Route path="/retention" element={<Navigate to="/talent" replace />} />
                <Route path="/relations" element={<Relations />} />
                <Route path="/expat" element={<ExpatHub />} />
                <Route path="/insurance" element={<Navigate to="/expat" replace />} />
                <Route path="/qiwa" element={<Navigate to="/expat" replace />} />
                <Route path="/knowledge" element={<KnowledgeHub />} />
                <Route path="/policies" element={<Navigate to="/knowledge" replace />} />
                <Route path="/decisions" element={<Navigate to="/knowledge" replace />} />
                <Route path="/flowcharts" element={<Navigate to="/knowledge" replace />} />
                <Route path="/policy-center" element={<PolicyRulesHub />} />
                <Route path="/formulas" element={<Navigate to="/policy-center" replace />} />
                <Route path="/compliance" element={<ComplianceHub />} />
                <Route path="/compliance-sa" element={<Navigate to="/compliance" replace />} />
                <Route path="/maturity" element={<TransformationHub />} />
                <Route path="/roadmap" element={<Navigate to="/maturity" replace />} />
                <Route path="/risks" element={<Navigate to="/maturity" replace />} />
                <Route path="/fivewhys" element={<Navigate to="/maturity" replace />} />
                <Route path="/workflows" element={<Workflows />} />
                <Route path="/transparency" element={<Transparency />} />
                <Route path="/security" element={<Security />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/users" element={<Users />} />
                <Route path="/roles" element={<Roles />} />
                <Route path="/system-admin" element={<SystemAdminHub />} />
                <Route path="/lookup-admin" element={<Navigate to="/system-admin" replace />} />
                <Route path="/integrations" element={<Navigate to="/system-admin" replace />} />
                <Route path="/audit" element={<Audit />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/approvals" element={<ApprovalsInbox />} />
                <Route path="/reports" element={<ReportsCenter />} />
                <Route path="*" element={<div className="page"><h1>404</h1><p>الصفحة غير موجودة</p></div>} />
              </Routes>
            </Layout>
          </Protected>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
