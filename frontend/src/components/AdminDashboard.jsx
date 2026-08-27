import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Users, Activity, AlertTriangle, CheckCircle, Clock, BarChart3, PieChart, Settings, Bell, LogOut, Filter, Download, RefreshCw } from 'lucide-react';

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState('today');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // KPI Data
  const kpis = [
    { label: 'Total Patients', value: 2547, change: '+12%', trend: 'up', icon: Users, color: 'bg-blue-500' },
    { label: 'Active Appointments', value: 43, change: '+8%', trend: 'up', icon: Activity, color: 'bg-green-500' },
    { label: 'Pending Lab Tests', value: 127, change: '-5%', trend: 'down', icon: Clock, color: 'bg-orange-500' },
    { label: 'Outstanding Bills', value: '245,600 Br', change: '-18%', trend: 'down', icon: TrendingDown, color: 'bg-red-500' },
  ];

  // Department Performance
  const departments = [
    { name: 'Internal Medicine', patients: 342, revenue: '1,245,000 Br', efficiency: '92%' },
    { name: 'Cardiology', patients: 156, revenue: '856,000 Br', efficiency: '88%' },
    { name: 'Surgery', patients: 89, revenue: '654,000 Br', efficiency: '95%' },
    { name: 'Pediatrics', patients: 234, revenue: '456,000 Br', efficiency: '90%' },
    { name: 'Orthopedics', patients: 123, revenue: '345,000 Br', efficiency: '87%' },
  ];

  // Staff on Duty
  const staffOnDuty = [
    { name: 'Dr. Belay Kassa', role: 'Cardiologist', department: 'Cardiology', shift: 'Morning', status: 'Active' },
    { name: 'Dr. Marta Tesfaye', role: 'Surgeon', department: 'Surgery', shift: 'Evening', status: 'Active' },
    { name: 'Nurse Alemayehu', role: 'Head Nurse', department: 'General Ward', shift: 'Night', status: 'Active' },
    { name: 'Pharmacist Addis', role: 'Lead Pharmacist', department: 'Pharmacy', shift: 'Morning', status: 'Active' },
  ];

  // Recent Alerts
  const alerts = [
    { id: 1, type: 'warning', title: 'Low Inventory Alert', message: 'Amoxicillin stock below 50 units', time: '5 minutes ago' },
    { id: 2, type: 'info', title: 'System Update', message: 'Scheduled maintenance tonight 2-3 AM', time: '1 hour ago' },
    { id: 3, type: 'error', title: 'Payment Failed', message: 'Insurance claim for patient P001 failed', time: '2 hours ago' },
  ];

  // Revenue Chart Data
  const revenueData = [
    { day: 'Mon', value: 1200 },
    { day: 'Tue', value: 1900 },
    { day: 'Wed', value: 1600 },
    { day: 'Thu', value: 2100 },
    { day: 'Fri', value: 2400 },
    { day: 'Sat', value: 1800 },
    { day: 'Sun', value: 1400 },
  ];

  const maxValue = Math.max(...revenueData.map(d => d.value));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Hospital Operations Dashboard</h1>
            <p className="text-gray-400 text-sm">Bule Hora University Teaching Hospitals</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleRefresh} className={`p-2 hover:bg-gray-700 rounded-lg transition ${refreshing ? 'animate-spin' : ''}`}>
              <RefreshCw size={24} />
            </button>
            <button className="p-2 hover:bg-gray-700 rounded-lg relative">
              <Bell size={24} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <button className="p-2 hover:bg-gray-700 rounded-lg">
              <Settings size={24} />
            </button>
            <button className="p-2 hover:bg-gray-700 rounded-lg">
              <LogOut size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex gap-2">
            {['today', 'week', 'month', 'year'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg transition ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
              <Filter size={18} /> Filter
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition">
              <Download size={18} /> Export
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition">
                <div className="flex justify-between items-start mb-4">
                  <div className={`${kpi.color} p-3 rounded-lg`}>
                    <Icon className="text-white" size={24} />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-semibold ${kpi.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    {kpi.change}
                    {kpi.trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-2">{kpi.label}</p>
                <p className="text-3xl font-bold text-white">{kpi.value}</p>
              </div>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="text-blue-400" /> Daily Revenue Trend
            </h2>
            <div className="flex items-end justify-between h-64 gap-2">
              {revenueData.map((data, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-blue-600 rounded-t-lg hover:bg-blue-500 transition" style={{ height: `${(data.value / maxValue) * 100}%` }}></div>
                  <p className="text-xs text-gray-400">{data.day}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-gray-400">
              <p>Average: 1,757 Br | Total: 12,300 Br</p>
            </div>
          </div>

          {/* Patient Distribution */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <PieChart className="text-green-400" /> Patient Distribution
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Inpatients</span>
                  <span className="font-semibold">542</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '42%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Outpatients</span>
                  <span className="font-semibold">1,245</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Emergency</span>
                  <span className="font-semibold">760</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: '50%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Department Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-bold mb-6">Department Performance</h2>
            <div className="space-y-4">
              {departments.map((dept, idx) => (
                <div key={idx} className="border-b border-gray-700 pb-4 last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">{dept.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${parseInt(dept.efficiency) >= 90 ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                      {dept.efficiency} efficiency
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Patients: {dept.patients}</span>
                    <span>Revenue: {dept.revenue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Staff on Duty */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-bold mb-6">Staff on Duty</h2>
            <div className="space-y-3">
              {staffOnDuty.map((staff, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
                  <div className="flex-1">
                    <p className="font-semibold">{staff.name}</p>
                    <p className="text-sm text-gray-400">{staff.role} • {staff.department}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">{staff.shift}</span>
                    <CheckCircle className="text-green-400" size={20} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts & Issues */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <AlertTriangle className="text-yellow-400" /> System Alerts & Issues
          </h2>
          <div className="space-y-3">
            {alerts.map(alert => (
              <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${
                alert.type === 'warning' ? 'bg-yellow-900 border-yellow-500 text-yellow-100' :
                alert.type === 'error' ? 'bg-red-900 border-red-500 text-red-100' :
                'bg-blue-900 border-blue-500 text-blue-100'
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{alert.title}</p>
                    <p className="text-sm mt-1">{alert.message}</p>
                  </div>
                  <p className="text-xs opacity-75">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
