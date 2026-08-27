import React from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import AdminDashboard from './components/AdminDashboard.jsx';
import AdvancedHospitalSystem from './components/AdvancedHospitalSystem.jsx';
import AnalyticsDashboard from './components/AnalyticsDashboard.jsx';
import CompetencyAssessmentTool from './components/CompetencyAssessmentTool.jsx';
import HospitalManagementSystem from './components/HospitalManagementSystem.jsx';
import MobileHealthApp from './components/MobileHealthApp.jsx';
import PatientPortal from './components/PatientPortal.jsx';

const ROUTES = [
  { path: '/hospital', label: 'Hospital System', Component: HospitalManagementSystem },
  { path: '/advanced', label: 'Advanced Modules', Component: AdvancedHospitalSystem },
  { path: '/admin', label: 'Admin', Component: AdminDashboard },
  { path: '/analytics', label: 'Analytics', Component: AnalyticsDashboard },
  { path: '/portal', label: 'Patient Portal', Component: PatientPortal },
  { path: '/nurse', label: 'Nurse App', Component: MobileHealthApp },
  { path: '/competency', label: 'Competency', Component: CompetencyAssessmentTool },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="flex flex-wrap gap-2 border-b border-gray-700 bg-gray-800 px-4 py-3">
        {ROUTES.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        {ROUTES.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
        <Route path="*" element={<Navigate to="/hospital" replace />} />
      </Routes>
    </div>
  );
}
