import React, { useState } from 'react';
import { CheckCircle, AlertCircle, TrendingUp, Download } from 'lucide-react';

export default function CompetencyAssessmentTool() {
  const [assessments, setAssessments] = useState([
    { id: 1, name: 'Dr. Abebe Tesfaye', role: 'Physician', modules: { emr: 85, orders: 90, patient: 95 }, status: 'Certified', date: '2025-05-20' },
    { id: 2, name: 'Nurse Almaz Tekle', role: 'Nurse', modules: { vitals: 88, medications: 92, patient: 90 }, status: 'Certified', date: '2025-05-18' },
    { id: 3, name: 'Receptionist Biruk', role: 'Receptionist', modules: { registration: 78, scheduling: 82, patient: 80 }, status: 'In Progress', date: null },
    { id: 4, name: 'Pharmacist Samiyah', role: 'Pharmacist', modules: { prescriptions: 85, inventory: 88, interactions: 92 }, status: 'Certified', date: '2025-05-15' },
  ]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [filterRole, setFilterRole] = useState('All');

  const roles = ['All', 'Physician', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Tech', 'Radiologist'];
  
  const roleModules = {
    'Physician': ['EMR', 'Orders', 'Patient Management', 'Reports'],
    'Nurse': ['Vitals', 'Medications', 'Patient Care', 'Alerts'],
    'Receptionist': ['Registration', 'Scheduling', 'Patient Management', 'Billing'],
    'Pharmacist': ['Prescriptions', 'Inventory', 'Drug Interactions', 'Dispensing'],
    'Lab Tech': ['Test Orders', 'Result Entry', 'Quality Control', 'Reporting'],
    'Radiologist': ['Imaging Orders', 'DICOM Viewer', 'Report Generation', 'Archive'],
  };

  const filteredAssessments = filterRole === 'All' 
    ? assessments 
    : assessments.filter(a => a.role === filterRole);

  const getScoreColor = (score) => {
    if (score >= 85) return 'bg-green-100 text-green-800';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusColor = (status) => {
    return status === 'Certified' 
      ? 'bg-green-50 border-green-500' 
      : 'bg-yellow-50 border-yellow-500';
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Staff Competency Assessment</h1>
          <p className="text-gray-600">EHMS System Training & Certification Tracking</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Staff</p>
            <p className="text-3xl font-bold text-blue-600">{assessments.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Certified</p>
            <p className="text-3xl font-bold text-green-600">{assessments.filter(a => a.status === 'Certified').length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-3xl font-bold text-yellow-600">{assessments.filter(a => a.status === 'In Progress').length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Avg Score</p>
            <p className="text-3xl font-bold text-indigo-600">
              {Math.round(assessments.reduce((sum, a) => sum + Object.values(a.modules).reduce((s, v) => s + v, 0) / Object.keys(a.modules).length, 0) / assessments.length)}%
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter by Role</h2>
          <div className="flex flex-wrap gap-2">
            {roles.map(role => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  filterRole === role
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Assessment Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAssessments.map(assessment => (
            <div
              key={assessment.id}
              onClick={() => setSelectedUser(assessment)}
              className={`cursor-pointer rounded-lg shadow-lg p-6 border-l-4 transition hover:shadow-xl ${getStatusColor(assessment.status)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{assessment.name}</h3>
                  <p className="text-sm text-gray-600">{assessment.role}</p>
                </div>
                {assessment.status === 'Certified' ? (
                  <CheckCircle className="text-green-600" size={28} />
                ) : (
                  <AlertCircle className="text-yellow-600" size={28} />
                )}
              </div>

              {/* Module Scores */}
              <div className="space-y-3 mb-4">
                {Object.entries(assessment.modules).map(([module, score]) => (
                  <div key={module}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">{module}</span>
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${getScoreColor(score)}`}>
                        {score}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Status & Certification */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-300">
                <span className={`text-sm font-semibold px-3 py-1 rounded ${
                  assessment.status === 'Certified'
                    ? 'bg-green-200 text-green-800'
                    : 'bg-yellow-200 text-yellow-800'
                }`}>
                  {assessment.status}
                </span>
                {assessment.date && (
                  <span className="text-xs text-gray-600">
                    Certified: {new Date(assessment.date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Module Details */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">{selectedUser.name}</h2>
                  <p className="text-blue-100">{selectedUser.role}</p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-2xl hover:opacity-70"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Module Details */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Module Assessment Details</h3>
                  <div className="space-y-4">
                    {roleModules[selectedUser.role]?.map((module, idx) => {
                      const key = Object.keys(selectedUser.modules)[idx] || 'unknown';
                      const score = selectedUser.modules[key] || 0;
                      return (
                        <div key={module} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between mb-2">
                            <span className="font-semibold text-gray-900">{module}</span>
                            <span className={`font-bold px-3 py-1 rounded ${getScoreColor(score)}`}>
                              {score}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-300 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full ${score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 mt-2">
                            {score >= 85 ? '✓ Competent' : score >= 70 ? '⚠ Additional Training Recommended' : '✗ Requires Remediation'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700">
                    Schedule Reassessment
                  </button>
                  <button className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700">
                    Generate Certificate
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
