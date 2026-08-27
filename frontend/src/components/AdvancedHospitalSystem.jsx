import React, { useState } from 'react';
import { Users, Calendar, Pill, DollarSign, FileText, Microscope, ImageIcon, Settings, LogOut, Menu, X, Plus, Edit2, Trash2, Search, BarChart3, AlertCircle, CheckCircle, Clock, TrendingUp, Download, Eye, Lock } from 'lucide-react';

export default function AdvancedHospitalSystem() {
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState({ name: 'Dr. Ahmed Hassan', role: 'Senior Physician', department: 'Internal Medicine' });
  
  // EMR States
  const [emrRecords, setEmrRecords] = useState([
    { id: 'EMR001', patientId: 'P001', visitDate: '2025-06-10', symptoms: 'Persistent cough, fever', diagnosis: 'Pneumonia', medications: ['Amoxicillin 500mg', 'Paracetamol 500mg'], vitals: { bp: '120/80', temp: '38.5°C', pulse: '92' } },
    { id: 'EMR002', patientId: 'P002', visitDate: '2025-06-09', symptoms: 'Abdominal pain', diagnosis: 'Gastric Ulcer', medications: ['Omeprazole 20mg'], vitals: { bp: '130/85', temp: '37°C', pulse: '88' } },
  ]);

  // Laboratory States
  const [labTests, setLabTests] = useState([
    { id: 'LAB001', patientId: 'P001', testType: 'Blood Test (CBC)', requestDate: '2025-06-10', status: 'Completed', results: 'WBC: 8.5, RBC: 4.8, HGB: 14.2', technicianId: 'TECH001' },
    { id: 'LAB002', patientId: 'P002', testType: 'Stool Analysis', requestDate: '2025-06-10', status: 'Pending', results: null, technicianId: null },
    { id: 'LAB003', patientId: 'P001', testType: 'Urine Analysis', requestDate: '2025-06-09', status: 'Completed', results: 'Glucose: Negative, Protein: Trace', technicianId: 'TECH002' },
  ]);

  // Radiology States
  const [radiologyOrders, setRadiologyOrders] = useState([
    { id: 'RAD001', patientId: 'P001', imagingType: 'Chest X-Ray', orderDate: '2025-06-10', status: 'Completed', findings: 'Mild pneumonic infiltrate in right lower lobe', radiologistId: 'RAD001' },
    { id: 'RAD002', patientId: 'P002', imagingType: 'Abdominal Ultrasound', orderDate: '2025-06-10', status: 'In Progress', findings: null, radiologistId: null },
  ]);

  // Staff States
  const [staffMembers, setStaffMembers] = useState([
    { id: 'STAFF001', name: 'Dr. Belay Kassa', role: 'Cardiologist', department: 'Cardiology', license: 'ETH-2015-0234', status: 'Active', shift: 'Morning' },
    { id: 'STAFF002', name: 'Dr. Marta Tesfaye', role: 'Surgeon', department: 'Surgery', license: 'ETH-2014-0567', status: 'Active', shift: 'Evening' },
    { id: 'STAFF003', name: 'Nurse Alemayehu', role: 'Head Nurse', department: 'General Ward', license: 'NRS-2016-0123', status: 'Active', shift: 'Night' },
  ]);

  // Add EMR Record
  const [newEMR, setNewEMR] = useState({ patientId: '', symptoms: '', diagnosis: '', medications: '', bp: '', temp: '', pulse: '' });
  const handleAddEMR = () => {
    if (newEMR.patientId && newEMR.diagnosis) {
      const record = {
        id: `EMR${String(emrRecords.length + 1).padStart(3, '0')}`,
        visitDate: new Date().toISOString().split('T')[0],
        ...newEMR,
        medications: newEMR.medications.split(',').map(m => m.trim()),
        vitals: { bp: newEMR.bp, temp: newEMR.temp, pulse: newEMR.pulse }
      };
      setEmrRecords([...emrRecords, record]);
      setNewEMR({ patientId: '', symptoms: '', diagnosis: '', medications: '', bp: '', temp: '', pulse: '' });
    }
  };

  // Dashboard Statistics
  const stats = [
    { label: 'Patients Today', value: '45', icon: Users, color: 'bg-blue-500' },
    { label: 'Lab Tests Pending', value: labTests.filter(t => t.status === 'Pending').length, icon: Microscope, color: 'bg-green-500' },
    { label: 'Imaging Orders', value: radiologyOrders.length, icon: ImageIcon, color: 'bg-purple-500' },
    { label: 'Staff On Duty', value: staffMembers.filter(s => s.status === 'Active').length, icon: Clock, color: 'bg-orange-500' },
  ];

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-right">
          <p className="text-sm text-gray-600">Last Updated: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition border-l-4 border-blue-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-600 text-sm font-semibold">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <Icon className={`${stat.color} text-white p-3 rounded-lg`} size={48} />
              </div>
              <div className="mt-4 flex items-center text-green-600 text-sm">
                <TrendingUp size={16} className="mr-1" /> Up 12% from last week
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Add EMR', module: 'emr', icon: FileText, color: 'from-blue-500 to-blue-600' },
          { label: 'Lab Tests', module: 'laboratory', icon: Microscope, color: 'from-green-500 to-green-600' },
          { label: 'Radiology', module: 'radiology', icon: ImageIcon, color: 'from-purple-500 to-purple-600' },
          { label: 'Staff Schedule', module: 'staff', icon: Calendar, color: 'from-orange-500 to-orange-600' },
        ].map((action, idx) => {
          const Icon = action.icon;
          return (
            <button
              key={idx}
              onClick={() => setCurrentModule(action.module)}
              className={`p-6 bg-gradient-to-br ${action.color} rounded-xl shadow-lg text-white hover:shadow-xl transition transform hover:scale-105`}
            >
              <Icon size={32} className="mb-2" />
              <p className="font-semibold">{action.label}</p>
            </button>
          );
        })}
      </div>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent EMR Entries</h2>
          <div className="space-y-3">
            {emrRecords.slice(-3).reverse().map(record => (
              <div key={record.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-semibold text-sm text-gray-900">{record.diagnosis}</p>
                <p className="text-xs text-gray-600">Patient: {record.patientId} | {record.visitDate}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Pending Tests</h2>
          <div className="space-y-3">
            {labTests.filter(t => t.status === 'Pending').map(test => (
              <div key={test.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="font-semibold text-sm text-gray-900">{test.testType}</p>
                <p className="text-xs text-gray-600">Patient: {test.patientId} | Requested: {test.requestDate}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderEMR = () => (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-gray-900">Electronic Medical Records</h1>
      
      {/* Add EMR Form */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Create New Medical Record</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <input type="text" placeholder="Patient ID" value={newEMR.patientId} onChange={(e) => setNewEMR({...newEMR, patientId: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" placeholder="Chief Complaint" value={newEMR.symptoms} onChange={(e) => setNewEMR({...newEMR, symptoms: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" placeholder="Diagnosis" value={newEMR.diagnosis} onChange={(e) => setNewEMR({...newEMR, diagnosis: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" placeholder="Medications (comma-separated)" value={newEMR.medications} onChange={(e) => setNewEMR({...newEMR, medications: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 lg:col-span-2" />
          
          <div className="lg:col-span-3 grid grid-cols-3 gap-3">
            <input type="text" placeholder="BP (120/80)" value={newEMR.bp} onChange={(e) => setNewEMR({...newEMR, bp: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="text" placeholder="Temp (°C)" value={newEMR.temp} onChange={(e) => setNewEMR({...newEMR, temp: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="text" placeholder="Pulse (bpm)" value={newEMR.pulse} onChange={(e) => setNewEMR({...newEMR, pulse: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button onClick={handleAddEMR} className="lg:col-span-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2">
            <Plus size={20} /> Create Record
          </button>
        </div>
      </div>

      {/* EMR List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Record ID</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Patient ID</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Visit Date</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Diagnosis</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Vitals</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {emrRecords.map((record) => (
                <tr key={record.id} className="border-b hover:bg-blue-50 transition">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{record.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{record.patientId}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{record.visitDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-medium">{record.diagnosis}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">BP: {record.vitals.bp} | Temp: {record.vitals.temp}</td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-100 rounded"><Eye size={18} /></button>
                    <button className="text-green-600 hover:text-green-800 p-2 hover:bg-green-100 rounded"><Edit2 size={18} /></button>
                    <button className="text-red-600 hover:text-red-800 p-2 hover:bg-red-100 rounded"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderLaboratory = () => (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-gray-900">Laboratory Management</h1>
      
      {/* Lab Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <p className="text-sm font-semibold opacity-90">Completed</p>
          <p className="text-3xl font-bold">{labTests.filter(t => t.status === 'Completed').length}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
          <p className="text-sm font-semibold opacity-90">Pending</p>
          <p className="text-3xl font-bold">{labTests.filter(t => t.status === 'Pending').length}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <p className="text-sm font-semibold opacity-90">Total Tests</p>
          <p className="text-3xl font-bold">{labTests.length}</p>
        </div>
      </div>

      {/* Lab Tests Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">Test ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Patient ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Test Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Request Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Results</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {labTests.map((test) => (
                <tr key={test.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{test.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{test.patientId}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{test.testType}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{test.requestDate}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${test.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {test.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{test.results || '—'}</td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    {test.status === 'Pending' ? (
                      <button className="text-purple-600 hover:text-purple-800 p-2 hover:bg-purple-100 rounded font-semibold text-xs">ENTER RESULTS</button>
                    ) : (
                      <button className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-100 rounded"><Download size={18} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderRadiology = () => (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-gray-900">Radiology Department</h1>
      
      {/* Imaging Orders Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">Order ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Patient ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Imaging Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Order Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Findings</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {radiologyOrders.map((order) => (
                <tr key={order.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{order.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{order.patientId}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{order.imagingType}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.orderDate}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${order.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-xs">{order.findings || '—'}</td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-100 rounded"><Eye size={18} /></button>
                    <button className="text-purple-600 hover:text-purple-800 p-2 hover:bg-purple-100 rounded"><ImageIcon size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderStaff = () => (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-gray-900">Staff Management</h1>
      
      {/* Staff List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-orange-600 to-orange-700 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Department</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">License</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Shift</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffMembers.map((staff) => (
                <tr key={staff.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{staff.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{staff.role}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{staff.department}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{staff.license}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">{staff.shift}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">{staff.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-100 rounded"><Edit2 size={18} /></button>
                    <button className="text-red-600 hover:text-red-800 p-2 hover:bg-red-100 rounded"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-24'} bg-gradient-to-b from-gray-900 to-gray-800 text-white transition-all duration-300 overflow-hidden shadow-2xl`}>
        <div className="p-6 flex items-center justify-between border-b border-gray-700">
          {sidebarOpen && <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">BUHO</h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white hover:bg-gray-700 p-2 rounded">
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        
        <nav className="mt-8 space-y-2 px-3">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'emr', label: 'EMR', icon: FileText },
            { id: 'laboratory', label: 'Laboratory', icon: Microscope },
            { id: 'radiology', label: 'Radiology', icon: ImageIcon },
            { id: 'staff', label: 'Staff', icon: Users },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentModule(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition ${
                  currentModule === item.id 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'hover:bg-gray-700 text-gray-300'
                }`}
              >
                <Icon size={22} />
                {sidebarOpen && <span className="font-semibold">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        
        <div className="absolute bottom-6 left-0 right-0 px-3">
          <div className="bg-gray-700 p-4 rounded-lg mb-4 border border-gray-600">
            {sidebarOpen ? (
              <div>
                <p className="text-sm font-bold text-white">{user.name}</p>
                <p className="text-xs text-gray-400 mt-1">{user.role}</p>
                <p className="text-xs text-gray-500">{user.department}</p>
              </div>
            ) : (
              <Lock size={20} className="text-gray-400 mx-auto" />
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-white shadow-md p-6 border-b-2 border-gray-200">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Bule Hora University Teaching Hospital</h1>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm text-gray-600 font-semibold">{user.name}</p>
                <p className="text-xs text-gray-500">{new Date().toLocaleDateString()}</p>
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                <LogOut className="text-red-600" size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 overflow-auto p-8">
          {currentModule === 'dashboard' && renderDashboard()}
          {currentModule === 'emr' && renderEMR()}
          {currentModule === 'laboratory' && renderLaboratory()}
          {currentModule === 'radiology' && renderRadiology()}
          {currentModule === 'staff' && renderStaff()}
        </div>
      </div>
    </div>
  );
}
