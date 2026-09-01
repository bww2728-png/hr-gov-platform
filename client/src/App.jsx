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
import OrgChart from './pages/OrgChart';
import Recruitment from './pages/Recruitment';
import Candidates from './pages/Candidates';
import Knowledge from './pages/Knowledge';
import Decisions from './pages/Decisions';
import Policies from './pages/Policies';
import Workflows from './pages/Workflows';
import Compliance from './pages/Compliance';
import Maturity from './pages/Maturity';
import Roadmap from './pages/Roadmap';
import Risks from './pages/Risks';
import FiveWhys from './pages/FiveWhys';
import Analytics from './pages/Analytics';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Integrations from './pages/Integrations';
import Audit from './pages/Audit';
import Settings from './pages/Settings';
import MyHub from './pages/MyHub';
import Leaves from './pages/Leaves';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import Performance from './pages/Performance';
import Learning from './pages/Learning';
import Talent from './pages/Talent';
import Retention from './pages/Retention';
import Relations from './pages/Relations';
import Expat from './pages/Expat';
import Insurance from './pages/Insurance';
import Requests from './pages/Requests';
import Flowcharts from './pages/Flowcharts';
import ComplianceSA from './pages/ComplianceSA';
import Security from './pages/Security';
import Transparency from './pages/Transparency';
import LookupAdmin from './pages/LookupAdmin';
import FormulaCenter from './pages/FormulaCenter';
import ApprovalsInbox from './pages/ApprovalsInbox';
import ReportsCenter from './pages/ReportsCenter';
import Qiwa from './pages/Qiwa';

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
                <Route path="/employees" element={<Employees />} />
                <Route path="/employees/new" element={<EmployeeNew />} />
                <Route path="/employees/:id" element={<EmployeeDetail />} />
                <Route path="/org-chart" element={<OrgChart />} />
                <Route path="/recruitment" element={<Recruitment />} />
                <Route path="/candidates" element={<Candidates />} />
                <Route path="/requests" element={<Requests />} />
                <Route path="/leaves" element={<Leaves />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/payroll" element={<Payroll />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/learning" element={<Learning />} />
                <Route path="/talent" element={<Talent />} />
                <Route path="/retention" element={<Retention />} />
                <Route path="/relations" element={<Relations />} />
                <Route path="/expat" element={<Expat />} />
                <Route path="/insurance" element={<Insurance />} />
                <Route path="/compliance-sa" element={<ComplianceSA />} />
                <Route path="/flowcharts" element={<Flowcharts />} />
                <Route path="/security" element={<Security />} />
                <Route path="/knowledge" element={<Knowledge />} />
                <Route path="/decisions" element={<Decisions />} />
                <Route path="/policies" element={<Policies />} />
                <Route path="/workflows" element={<Workflows />} />
                <Route path="/compliance" element={<Compliance />} />
                <Route path="/maturity" element={<Maturity />} />
                <Route path="/roadmap" element={<Roadmap />} />
                <Route path="/risks" element={<Risks />} />
                <Route path="/fivewhys" element={<FiveWhys />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/users" element={<Users />} />
                <Route path="/roles" element={<Roles />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/audit" element={<Audit />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<MyHub />} />
                <Route path="/transparency" element={<Transparency />} />
                <Route path="/lookup-admin" element={<LookupAdmin />} />
                <Route path="/formulas" element={<FormulaCenter />} />
                <Route path="/approvals" element={<ApprovalsInbox />} />
                <Route path="/reports" element={<ReportsCenter />} />
                <Route path="/qiwa" element={<Qiwa />} />
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