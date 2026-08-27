import React, { useState, useRef, useEffect } from 'react';
import { Users, Calendar, Pill, DollarSign, Settings, LogOut, Menu, X, Plus, Edit2, Trash2, Search, Home, Stethoscope, BarChart3, AlertCircle, CheckCircle } from 'lucide-react';

export default function HospitalManagementSystem() {
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState({ name: 'Dr. Ahmed', role: 'Administrator', department: 'General' });
  
  // Patient Management States
  const [patients, setPatients] = useState([
    { id: 'P001', name: 'Abebe Tesfaye', email: 'abebe@example.com', phone: '+251911222333', age: 45, gender: 'M', status: 'Active' },
    { id: 'P002', name: 'Almaz Tekle', email: 'almaz@example.com', phone: '+251922333444', age: 32, gender: 'F', status: 'Active' },
  ]);
  const [newPatient, setNewPatient] = useState({ name: '', email: '', phone: '', age: '', gender: 'M' });
  
  // Appointment States
  const [appointments, setAppointments] = useState([
    { id: 'A001', patientName: 'Abebe Tesfaye', doctorName: 'Dr. Belay', date: '2025-06-10', time: '10:00 AM', status: 'Scheduled' },
    { id: 'A002', patientName: 'Almaz Tekle', doctorName: 'Dr. Marta', date: '2025-06-11', time: '02:00 PM', status: 'Completed' },
  ]);
  const [newAppointment, setNewAppointment] = useState({ patientName: '', doctorName: '', date: '', time: '' });
  
  // Medical Records States
  const [medicalRecords, setMedicalRecords] = useState([
    { id: 'M001', patientId: 'P001', diagnosis: 'Hypertension', treatment: 'Lisinopril 10mg daily', date: '2025-06-01' },
    { id: 'M002', patientId: 'P002', diagnosis: 'Diabetes Type 2', treatment: 'Metformin 500mg', date: '2025-06-02' },
  ]);
  
  // Billing States
  const [bills, setBills] = useState([
    { id: 'B001', patientId: 'P001', amount: 5000, date: '2025-06-01', status: 'Paid', description: 'Consultation + Lab Tests' },
    { id: 'B002', patientId: 'P002', amount: 8500, date: '2025-06-02', status: 'Pending', description: 'Surgery + Hospital Stay' },
  ]);
  
  // Pharmacy States
  const [medications, setMedications] = useState([
    { id: 'MED001', name: 'Amoxicillin 500mg', stock: 250, expiry: '2026-12-31', price: 150 },
    { id: 'MED002', name: 'Ibuprofen 400mg', stock: 500, expiry: '2026-08-15', price: 80 },
    { id: 'MED003', name: 'Lisinopril 10mg', stock: 120, expiry: '2026-10-20', price: 200 },
  ]);
  
  // Alerts/Notifications
  const [alerts] = useState([
    { id: 1, type: 'warning', message: 'Amoxicillin stock below 100 units', icon: AlertCircle },
    { id: 2, type: 'info', message: 'Dr. Belay has 5 pending lab reports', icon: CheckCircle },
  ]);
  
  // Add Patient
  const handleAddPatient = () => {
    if (newPatient.name && newPatient.email && newPatient.phone) {
      const patient = { 
        id: `P${String(patients.length + 1).padStart(3, '0')}`,
        ...newPatient,
        status: 'Active'
      };
      setPatients([...patients, patient]);
      setNewPatient({ name: '', email: '', phone: '', age: '', gender: 'M' });
    }
  };
  
  // Delete Patient
  const deletePatient = (id) => {
    setPatients(patients.filter(p => p.id !== id));
  };
  
  // Add Appointment
  const handleAddAppointment = () => {
    if (newAppointment.patientName && newAppointment.doctorName && newAppointment.date && newAppointment.time) {
      const appointment = {
        id: `A${String(appointments.length + 1).padStart(3, '0')}`,
        ...newAppointment,
        status: 'Scheduled'
      };
      setAppointments([...appointments, appointment]);
      setNewAppointment({ patientName: '', doctorName: '', date: '', time: '' });
    }
  };
  
  // Delete Appointment
  const deleteAppointment = (id) => {
    setAppointments(appointments.filter(a => a.id !== id));
  };

  // Dashboard Statistics
  const stats = [
    { label: 'Total Patients', value: patients.length, color: 'bg-blue-500' },
    { label: 'Appointments Today', value: appointments.filter(a => a.status === 'Scheduled').length, color: 'bg-green-500' },
    { label: 'Pending Bills', value: bills.filter(b => b.status === 'Pending').length, color: 'bg-orange-500' },
    { label: 'Low Stock Items', value: medications.filter(m => m.stock < 100).length, color: 'bg-red-500' },
  ];

  // Module Components
  const renderDashboard = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
      
      {/* Alerts */}
      <div className="grid grid-cols-1 gap-4">
        {alerts.map(alert => (
          <div key={alert.id} className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="text-yellow-600" size={20} />
            <p className="text-sm text-yellow-800">{alert.message}</p>
          </div>
        ))}
      </div>
      
      {/* Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm">{stat.label}</p>
            <p className={`text-3xl font-bold text-white mt-2 ${stat.color} rounded px-3 py-1 inline-block`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => setCurrentModule('patients')} className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-center">
            <Users className="mx-auto mb-2 text-blue-600" />
            <p className="text-sm font-medium text-gray-700">Manage Patients</p>
          </button>
          <button onClick={() => setCurrentModule('appointments')} className="p-4 bg-green-50 hover:bg-green-100 rounded-lg transition text-center">
            <Calendar className="mx-auto mb-2 text-green-600" />
            <p className="text-sm font-medium text-gray-700">Appointments</p>
          </button>
          <button onClick={() => setCurrentModule('billing')} className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition text-center">
            <DollarSign className="mx-auto mb-2 text-orange-600" />
            <p className="text-sm font-medium text-gray-700">Billing</p>
          </button>
          <button onClick={() => setCurrentModule('pharmacy')} className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition text-center">
            <Pill className="mx-auto mb-2 text-purple-600" />
            <p className="text-sm font-medium text-gray-700">Pharmacy</p>
          </button>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Recent Activities</h2>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">✓ Patient P001 registered - Abebe Tesfaye</p>
          <p className="text-sm text-gray-600">✓ Appointment A002 completed - Dr. Marta</p>
          <p className="text-sm text-gray-600">✓ Bill B001 marked as paid - 5000 Birr</p>
        </div>
      </div>
    </div>
  );

  const renderPatients = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Patient Management</h1>
      
      {/* Add Patient Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Register New Patient</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Full Name"
            value={newPatient.name}
            onChange={(e) => setNewPatient({...newPatient, name: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            placeholder="Email"
            value={newPatient.email}
            onChange={(e) => setNewPatient({...newPatient, email: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="tel"
            placeholder="Phone"
            value={newPatient.phone}
            onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="Age"
            value={newPatient.age}
            onChange={(e) => setNewPatient({...newPatient, age: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddPatient}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Add
          </button>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Age</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{patient.id}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{patient.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{patient.email}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{patient.phone}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{patient.age}</td>
                  <td className="px-6 py-3 text-sm"><span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs">{patient.status}</span></td>
                  <td className="px-6 py-3 text-sm flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800"><Edit2 size={16} /></button>
                    <button onClick={() => deletePatient(patient.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAppointments = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Appointments</h1>
      
      {/* Book Appointment Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Book New Appointment</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Patient Name"
            value={newAppointment.patientName}
            onChange={(e) => setNewAppointment({...newAppointment, patientName: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            type="text"
            placeholder="Doctor Name"
            value={newAppointment.doctorName}
            onChange={(e) => setNewAppointment({...newAppointment, doctorName: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            type="date"
            value={newAppointment.date}
            onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            type="time"
            value={newAppointment.time}
            onChange={(e) => setNewAppointment({...newAppointment, time: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handleAddAppointment}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Book
          </button>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Patient</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Doctor</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((apt) => (
                <tr key={apt.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{apt.id}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{apt.patientName}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{apt.doctorName}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{apt.date}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{apt.time}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs ${apt.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {apt.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800"><Edit2 size={16} /></button>
                    <button onClick={() => deleteAppointment(apt.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBilling = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Billing & Payments</h1>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Total Revenue</p>
          <p className="text-3xl font-bold text-green-600">13,500 Br</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Paid</p>
          <p className="text-3xl font-bold text-blue-600">5,000 Br</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-3xl font-bold text-orange-600">8,500 Br</p>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Patient ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{bill.id}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{bill.patientId}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{bill.description}</td>
                  <td className="px-6 py-3 text-sm text-gray-900 font-semibold">{bill.amount} Br</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{bill.date}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs ${bill.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                      {bill.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPharmacy = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Pharmacy Management</h1>
      
      {/* Medications Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Medication Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Stock</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Price (Br)</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Expiry Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {medications.map((med) => (
                <tr key={med.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{med.id}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{med.name}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`font-semibold ${med.stock < 100 ? 'text-red-600' : 'text-green-600'}`}>
                      {med.stock} units
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{med.price} Br</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{med.expiry}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs ${med.stock < 100 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {med.stock < 100 ? 'Low Stock' : 'In Stock'}
                    </span>
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
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white transition-all duration-300 overflow-hidden`}>
        <div className="p-6 flex items-center justify-between">
          {sidebarOpen && <h1 className="text-xl font-bold">BUHO</h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        <nav className="mt-8 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Home },
            { id: 'patients', label: 'Patients', icon: Users },
            { id: 'appointments', label: 'Appointments', icon: Calendar },
            { id: 'billing', label: 'Billing', icon: DollarSign },
            { id: 'pharmacy', label: 'Pharmacy', icon: Pill },
            { id: 'reports', label: 'Reports', icon: BarChart3 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentModule(item.id)}
                className={`w-full flex items-center gap-4 px-6 py-3 transition ${
                  currentModule === item.id ? 'bg-blue-600' : 'hover:bg-gray-800'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
        
        <div className="absolute bottom-6 left-0 right-0 px-6">
          <div className="bg-gray-800 p-4 rounded-lg mb-4">
            {sidebarOpen && (
              <div>
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-gray-400">{user.role}</p>
              </div>
            )}
          </div>
          <button className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition">
            <LogOut size={18} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <div className="bg-white shadow-sm p-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Bule Hora University Teaching Hospital</h1>
          <div className="text-right">
            <p className="text-sm text-gray-600">Welcome, {user.name}</p>
            <p className="text-xs text-gray-500">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 overflow-auto p-6">
          {currentModule === 'dashboard' && renderDashboard()}
          {currentModule === 'patients' && renderPatients()}
          {currentModule === 'appointments' && renderAppointments()}
          {currentModule === 'billing' && renderBilling()}
          {currentModule === 'pharmacy' && renderPharmacy()}
          {currentModule === 'reports' && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Reports & Analytics</h1>
              <p className="text-gray-600">Comprehensive reporting module coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
