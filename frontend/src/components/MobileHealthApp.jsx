import React, { useState } from 'react';
import { Phone, Bell, LogOut, Search, User, Clock, AlertCircle, CheckCircle, TrendingUp, Pill, Thermometer, Heart, Activity } from 'lucide-react';

export default function MobileHealthApp() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [vitals, setVitals] = useState({ bp: '', temp: '', pulse: '', o2: '' });

  const patients = [
    { id: 'P001', name: 'Abebe Tesfaye', age: 45, room: '102', status: 'Critical', condition: 'Post-op monitoring', lastVitals: '2 min ago' },
    { id: 'P002', name: 'Almaz Tekle', age: 32, room: '105', status: 'Stable', condition: 'Recovery', lastVitals: '15 min ago' },
    { id: 'P003', name: 'Biruk Samuel', age: 67, room: '108', status: 'Monitoring', condition: 'Hypertension', lastVitals: '30 min ago' },
  ];

  const dashboardCards = [
    { icon: User, label: 'My Patients', value: 12, color: 'bg-blue-500' },
    { icon: AlertCircle, label: 'Alerts', value: 3, color: 'bg-red-500' },
    { icon: Clock, label: 'Pending Orders', value: 8, color: 'bg-orange-500' },
    { icon: CheckCircle, label: 'Completed', value: 24, color: 'bg-green-500' },
  ];

  const patientDetails = {
    'P001': {
      name: 'Abebe Tesfaye',
      mrn: 'MRN-2025-001234',
      age: 45,
      gender: 'M',
      room: '102',
      diagnosis: 'Post-operative care - Appendectomy',
      medications: ['Amoxicillin 500mg', 'Paracetamol 500mg', 'Loratadine 10mg'],
      orders: ['Check vitals every 2 hours', 'Monitor IV intake', 'Pain assessment every 4 hours'],
      lastVitals: { bp: '120/80', temp: 37.2, pulse: 78, o2: 98 }
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg">
        <p className="text-sm opacity-80">Welcome back</p>
        <h1 className="text-2xl font-bold">Nurse Maria</h1>
        <p className="text-sm opacity-80 mt-1">Ward 3 - 6 patients assigned</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        {dashboardCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white rounded-lg p-4 shadow">
              <div className={`${card.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
                <Icon className="text-white" size={20} />
              </div>
              <p className="text-gray-600 text-xs">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Critical Alerts */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-semibold text-red-900 mb-2">⚠️ Critical Alerts</h3>
        <div className="space-y-2 text-sm">
          <div className="bg-white p-2 rounded">Patient P001: BP elevated (145/92) - Check NOW</div>
          <div className="bg-white p-2 rounded">Patient P003: Overdue for vitals check</div>
        </div>
      </div>

      {/* My Patients */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">My Patients</h2>
        <div className="space-y-2">
          {patients.map(patient => (
            <button
              key={patient.id}
              onClick={() => {
                setSelectedPatient(patient.id);
                setCurrentView('patient');
              }}
              className="w-full bg-white p-4 rounded-lg border-l-4 border-blue-500 text-left hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{patient.name}</p>
                  <p className="text-xs text-gray-600">Room {patient.room} • Age {patient.age}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded font-semibold ${
                  patient.status === 'Critical' ? 'bg-red-100 text-red-800' :
                  patient.status === 'Stable' ? 'bg-green-100 text-green-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {patient.status}
                </span>
              </div>
              <p className="text-xs text-gray-600">{patient.condition}</p>
              <p className="text-xs text-gray-500 mt-1">Last vitals: {patient.lastVitals}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPatientView = () => {
    if (!selectedPatient) return null;
    const patient = patientDetails[selectedPatient];

    return (
      <div className="pb-20 space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg">
          <p className="text-sm opacity-80">Patient Details</p>
          <h1 className="text-2xl font-bold">{patient.name}</h1>
          <p className="text-sm opacity-80 mt-1">MRN: {patient.mrn} • Room {selectedPatient}</p>
        </div>

        {/* Current Vitals */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Activity size={20} className="text-blue-600" /> Current Vitals
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-xs text-gray-600">Blood Pressure</p>
              <p className="text-xl font-bold text-gray-900">{patient.lastVitals.bp}</p>
            </div>
            <div className="bg-red-50 p-3 rounded">
              <p className="text-xs text-gray-600">Temperature</p>
              <p className="text-xl font-bold text-gray-900">{patient.lastVitals.temp}°C</p>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <p className="text-xs text-gray-600">Pulse Rate</p>
              <p className="text-xl font-bold text-gray-900">{patient.lastVitals.pulse} bpm</p>
            </div>
            <div className="bg-purple-50 p-3 rounded">
              <p className="text-xs text-gray-600">O2 Saturation</p>
              <p className="text-xl font-bold text-gray-900">{patient.lastVitals.o2}%</p>
            </div>
          </div>
        </div>

        {/* Update Vitals */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Thermometer size={20} className="text-orange-600" /> Update Vitals
          </h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="BP (120/80)"
              value={vitals.bp}
              onChange={(e) => setVitals({...vitals, bp: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded text-sm"
            />
            <input
              type="number"
              placeholder="Temperature (°C)"
              value={vitals.temp}
              onChange={(e) => setVitals({...vitals, temp: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded text-sm"
            />
            <input
              type="number"
              placeholder="Pulse (bpm)"
              value={vitals.pulse}
              onChange={(e) => setVitals({...vitals, pulse: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded text-sm"
            />
            <input
              type="number"
              placeholder="O2 Saturation (%)"
              value={vitals.o2}
              onChange={(e) => setVitals({...vitals, o2: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded text-sm"
            />
            <button className="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700">
              ✓ Save Vitals
            </button>
          </div>
        </div>

        {/* Current Medications */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Pill size={20} className="text-green-600" /> Current Medications
          </h2>
          <div className="space-y-2">
            {patient.medications.map((med, idx) => (
              <div key={idx} className="bg-green-50 p-3 rounded text-sm border-l-4 border-green-500">
                <p className="font-semibold text-gray-900">{med}</p>
                <p className="text-xs text-gray-600">Status: Given</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h2 className="font-bold text-gray-900 mb-3">📋 Pending Orders</h2>
          <div className="space-y-2">
            {patient.orders.map((order, idx) => (
              <div key={idx} className="bg-yellow-50 p-3 rounded text-sm border-l-4 border-yellow-500">
                <p className="text-gray-900">{order}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => setCurrentView('dashboard')}
          className="w-full bg-gray-200 text-gray-900 py-3 rounded font-semibold"
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Status Bar */}
      <div className="bg-gray-900 text-white p-3 flex justify-between items-center text-xs">
        <span>9:41</span>
        <span>📶 4G • 🔋 89%</span>
      </div>

      {/* Main Content */}
      <div className="px-4 pt-4">
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'patient' && renderPatientView()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 grid grid-cols-4 gap-0">
        <button
          onClick={() => setCurrentView('dashboard')}
          className={`py-3 flex flex-col items-center gap-1 text-xs font-semibold ${
            currentView === 'dashboard' ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
          }`}
        >
          <Activity size={24} />
          <span>Dashboard</span>
        </button>
        <button className="py-3 flex flex-col items-center gap-1 text-xs font-semibold text-gray-600">
          <Search size={24} />
          <span>Search</span>
        </button>
        <button className="py-3 flex flex-col items-center gap-1 text-xs font-semibold text-gray-600 relative">
          <Bell size={24} />
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
          <span>Alerts</span>
        </button>
        <button className="py-3 flex flex-col items-center gap-1 text-xs font-semibold text-gray-600">
          <User size={24} />
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
}
