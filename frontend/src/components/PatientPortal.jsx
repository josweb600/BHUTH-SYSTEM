import React, { useState } from 'react';
import { Calendar, FileText, DollarSign, Bell, LogOut, Settings, User, ChevronRight, AlertCircle, CheckCircle, Clock, Eye, Download, MessageSquare } from 'lucide-react';

export default function PatientPortal() {
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [patient] = useState({
    name: 'Abebe Tesfaye',
    mrn: 'MRN-2025-001234',
    email: 'abebe@example.com',
    phone: '+251911222333',
    dateOfBirth: '1980-03-15',
    bloodType: 'O+',
    age: 45
  });

  const [appointments] = useState([
    { id: 1, doctor: 'Dr. Belay Kassa', specialty: 'Cardiology', date: '2025-06-20', time: '10:00 AM', status: 'upcoming', location: 'Building A, 3rd Floor' },
    { id: 2, doctor: 'Dr. Marta Tesfaye', specialty: 'Internal Medicine', date: '2025-06-15', time: '02:00 PM', status: 'completed', location: 'Building B, 2nd Floor' },
  ]);

  const [medicalRecords] = useState([
    { id: 1, date: '2025-06-15', type: 'Visit', diagnosis: 'Hypertension', doctor: 'Dr. Belay Kassa', status: 'Available' },
    { id: 2, date: '2025-06-10', type: 'Lab Results', test: 'Complete Blood Count', status: 'Available' },
    { id: 3, date: '2025-06-05', type: 'Imaging', test: 'Chest X-Ray', status: 'Available' },
  ]);

  const [bills] = useState([
    { id: 1, date: '2025-06-15', amount: 5000, paid: 5000, status: 'Paid', description: 'Consultation + Lab Tests' },
    { id: 2, date: '2025-06-10', amount: 3500, paid: 0, status: 'Pending', description: 'Imaging Studies' },
  ]);

  const [messages] = useState([
    { id: 1, from: 'Dr. Belay Kassa', date: '2025-06-14', subject: 'Follow-up Results', preview: 'Your blood pressure readings are improving...' },
  ]);

  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Welcome Card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-8 rounded-2xl shadow-lg">
        <h1 className="text-4xl font-bold mb-2">Welcome back, {patient.name}!</h1>
        <p className="text-blue-100">MRN: {patient.mrn} | Age: {patient.age} | Blood Type: {patient.bloodType}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
          <Calendar className="text-blue-600 mb-3" size={28} />
          <p className="text-gray-600 text-sm">Upcoming Appointments</p>
          <p className="text-3xl font-bold text-gray-900">{appointments.filter(a => a.status === 'upcoming').length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
          <FileText className="text-green-600 mb-3" size={28} />
          <p className="text-gray-600 text-sm">Medical Records</p>
          <p className="text-3xl font-bold text-gray-900">{medicalRecords.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
          <DollarSign className="text-orange-600 mb-3" size={28} />
          <p className="text-gray-600 text-sm">Outstanding Balance</p>
          <p className="text-3xl font-bold text-orange-600">3,500 Br</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
          <MessageSquare className="text-purple-600 mb-3" size={28} />
          <p className="text-gray-600 text-sm">Messages</p>
          <p className="text-3xl font-bold text-gray-900">{messages.length}</p>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="text-blue-600 mt-1 mr-4" size={24} />
          <div>
            <h3 className="font-semibold text-gray-900">Appointment Reminder</h3>
            <p className="text-gray-700 mt-1">You have an appointment with Dr. Belay Kassa on June 20 at 10:00 AM. Please arrive 15 minutes early.</p>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button onClick={() => setCurrentSection('appointments')} className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition text-left group">
          <Calendar className="text-blue-600 mb-3" size={32} />
          <h3 className="font-bold text-gray-900 mb-2">View Appointments</h3>
          <p className="text-gray-600 text-sm mb-4">Schedule new visits or reschedule existing appointments</p>
          <ChevronRight className="text-blue-600 group-hover:translate-x-1 transition" />
        </button>
        <button onClick={() => setCurrentSection('records')} className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition text-left group">
          <FileText className="text-green-600 mb-3" size={32} />
          <h3 className="font-bold text-gray-900 mb-2">Medical Records</h3>
          <p className="text-gray-600 text-sm mb-4">View your complete medical history and test results</p>
          <ChevronRight className="text-green-600 group-hover:translate-x-1 transition" />
        </button>
      </div>
    </div>
  );

  const renderAppointments = () => (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">My Appointments</h2>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button className="px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-semibold">Upcoming</button>
        <button className="px-4 py-2 text-gray-600 hover:text-gray-900">Past</button>
      </div>

      {/* Appointment Cards */}
      <div className="space-y-4">
        {appointments.filter(a => a.status === 'upcoming').map(apt => (
          <div key={apt.id} className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition border-l-4 border-green-500">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">{apt.doctor}</h3>
                <p className="text-gray-600">{apt.specialty}</p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-gray-700">
                    <Calendar size={18} className="mr-2" />
                    <span>{new Date(apt.date).toLocaleDateString()} at {apt.time}</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <span className="mr-2">📍</span>
                    {apt.location}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Reschedule</button>
                <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">Cancel</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Book New Button */}
      <button className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-bold hover:shadow-lg transition">
        + Book New Appointment
      </button>
    </div>
  );

  const renderMedicalRecords = () => (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">My Medical Records</h2>

      {/* Records List */}
      <div className="space-y-3">
        {medicalRecords.map(record => (
          <div key={record.id} className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition flex justify-between items-center">
            <div className="flex-1">
              <p className="text-gray-600 text-sm">{new Date(record.date).toLocaleDateString()}</p>
              <h3 className="font-bold text-gray-900 text-lg">{record.type}</h3>
              <p className="text-gray-700">{record.diagnosis || record.test}</p>
              {record.doctor && <p className="text-gray-600 text-sm">By: {record.doctor}</p>}
            </div>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-blue-50 rounded-lg transition">
                <Eye className="text-blue-600" size={24} />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                <Download className="text-gray-600" size={24} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Medications */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-bold text-lg text-gray-900 mb-4">Current Medications</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">Lisinopril 10mg</p>
              <p className="text-gray-600 text-sm">Once daily - for hypertension</p>
            </div>
            <span className="text-green-600 font-semibold">Active</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">Aspirin 75mg</p>
              <p className="text-gray-600 text-sm">Once daily - for heart health</p>
            </div>
            <span className="text-green-600 font-semibold">Active</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBilling = () => (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Billing & Payments</h2>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-6 rounded-xl">
          <p className="text-gray-600 text-sm">Total Amount Paid</p>
          <p className="text-3xl font-bold text-green-600">5,000 Br</p>
        </div>
        <div className="bg-orange-50 p-6 rounded-xl">
          <p className="text-gray-600 text-sm">Outstanding Balance</p>
          <p className="text-3xl font-bold text-orange-600">3,500 Br</p>
        </div>
        <div className="bg-blue-50 p-6 rounded-xl">
          <p className="text-gray-600 text-sm">Total Billed</p>
          <p className="text-3xl font-bold text-blue-600">8,500 Br</p>
        </div>
      </div>

      {/* Bills List */}
      <div className="space-y-3">
        {bills.map(bill => (
          <div key={bill.id} className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-600 text-sm">{new Date(bill.date).toLocaleDateString()}</p>
                <h3 className="font-bold text-gray-900">{bill.description}</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${bill.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                {bill.status}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-600">Amount: <span className="font-bold text-gray-900">{bill.amount} Br</span></p>
                {bill.paid > 0 && <p className="text-gray-600">Paid: <span className="font-bold text-green-600">{bill.paid} Br</span></p>}
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition">View Details</button>
                {bill.status === 'Pending' && <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">Pay Now</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">BUHO Patient Portal</h1>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="text-gray-600" size={24} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></span>
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Settings className="text-gray-600" size={24} />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <LogOut className="text-gray-600" size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
              { id: 'appointments', label: 'Appointments', icon: '📅' },
              { id: 'records', label: 'Medical Records', icon: '📋' },
              { id: 'billing', label: 'Billing', icon: '💰' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setCurrentSection(item.id)}
                className={`px-4 py-4 border-b-2 font-medium transition ${
                  currentSection === item.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {currentSection === 'dashboard' && renderDashboard()}
        {currentSection === 'appointments' && renderAppointments()}
        {currentSection === 'records' && renderMedicalRecords()}
        {currentSection === 'billing' && renderBilling()}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-white mb-4">About BUHO</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Support</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Contact</h3>
              <p className="text-sm">Phone: +251-911-XXX-XXXX</p>
              <p className="text-sm">Email: support@buho.edu.et</p>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-8 text-center text-sm">
            <p>&copy; 2025 Bule Hora University Teaching Hospitals. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
